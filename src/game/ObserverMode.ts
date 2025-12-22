// ObserverMode - Manages spectating games running in a Web Worker
// Handles scenario queue, frame reception, and result tracking

import { GameClient, type ScenarioResult } from '../network/GameClient';
import { NetworkRenderer } from '../ui/NetworkRenderer';
import type { FrameData } from '../network/protocol';
import type { ScenarioConfig } from './scenario';
import type { ObstacleData } from '../types';
import * as yaml from 'js-yaml';

// Import balance test scenarios using Vite's glob import
const balanceScenarioModules = import.meta.glob('../../scenarios/balance/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

export interface ObserverCallbacks {
  onStateChange?: (state: ObserverState) => void;
  onScenarioChange?: (scenario: ScenarioInfo) => void;
  onFrameUpdate?: (frame: FrameData) => void;
  onQueueComplete?: (results: ScenarioResult[]) => void;
  onError?: (error: Error) => void;
}

export interface ScenarioInfo {
  name: string;
  description?: string;
  maxSteps: number;
}

export interface QueueState {
  scenarios: ScenarioConfig[];
  currentIndex: number;
  completedResults: Array<{ scenarioName: string; winner: number; steps: number }>;
  queueComplete: boolean;
}

export type ObserverState = 'idle' | 'connecting' | 'running' | 'complete';

export class ObserverMode {
  private gameClient: GameClient | null = null;
  private networkRenderer: NetworkRenderer | null = null;
  private canvas: HTMLCanvasElement;
  private callbacks: ObserverCallbacks;

  // State
  private state: ObserverState = 'idle';
  private latestFrame: FrameData | null = null;
  private currentScenario: ScenarioInfo | null = null;
  private playerColors: string[] = [];
  private gameOver: { winner: number; stats: { steps: number; duration: number; finalCounts: number[] } } | null = null;

  // Queue tracking
  private queue: QueueState | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: ObserverCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
  }

  /**
   * Load all balance test scenarios from YAML files
   */
  static loadBalanceScenarios(): ScenarioConfig[] {
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

  /**
   * Start observer mode with balance test scenarios
   */
  async start(): Promise<void> {
    console.log('Starting observer mode...');
    this.setState('connecting');

    // Clean up any existing state
    this.cleanup();

    // Load scenarios
    const scenarios = ObserverMode.loadBalanceScenarios();
    if (scenarios.length === 0) {
      const error = new Error('No balance test scenarios found');
      this.callbacks.onError?.(error);
      this.setState('idle');
      return;
    }
    console.log(`Loaded ${scenarios.length} balance test scenarios`);

    // Initialize queue
    this.queue = {
      scenarios,
      currentIndex: 0,
      completedResults: [],
      queueComplete: false,
    };

    // Create network renderer
    this.networkRenderer = new NetworkRenderer(this.canvas);

    // Create game client
    this.gameClient = new GameClient({
      onReady: () => {
        console.log('Game worker ready');
      },
      onScenarioLoaded: (scenario: ScenarioConfig, obstacles: ObstacleData[]) => {
        console.log(`Scenario loaded: ${scenario.name}`);
        this.networkRenderer?.setObstacles(obstacles);

        // Update current scenario info
        this.currentScenario = {
          name: scenario.name,
          description: scenario.description,
          maxSteps: scenario.test?.maxSteps ?? 3600,
        };

        // Update queue index
        if (this.queue) {
          const idx = this.queue.scenarios.findIndex(s => s.name === scenario.name);
          if (idx >= 0) {
            this.queue.currentIndex = idx;
          }
        }

        this.callbacks.onScenarioChange?.(this.currentScenario);
      },
      onGameStart: (info) => {
        console.log(`Game started: ${info.playerCount} players, ${info.canvasWidth}x${info.canvasHeight}`);
        this.networkRenderer?.resize(info.canvasWidth, info.canvasHeight);
        this.networkRenderer?.setPlayerColors(info.playerColors);
        this.playerColors = info.playerColors;

        // Resize canvas
        this.canvas.width = info.canvasWidth;
        this.canvas.height = info.canvasHeight + 40; // Power bar height

        // Clear game over state
        this.gameOver = null;
        this.setState('running');
      },
      onFrame: (frame: FrameData) => {
        this.latestFrame = frame;
        this.callbacks.onFrameUpdate?.(frame);
      },
      onGameOver: (winner, stats) => {
        console.log(`Game over! Player ${winner + 1} wins in ${stats.steps} steps`);
        this.gameOver = { winner, stats };
      },
      onScenarioComplete: (scenarioIndex: number, totalScenarios: number, result: ScenarioResult) => {
        console.log(`Scenario ${scenarioIndex + 1}/${totalScenarios} complete: ${result.scenarioName}`);
        if (this.queue) {
          this.queue.completedResults.push({
            scenarioName: result.scenarioName,
            winner: result.winner,
            steps: result.steps,
          });
        }
      },
      onQueueComplete: (results: ScenarioResult[]) => {
        console.log('All scenarios complete!', results);
        if (this.queue) {
          this.queue.queueComplete = true;
        }
        this.setState('complete');
        this.callbacks.onQueueComplete?.(results);
      },
      onError: (error) => {
        console.error('Game client error:', error);
        this.callbacks.onError?.(error);
      },
    });

    // Connect to worker
    await this.gameClient.connect();

    // Store first scenario info
    const firstScenario = scenarios[0];
    this.currentScenario = {
      name: firstScenario.name,
      description: firstScenario.description,
      maxSteps: firstScenario.test?.maxSteps ?? 3600,
    };

    // Start the queue
    this.gameClient.startQueue(scenarios, 2000);
    this.setState('running');

    console.log('Observer mode started');
  }

  /**
   * Stop observer mode
   */
  stop(): void {
    this.cleanup();
    this.setState('idle');
  }

  /**
   * Clean up resources without changing state
   */
  private cleanup(): void {
    if (this.gameClient) {
      this.gameClient.disconnect();
      this.gameClient = null;
    }
    this.networkRenderer = null;
    this.latestFrame = null;
    this.gameOver = null;
    this.currentScenario = null;
    this.playerColors = [];
    this.queue = null;
  }

  /**
   * Render the current frame
   */
  render(): void {
    if (this.networkRenderer && this.latestFrame) {
      this.networkRenderer.renderFrame(this.latestFrame);

      if (this.gameOver) {
        this.networkRenderer.drawGameOver(
          this.gameOver.winner,
          this.gameOver.stats
        );
      }
    }
  }

  /**
   * Get current state
   */
  getState(): ObserverState {
    return this.state;
  }

  /**
   * Get the latest frame
   */
  getLatestFrame(): FrameData | null {
    return this.latestFrame;
  }

  /**
   * Get current scenario info
   */
  getCurrentScenario(): ScenarioInfo | null {
    return this.currentScenario;
  }

  /**
   * Get player colors
   */
  getPlayerColors(): string[] {
    return this.playerColors;
  }

  /**
   * Get queue state
   */
  getQueueState(): QueueState | null {
    return this.queue;
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.gameOver !== null;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  private setState(state: ObserverState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }
}
