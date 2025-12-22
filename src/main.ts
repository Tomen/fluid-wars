// Fluid Wars - Main Application Entry Point

import type { AppState, GameConfig, ObstacleData } from './types';
import { PLAYER_COLOR_NAMES } from './types';
import { Game } from './game';
import { Renderer } from './renderer';
import { GAME_CONFIG, GAME_LOOP_CONFIG, AI_CONFIG } from './config';
import { AggressiveAI, RandomAI } from './ai/AIController';
import { NeuralAI } from './ai/NeuralAI';
import { AsyncNeuralAI } from './ai/AsyncNeuralAI';
import { loadModelWithMetadata, isModelAvailable, clearModelCache } from './ai/ModelLoader';
import { ObservationEncoder } from './ai/ObservationEncoder';
import type { AIController } from './ai/AIController';
import type { ModelMetadata } from './ai/ModelLoader';
import { profiler } from './profiler';
import {
  UIManager,
  type UIData,
  PerformancePanel,
  GameInfoPanel,
  AIInfoPanel,
  AIObservationPanel,
  VictoryPanel,
  ObserverInfoPanel,
} from './ui';
import { GameClient, type ScenarioResult } from './network/GameClient';
import { NetworkRenderer } from './ui/NetworkRenderer';
import type { FrameData } from './network/protocol';
import type { ScenarioConfig } from './game/scenario';
import * as yaml from 'js-yaml';

// New UI components
import { LayoutManager } from './ui/LayoutManager';
import { Console as GameConsole } from './ui/Console';
import { PowerBar } from './ui/PowerBar';
import { StatusPanel } from './ui/StatusPanel';

// Import balance test scenarios using Vite's glob import
const balanceScenarioModules = import.meta.glob('../scenarios/balance/*.yaml', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

// Load all balance scenarios
function loadBalanceScenarios(): ScenarioConfig[] {
  const scenarios: ScenarioConfig[] = [];
  for (const [path, content] of Object.entries(balanceScenarioModules)) {
    try {
      const scenario = yaml.load(content) as ScenarioConfig;
      scenarios.push(scenario);
    } catch (e) {
      console.error(`Failed to load scenario from ${path}:`, e);
    }
  }
  return scenarios;
}

class App {
  private state: AppState = 'playing'; // Start in playing state for now
  private canvas: HTMLCanvasElement;
  private uiArea: HTMLElement;
  private renderer: Renderer;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsTime: number = 0;

  // Layout manager
  private layoutManager: LayoutManager;

  // New DOM-based UI components
  private powerBar: PowerBar;
  private statusPanel: StatusPanel;
  private console: GameConsole;

  // Game state
  private game: Game | null = null;

  // AI metadata (for displaying generation info)
  private aiModelMetadata: ModelMetadata | null = null;

  // AI observation overlay (debug panels that overlay game)
  private showDebugPanels: boolean = false;
  private observationEncoder: ObservationEncoder;

  // UI Manager (for debug overlay panels)
  private ui: UIManager;

  // Observer mode (watching game running in worker)
  private gameClient: GameClient | null = null;
  private networkRenderer: NetworkRenderer | null = null;
  private latestFrame: FrameData | null = null;
  private observerGameOver: { winner: number; stats: { steps: number; duration: number; finalCounts: number[] } } | null = null;
  private observerScenario: { name: string; description?: string; maxSteps: number } | null = null;
  private observerPlayerColors: string[] = [];
  // Queue tracking
  private observerQueue: {
    scenarios: ScenarioConfig[];
    currentIndex: number;
    completedResults: Array<{ scenarioName: string; winner: number; steps: number }>;
    queueComplete: boolean;
  } | null = null;

  constructor() {
    // Get DOM elements
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.uiArea = document.getElementById('ui-area') as HTMLElement;
    if (!this.canvas || !this.uiArea) {
      throw new Error('Required DOM elements not found');
    }

    // Initialize layout manager with game dimensions from config
    this.layoutManager = new LayoutManager({
      gameWidth: GAME_CONFIG.canvasWidth,
      gameHeight: GAME_CONFIG.canvasHeight,
      uiSize: 200,
      padding: 10,
    });

    // Apply initial layout
    this.layoutManager.applyToElements(this.canvas, this.uiArea);

    // Handle window resize
    this.layoutManager.onResize(() => {
      this.handleResize();
    });

    // Create renderer
    this.renderer = new Renderer(this.canvas);

    // Initialize new DOM-based UI components
    this.powerBar = new PowerBar();
    this.statusPanel = new StatusPanel();
    this.console = new GameConsole();

    // Setup console command handler
    this.console.onCommand((cmd, args) => {
      this.handleCommand(cmd, args);
    });

    // Welcome message
    this.console.system('Welcome to Fluid Wars!');
    this.console.info('Press V to toggle debug panels');

    // Create game with config dimensions
    const config: GameConfig = {
      playerCount: GAME_CONFIG.playerCount,
      particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
    };

    this.game = new Game(config, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);
    this.game.setCanvas(this.canvas);

    // Initialize observation encoder with game dimensions
    this.observationEncoder = new ObservationEncoder({
      canvasWidth: GAME_CONFIG.canvasWidth,
      canvasHeight: GAME_CONFIG.canvasHeight
    });

    // Initialize UI Manager for debug overlay panels
    this.ui = new UIManager();
    this.setupDebugPanels();

    // Setup keyboard listeners
    window.addEventListener('keydown', (e) => {
      // Ignore keyboard shortcuts if typing in console
      if (this.console.isFocused()) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (this.state === 'gameover') {
          this.restartGame();
        } else if (this.state === 'observing') {
          this.startObserverMode();
        }
      }
      // Toggle all debug panels
      if (e.key === 'v' || e.key === 'V') {
        this.showDebugPanels = !this.showDebugPanels;
        this.ui.setPanelVisible('performance', this.showDebugPanels);
        this.ui.setPanelVisible('gameInfo', this.showDebugPanels);
        this.ui.setPanelVisible('aiInfo', this.showDebugPanels);
        this.ui.setPanelVisible('aiObservation', this.showDebugPanels);
      }
      // Watch AI battle (observer mode)
      if (e.key === 'w' || e.key === 'W') {
        if (this.state !== 'observing') {
          this.startObserverMode();
        }
      }
      // Return to regular play mode
      if (e.key === 'Escape') {
        if (this.state === 'observing') {
          this.stopObserverMode();
        }
      }
      // Focus console with Enter or /
      if (e.key === 'Enter' || e.key === '/') {
        this.console.focus();
        e.preventDefault();
      }
    });

    // Setup mouse click listener for debug panels
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Scale from display coordinates to canvas native coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.ui.handleClick(x, y);
    });

    this.console.system(`Game initialized (${GAME_CONFIG.canvasWidth}x${GAME_CONFIG.canvasHeight})`);
  }

  private handleResize(): void {
    // Just update layout - canvas resolution stays the same, only CSS display size changes
    this.layoutManager.applyToElements(this.canvas, this.uiArea);
  }

  private handleCommand(cmd: string, _args: string[]): void {
    switch (cmd) {
      case 'help':
        this.console.info('Available commands:');
        this.console.info('  /help - Show this help');
        this.console.info('  /restart - Restart the game');
        this.console.info('  /watch - Enter observer mode');
        this.console.info('  /clear - Clear console');
        break;
      case 'restart':
        this.restartGame();
        break;
      case 'watch':
        this.startObserverMode();
        break;
      case 'clear':
        this.console.clear();
        break;
      default:
        this.console.error(`Unknown command: ${cmd}`);
    }
  }

  private setupDebugPanels(): void {
    // Configure responsive column layout for debug overlays
    this.ui.setColumnLayout(10, 10);

    // Left column panels (will stack dynamically) - hidden by default, toggle with 'v'
    const perfPanel = new PerformancePanel(10, 10);
    perfPanel.setVisible(false);
    this.ui.addPanel('performance', perfPanel);
    this.ui.addToLeftColumn('performance');

    const gameInfoPanel = new GameInfoPanel(10, 0);
    gameInfoPanel.setVisible(false);
    this.ui.addPanel('gameInfo', gameInfoPanel);
    this.ui.addToLeftColumn('gameInfo');

    const aiInfoPanel = new AIInfoPanel(10, 0);
    aiInfoPanel.setVisible(false);
    this.ui.addPanel('aiInfo', aiInfoPanel);
    this.ui.addToLeftColumn('aiInfo');

    // Right column panels
    const aiObsPanel = new AIObservationPanel(0, 0);
    aiObsPanel.setVisible(false);
    this.ui.addPanel('aiObservation', aiObsPanel);
    this.ui.addToRightColumn('aiObservation');

    // Victory panel (overlay, hidden by default) - not in a column
    this.ui.addPanel('victory', new VictoryPanel(GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight));

    // Observer info panel (visible only in observer mode)
    const observerPanel = new ObserverInfoPanel(10, 10);
    observerPanel.setVisible(false);
    this.ui.addPanel('observerInfo', observerPanel);
  }

  async init(): Promise<void> {
    // Setup AI controllers if enabled
    if (AI_CONFIG.enabled && this.game) {
      await this.setupAIControllers();
    }

    // Start the game loop
    requestAnimationFrame((time) => this.loop(time));
  }

  private async setupAIControllers(): Promise<void> {
    if (!this.game) return;

    // Clear previous AI metadata
    this.aiModelMetadata = null;

    for (const playerId of AI_CONFIG.aiPlayers) {
      if (playerId < 0 || playerId >= GAME_CONFIG.playerCount) {
        console.warn(`Invalid AI player ID: ${playerId}, skipping`);
        continue;
      }

      let controller: AIController;

      if (AI_CONFIG.defaultAIType === 'neural') {
        // Try to load neural AI model
        try {
          const modelAvailable = await isModelAvailable(AI_CONFIG.neuralDifficulty);
          if (modelAvailable) {
            const { model, metadata } = await loadModelWithMetadata(AI_CONFIG.neuralDifficulty);

            // Use AsyncNeuralAI (Web Worker) if configured, otherwise blocking NeuralAI
            if (AI_CONFIG.useWebWorker) {
              const asyncAI = new AsyncNeuralAI(playerId, model);
              await asyncAI.waitForReady();
              controller = asyncAI;
            } else {
              controller = new NeuralAI(playerId, model);
            }

            // Store metadata for UI display (only need to store once since all AI use same model)
            this.aiModelMetadata = metadata;
          } else {
            // Fall back to aggressive AI
            console.warn(`Neural model not available for ${AI_CONFIG.neuralDifficulty}, falling back to AggressiveAI`);
            controller = new AggressiveAI(playerId);
          }
        } catch (error) {
          console.error(`Failed to load neural AI:`, error);
          controller = new AggressiveAI(playerId);
        }
      } else if (AI_CONFIG.defaultAIType === 'aggressive') {
        controller = new AggressiveAI(playerId);
        console.log(`Player ${playerId + 1}: Aggressive AI`);
      } else {
        controller = new RandomAI(playerId);
        console.log(`Player ${playerId + 1}: Random AI`);
      }

      this.game.setAIController(playerId, controller);
    }
  }

  setState(newState: AppState, _config?: GameConfig): void {
    console.log(`State transition: ${this.state} -> ${newState}`);
    this.state = newState;
  }

  update(dt: number): void {
    switch (this.state) {
      case 'playing':
        // Update game
        if (this.game) {
          this.game.update(dt);

          // Check for game over
          if (this.game.isGameOver()) {
            this.setState('gameover');
          }
        }
        break;
    }
  }

  render(): void {
    // Clear and draw background
    profiler.start('render');

    // Render based on state
    switch (this.state) {
      case 'playing':
      case 'gameover':
        this.renderer.drawBackground();
        if (this.game) {
          // Draw particles first (behind obstacles)
          const conversionProgress = this.game.getConversionProgressMap();
          const convertingColors = this.game.getConvertingPlayerColorMap();
          this.renderer.drawParticles(this.game.getParticles(), conversionProgress, convertingColors);
          // Draw obstacles on top of particles
          this.renderer.drawObstacles(this.game.getObstacles());
          // Draw player cursors on top
          this.renderer.drawPlayers(this.game.getPlayers());
        }
        break;

      case 'observing':
        // Observer mode - render from network frames
        if (this.networkRenderer && this.latestFrame) {
          this.networkRenderer.renderFrame(this.latestFrame);

          // Draw game over overlay if applicable
          if (this.observerGameOver) {
            this.networkRenderer.drawGameOver(
              this.observerGameOver.winner,
              this.observerGameOver.stats
            );
          }

          // Update UI with observer data
          const observerUIData = this.buildObserverUIData();
          this.ui.update(observerUIData);
          this.ui.render(this.renderer.getContext());
        } else {
          // Waiting for first frame - show loading
          this.renderer.drawBackground();
          const ctx = this.canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#888';
            ctx.fillText('Press Escape to return to game', this.canvas.width / 2, this.canvas.height / 2 + 40);
          }
        }
        break;
    }
    profiler.end('render');

    // Update DOM-based UI components
    this.updateUIComponents();

    // Update and render debug overlay panels (only for regular game modes)
    if (this.game && this.state !== 'observing') {
      const uiData = this.buildUIData();
      this.ui.update(uiData);
      this.ui.layoutColumns(this.renderer.width); // Reposition panels based on heights
      this.ui.render(this.renderer.getContext());
    }
  }

  private updateUIComponents(): void {
    if (this.state === 'observing') {
      // Observer mode - update from frame data
      if (this.latestFrame && this.observerScenario) {
        const frame = this.latestFrame;
        const totalParticles = frame.players.reduce((sum, p) => sum + p.particleCount, 0);

        // Update power bar
        this.powerBar.update(frame.players.map((p, i) => ({
          id: i,
          color: this.observerPlayerColors[p.colorIndex] ?? '#888',
          particleCount: p.particleCount,
        })));

        // Update status panel for observer mode
        this.statusPanel.updateObserver(
          {
            scenarioName: this.observerScenario.name,
            scenarioDescription: this.observerScenario.description,
            currentStep: frame.step,
            maxSteps: this.observerScenario.maxSteps,
            gameOver: frame.gameOver,
            winner: frame.winner,
          },
          frame.players.map((p, i) => ({
            id: i,
            color: this.observerPlayerColors[p.colorIndex] ?? '#888',
            colorName: `Player ${i + 1}`,
            particleCount: p.particleCount,
            isAI: true,
          })),
          totalParticles
        );
      }
    } else if (this.game) {
      // Regular game mode
      const players = this.game.getPlayers();
      const particles = this.game.getParticles();
      const winner = this.game.getWinnerPlayer();

      // Update power bar
      this.powerBar.update(players.map(p => ({
        id: p.id,
        color: p.color,
        particleCount: p.particleCount,
      })));

      // Update status panel
      this.statusPanel.updateGame({
        mode: this.state === 'gameover' ? 'gameover' : 'playing',
        players: players.map(p => ({
          id: p.id,
          color: p.color,
          colorName: PLAYER_COLOR_NAMES[p.id % PLAYER_COLOR_NAMES.length],
          particleCount: p.particleCount,
          isAI: p.isAI,
        })),
        totalParticles: particles.length,
        winner: winner ? {
          id: winner.id,
          color: winner.color,
          colorName: PLAYER_COLOR_NAMES[winner.id % PLAYER_COLOR_NAMES.length],
          particleCount: winner.particleCount,
          isAI: winner.isAI,
        } : undefined,
        fps: this.fps,
      });
    }
  }

  private buildUIData(): UIData {
    if (!this.game) return {};

    const particles = this.game.getParticles();
    const players = this.game.getPlayers();
    const spatialStats = this.game.getSpatialHashStats();
    const winner = this.game.getWinnerPlayer();

    // Build AI observations if debug panels are visible (only for non-eliminated players)
    let aiObservations: UIData['aiObservations'] = undefined;
    if (this.showDebugPanels && AI_CONFIG.enabled) {
      aiObservations = AI_CONFIG.aiPlayers
        .filter(playerId => players[playerId]?.particleCount > 0)
        .map(playerId => ({
          playerId,
          playerColor: players[playerId]?.color || '#ffffff',
          observation: this.observationEncoder.encode3D(this.game!, playerId),
        }));
    }

    return {
      fps: this.fps,
      particleCount: particles.length,
      obstacleCount: this.game.getObstacles().length,
      gridCells: spatialStats.cellCount,
      profilerStats: profiler.getAllStats(),
      hierarchicalStats: profiler.getHierarchicalStats(),
      totalFrameMs: profiler.getTotalMs(),
      aiModelInfo: this.aiModelMetadata ? {
        generation: this.aiModelMetadata.generation,
        bestFitness: this.aiModelMetadata.bestFitness,
        averageFitness: this.aiModelMetadata.averageFitness,
      } : undefined,
      players: players.map(p => ({
        id: p.id,
        color: p.color,
        particleCount: p.particleCount,
        isAI: p.isAI,
      })),
      totalParticles: particles.length,
      winner: winner ? {
        id: winner.id,
        color: winner.color,
        particleCount: winner.particleCount,
        isAI: winner.isAI,
        colorName: PLAYER_COLOR_NAMES[winner.id % PLAYER_COLOR_NAMES.length],
      } : null,
      aiObservations,
      canvasWidth: this.renderer.width,
      canvasHeight: this.renderer.height,
      workerStats: AI_CONFIG.useWebWorker ? this.game.getWorkerStats() : undefined,
    };
  }

  private buildObserverUIData(): UIData {
    if (!this.latestFrame || !this.observerScenario) return {};

    const frame = this.latestFrame;
    const scenario = this.observerScenario;
    const queue = this.observerQueue;

    // Calculate total particles
    const totalParticles = frame.players.reduce((sum, p) => sum + p.particleCount, 0);

    return {
      observerData: {
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        currentStep: frame.step,
        maxSteps: scenario.maxSteps,
        gameOver: frame.gameOver,
        winner: frame.winner,
        players: frame.players.map((p, index) => ({
          id: index,
          color: this.observerPlayerColors[p.colorIndex] ?? '#888888',
          particleCount: p.particleCount,
        })),
        totalParticles,
        // Queue info
        scenarioIndex: queue?.currentIndex,
        totalScenarios: queue?.scenarios.length,
        completedResults: queue?.completedResults,
        queueComplete: queue?.queueComplete,
      },
    };
  }

  /**
   * Save balance test results to a downloadable JSON file
   */
  private saveBalanceTestResults(results: ScenarioResult[]): void {
    // Build summary report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.length,
        player0Wins: results.filter(r => r.winner === 0).length,
        player1Wins: results.filter(r => r.winner === 1).length,
        timeouts: results.filter(r => r.winner === -1).length,
        avgSteps: Math.round(results.reduce((sum, r) => sum + r.steps, 0) / results.length),
      },
      results: results.map(r => ({
        scenario: r.scenarioName,
        winner: r.winner === -1 ? 'timeout' : `Player ${r.winner + 1}`,
        steps: r.steps,
        duration: `${r.duration.toFixed(1)}s`,
        finalCounts: r.finalCounts,
      })),
      analysis: this.analyzeBalanceResults(results),
    };

    // Log to console for easy viewing
    console.log('\n=== BALANCE TEST RESULTS ===');
    console.log(JSON.stringify(report, null, 2));

    // Trigger file download
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-test-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Analyze balance test results to identify issues
   */
  private analyzeBalanceResults(results: ScenarioResult[]): string[] {
    const analysis: string[] = [];

    // Find corner vs open comparisons
    const corner2to1 = results.find(r => r.scenarioName.includes('Corner') && r.scenarioName.includes('2:1'));
    const open2to1 = results.find(r => r.scenarioName.includes('Open') && r.scenarioName.includes('2:1'));
    const cornerEven = results.find(r => r.scenarioName.includes('Corner') && r.scenarioName.includes('Even'));
    const openEven = results.find(r => r.scenarioName.includes('Open') && r.scenarioName.includes('Even'));

    // Analyze 2:1 matchups
    if (corner2to1 && open2to1) {
      if (corner2to1.winner === 0 && open2to1.winner === 1) {
        analysis.push('CORNER CAMPING DETECTED: Defender survives in corner but loses in open field');
      }
      if (corner2to1.steps > open2to1.steps * 1.5) {
        analysis.push(`Corner extends game by ${Math.round((corner2to1.steps / open2to1.steps - 1) * 100)}% - defensive advantage too strong`);
      }
    }

    // Analyze even matchups
    if (cornerEven && openEven) {
      if (cornerEven.winner !== openEven.winner) {
        analysis.push(`Position matters: Corner favors P${(cornerEven.winner ?? 0) + 1}, Open favors P${(openEven.winner ?? 0) + 1}`);
      }
    }

    // Check for timeouts
    const timeouts = results.filter(r => r.winner === -1);
    if (timeouts.length > 0) {
      analysis.push(`${timeouts.length} timeout(s) - games taking too long to resolve`);
    }

    if (analysis.length === 0) {
      analysis.push('No obvious balance issues detected');
    }

    return analysis;
  }

  async restartGame(): Promise<void> {
    console.log('Restarting game...');

    // Destroy old game
    if (this.game) {
      this.game.destroy();
    }

    // Clear model cache to pick up any updated models
    clearModelCache();

    // Create new game with same config
    const config: GameConfig = {
      playerCount: GAME_CONFIG.playerCount,
      particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
    };

    this.game = new Game(config, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);
    this.game.setCanvas(this.canvas);

    this.console.system('Game restarted');

    // Re-setup AI controllers
    if (AI_CONFIG.enabled) {
      await this.setupAIControllers();
    }

    // Reset state
    this.setState('playing');

    console.log('Game restarted');
  }

  /**
   * Start observer mode - watch AI battle running in worker
   */
  async startObserverMode(): Promise<void> {
    console.log('Starting observer mode...');

    // Clean up any existing observer mode (without restoring regular game)
    this.cleanupObserverMode();

    // Destroy any existing game
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }

    // Load balance test scenarios
    const scenarios = loadBalanceScenarios();
    if (scenarios.length === 0) {
      console.error('No balance test scenarios found');
      return;
    }
    console.log(`Loaded ${scenarios.length} balance test scenarios`);

    // Initialize queue tracking
    this.observerQueue = {
      scenarios,
      currentIndex: 0,
      completedResults: [],
      queueComplete: false,
    };

    // Create network renderer
    this.networkRenderer = new NetworkRenderer(this.canvas);

    // Create game client with callbacks
    this.gameClient = new GameClient({
      onReady: () => {
        console.log('Game worker ready');
      },
      onScenarioLoaded: (scenario: ScenarioConfig, obstacles: ObstacleData[]) => {
        console.log(`Scenario loaded: ${scenario.name}`);
        if (this.networkRenderer) {
          this.networkRenderer.setObstacles(obstacles);
        }
        // Update current scenario info for UI
        this.observerScenario = {
          name: scenario.name,
          description: scenario.description,
          maxSteps: scenario.test?.maxSteps ?? 3600,
        };
        // Update queue index
        if (this.observerQueue) {
          // Find the index of this scenario
          const idx = this.observerQueue.scenarios.findIndex(s => s.name === scenario.name);
          if (idx >= 0) {
            this.observerQueue.currentIndex = idx;
          }
        }
      },
      onGameStart: (info) => {
        console.log(`Game started: ${info.playerCount} players, ${info.canvasWidth}x${info.canvasHeight}`);
        if (this.networkRenderer) {
          this.networkRenderer.resize(info.canvasWidth, info.canvasHeight);
          this.networkRenderer.setPlayerColors(info.playerColors);
        }
        // Store player colors for UI
        this.observerPlayerColors = info.playerColors;
        // Clear game over state for new scenario
        this.observerGameOver = null;
      },
      onFrame: (frame: FrameData) => {
        this.latestFrame = frame;
      },
      onGameOver: (winner, stats) => {
        console.log(`Game over! Player ${winner + 1} wins in ${stats.steps} steps`);
        this.observerGameOver = { winner, stats };
      },
      onScenarioComplete: (scenarioIndex: number, totalScenarios: number, result: ScenarioResult) => {
        console.log(`Scenario ${scenarioIndex + 1}/${totalScenarios} complete: ${result.scenarioName}`);
        if (this.observerQueue) {
          this.observerQueue.completedResults.push({
            scenarioName: result.scenarioName,
            winner: result.winner,
            steps: result.steps,
          });
        }
      },
      onQueueComplete: (results: ScenarioResult[]) => {
        console.log('All scenarios complete!', results);
        if (this.observerQueue) {
          this.observerQueue.queueComplete = true;
        }
        // Save results to file
        this.saveBalanceTestResults(results);
      },
      onError: (error) => {
        console.error('Game client error:', error);
      },
    });

    // Connect to worker
    await this.gameClient.connect();

    // Store first scenario info for UI
    const firstScenario = scenarios[0];
    this.observerScenario = {
      name: firstScenario.name,
      description: firstScenario.description,
      maxSteps: firstScenario.test?.maxSteps ?? 3600,
    };

    // Start the queue with 2 second delay between scenarios
    this.gameClient.startQueue(scenarios, 2000);

    // Switch to observing state
    this.observerGameOver = null;
    this.latestFrame = null;
    this.setState('observing');

    // Show observer info panel
    this.ui.setPanelVisible('observerInfo', true);

    console.log('Observer mode started');
  }

  /**
   * Clean up observer mode resources (without restoring game)
   */
  private cleanupObserverMode(): void {
    // Hide observer info panel
    this.ui.setPanelVisible('observerInfo', false);

    if (this.gameClient) {
      this.gameClient.disconnect();
      this.gameClient = null;
    }
    this.networkRenderer = null;
    this.latestFrame = null;
    this.observerGameOver = null;
    this.observerScenario = null;
    this.observerPlayerColors = [];
    this.observerQueue = null;
  }

  /**
   * Stop observer mode and return to regular play
   */
  async stopObserverMode(): Promise<void> {
    this.cleanupObserverMode();

    // Restore regular game
    await this.restartGame();
  }

  loop(timestamp: number): void {
    profiler.startFrame();

    // Calculate frame time
    const frameTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Calculate FPS
    this.frameCount++;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 1.0) {
      this.fps = this.frameCount / this.fpsTime;
      this.frameCount = 0;
      this.fpsTime = 0;
    }

    // Add to accumulator (clamped to prevent spiral of death)
    this.accumulator += Math.min(frameTime, GAME_LOOP_CONFIG.maxAccumulator);

    // Fixed timestep updates (may run multiple times per visual frame)
    while (this.accumulator >= GAME_LOOP_CONFIG.fixedDt) {
      this.update(GAME_LOOP_CONFIG.fixedDt);
      this.accumulator -= GAME_LOOP_CONFIG.fixedDt;
    }

    // Render
    this.render();

    profiler.endFrame();

    // Continue loop
    requestAnimationFrame((time) => this.loop(time));
  }
}

// Initialize and start the application
const app = new App();
app.init();
