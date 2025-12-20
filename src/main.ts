// Fluid Wars - Main Application Entry Point

import type { AppState, GameConfig } from './types';
import { PLAYER_COLOR_NAMES } from './types';
import { Game } from './game';
import { Renderer, POWER_BAR_HEIGHT } from './renderer';
import { GAME_CONFIG, GAME_LOOP_CONFIG, AI_CONFIG } from './config';
import { AggressiveAI, RandomAI } from './ai/AIController';
import { NeuralAI } from './ai/NeuralAI';
import { loadModelWithMetadata, isModelAvailable, clearModelCache } from './ai/ModelLoader';
import type { AIController } from './ai/AIController';
import type { ModelMetadata } from './ai/ModelLoader';

class App {
  private state: AppState = 'playing'; // Start in playing state for now
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsTime: number = 0;

  // Game state
  private game: Game | null = null;

  // AI metadata (for displaying generation info)
  private aiModelMetadata: ModelMetadata | null = null;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }

    // Resize canvas to fit window (with small padding)
    const padding = 20;
    this.canvas.width = window.innerWidth - padding * 2;
    this.canvas.height = window.innerHeight - padding * 2;

    // Create renderer
    this.renderer = new Renderer(this.canvas);

    // Create game with config
    const config: GameConfig = {
      playerCount: GAME_CONFIG.playerCount,
      particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
    };

    this.game = new Game(config, this.renderer.width, this.renderer.gameHeight);

    // Setup restart key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.state === 'gameover') {
          this.restartGame();
        }
      }
    });

    console.log('Fluid Wars initialized');
    console.log(`Canvas size: ${this.renderer.width}x${this.renderer.height}`);
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
            controller = new NeuralAI(playerId, model);
            // Store metadata for UI display (only need to store once since all AI use same model)
            this.aiModelMetadata = metadata;
            const genInfo = metadata.generation !== null ? ` gen ${metadata.generation}` : '';
            console.log(`Player ${playerId + 1}: Neural AI (${AI_CONFIG.neuralDifficulty}${genInfo})`);
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
    this.renderer.drawBackground();

    // Render based on state
    switch (this.state) {
      case 'playing':
      case 'gameover':
        if (this.game) {
          // Draw obstacles first (behind particles)
          this.renderer.drawObstacles(this.game.getObstacles());
          // Draw particles with conversion progress
          const conversionProgress = this.game.getConversionProgressMap();
          const convertingColors = this.game.getConvertingPlayerColorMap();
          this.renderer.drawParticles(this.game.getParticles(), conversionProgress, convertingColors);
          // Draw player cursors on top
          this.renderer.drawPlayers(this.game.getPlayers());
          // Draw power distribution bar
          this.renderer.drawPowerBar(this.game.getPlayers(), this.game.getParticles().length);

          // Draw victory screen overlay if game over
          if (this.state === 'gameover') {
            this.renderVictoryScreen();
          }
        }
        break;
    }

    // Draw debug info
    if (this.game) {
      const particleCount = this.game.getParticles().length;
      const obstacleCount = this.game.getObstacles().length;
      const spatialStats = this.game.getSpatialHashStats();

      const debugY = POWER_BAR_HEIGHT + 20;
      this.renderer.drawDebugText(`FPS: ${this.fps.toFixed(1)} | Particles: ${particleCount} | Obstacles: ${obstacleCount} | Grid Cells: ${spatialStats.cellCount}`, 10, debugY);

      // Show AI model info
      if (this.aiModelMetadata) {
        const gen = this.aiModelMetadata.generation !== null ? this.aiModelMetadata.generation : '?';
        const best = this.aiModelMetadata.bestFitness !== null ? this.aiModelMetadata.bestFitness.toFixed(1) : '?';
        const avg = this.aiModelMetadata.averageFitness !== null ? this.aiModelMetadata.averageFitness.toFixed(1) : '?';
        this.renderer.drawDebugText(
          `AI Model: Gen ${gen} | Best: ${best} | Avg: ${avg}`,
          10,
          debugY + 20
        );
      }
    }
  }

  renderVictoryScreen(): void {
    if (!this.game) return;

    const winner = this.game.getWinnerPlayer();
    if (!winner) return;

    const ctx = this.renderer.ctx;
    const centerX = this.renderer.width / 2;
    const centerY = this.renderer.height / 2;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

    // Draw victory message
    ctx.fillStyle = winner.color;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VICTORY!', centerX, centerY - 80);

    // Draw player info
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px sans-serif';
    const colorName = PLAYER_COLOR_NAMES[winner.id % PLAYER_COLOR_NAMES.length];
    const playerType = winner.isAI ? 'AI' : (winner.id === 0 ? 'WASD' : 'Arrows');
    ctx.fillText(`${colorName} (${playerType}) Wins!`, centerX, centerY);

    // Draw particle count
    ctx.font = '24px sans-serif';
    ctx.fillText(`${winner.particleCount} particles remaining`, centerX, centerY + 50);

    // Draw restart instruction
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Press R to restart', centerX, centerY + 120);
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

    this.game = new Game(config, this.renderer.width, this.renderer.gameHeight);

    // Re-setup AI controllers
    if (AI_CONFIG.enabled) {
      await this.setupAIControllers();
    }

    // Reset state
    this.setState('playing');

    console.log('Game restarted');
  }

  loop(timestamp: number): void {
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

    // Fixed timestep updates
    while (this.accumulator >= GAME_LOOP_CONFIG.fixedDt) {
      this.update(GAME_LOOP_CONFIG.fixedDt);
      this.accumulator -= GAME_LOOP_CONFIG.fixedDt;
    }

    // Render
    this.render();

    // Continue loop
    requestAnimationFrame((time) => this.loop(time));
  }
}

// Initialize and start the application
const app = new App();
app.init();
