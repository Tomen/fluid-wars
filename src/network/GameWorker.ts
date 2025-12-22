// GameWorker - Runs game simulation in a Web Worker
// Uses double-buffer pattern for zero-copy frame transfer

/// <reference lib="webworker" />

import { GameSimulator } from '../core/GameSimulator';
import type { ScenarioConfig } from '../game/scenario';
import type { AIAction } from '../core/AIInterface';
import { PLAYER_COLORS } from '../types';
import {
  encodeFrame,
  createDoubleBuffers,
  type FrameData,
  type ClientMessage,
  type GameStartMessage,
  type LoadScenarioMessage,
  type FrameMessage,
  type GameOverMessage,
  type ScenarioCompleteMessage,
  type QueueCompleteMessage,
} from './protocol';

export interface GameWorkerConfig {
  frameRate: number; // Frames per second to broadcast (default: 30)
}

const DEFAULT_CONFIG: GameWorkerConfig = {
  frameRate: 30,
};

// Worker-safe postMessage wrapper (with proper typing via /// reference lib="webworker")
function postMessageToMain(message: unknown, transfer?: Transferable[]): void {
  self.postMessage(message, transfer ? { transfer } : undefined);
}

export class GameWorker {
  private simulator: GameSimulator | null = null;
  private config: GameWorkerConfig;

  // Double buffer pattern
  private buffers: [ArrayBuffer | null, ArrayBuffer | null] = [null, null];
  private activeBuffer = 0;

  // Game loop
  private loopInterval: ReturnType<typeof setInterval> | null = null;
  private stepCount = 0;
  private startTime = 0;

  // Fixed cursor targets for balance test mode
  private fixedTargets: Map<number, AIAction> | null = null;

  // Scenario queue support
  private scenarioQueue: ScenarioConfig[] = [];
  private currentScenarioIndex = 0;
  private delayBetweenScenarios = 2000; // ms
  private queueResults: Array<{
    scenarioName: string;
    winner: number;
    steps: number;
    duration: number;
    finalCounts: number[];
  }> = [];

  constructor(config: Partial<GameWorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle incoming messages from the main thread
   */
  handleMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case 'start':
        this.start(msg.scenario);
        break;

      case 'start_queue':
        this.startQueue(msg.scenarios, msg.delayBetweenMs);
        break;

      case 'buffer_return':
        // Buffer returned from main thread, store it for reuse
        this.buffers[1 - this.activeBuffer] = msg.buffer;
        break;

      case 'input':
        // TODO: Handle player input for multiplayer mode
        break;

      default:
        console.warn('Unknown message type:', (msg as { type: string }).type);
    }
  }

  /**
   * Start a queue of scenarios
   */
  private startQueue(scenarios: ScenarioConfig[], delayBetweenMs?: number): void {
    this.scenarioQueue = scenarios;
    this.currentScenarioIndex = 0;
    this.delayBetweenScenarios = delayBetweenMs ?? 2000;
    this.queueResults = [];

    if (scenarios.length > 0) {
      this.start(scenarios[0]);
    }
  }

  /**
   * Start a new game with the given scenario
   */
  private start(scenario?: ScenarioConfig): void {
    // Stop any existing game
    this.stop();

    // Create simulator with scenario config
    const simConfig = scenario ? {
      playerCount: scenario.game.playerCount,
      particlesPerPlayer: scenario.game.particlesPerPlayer ?? 100,
      canvasWidth: scenario.game.canvasWidth,
      canvasHeight: scenario.game.canvasHeight,
      maxSteps: scenario.test?.maxSteps ?? 3600,
      winConfig: scenario.win,
    } : {};

    this.simulator = new GameSimulator(simConfig, {}, scenario);

    // Get initial state to know particle count for buffer sizing
    const game = this.simulator.getGame();
    const particles = game.getParticles();
    const players = game.getPlayers();

    // Create double buffers
    this.buffers = createDoubleBuffers(particles.length, players.length);
    this.activeBuffer = 0;

    // Set up fixed cursor targets if this is a balance test
    if (scenario?.test?.cursorTargets) {
      this.fixedTargets = new Map();
      for (let i = 0; i < scenario.game.playerCount; i++) {
        const target = scenario.test.cursorTargets[i];
        if (target) {
          this.fixedTargets.set(i, {
            targetX: target.x / scenario.game.canvasWidth,
            targetY: target.y / scenario.game.canvasHeight,
          });
        }
      }
    } else {
      this.fixedTargets = null;
    }

    // Get obstacle data from the game
    const obstacles = game.getObstacles().map(o => o.getData());

    // Send load_scenario message
    const loadMsg: LoadScenarioMessage = {
      type: 'load_scenario',
      scenario: scenario || this.createDefaultScenario(),
      obstacles,
    };
    postMessageToMain(loadMsg);

    // Send game_start message
    const startMsg: GameStartMessage = {
      type: 'game_start',
      canvasWidth: this.simulator.getConfig().canvasWidth,
      canvasHeight: this.simulator.getConfig().canvasHeight,
      playerCount: players.length,
      playerColors: players.map((_, i) => PLAYER_COLORS[i % PLAYER_COLORS.length]),
    };
    postMessageToMain(startMsg);

    // Reset step counter and start time
    this.stepCount = 0;
    this.startTime = Date.now();

    // Start game loop
    const frameInterval = 1000 / this.config.frameRate;
    this.loopInterval = setInterval(() => this.gameLoop(), frameInterval);
  }

  /**
   * Main game loop - runs at configured frame rate
   */
  private gameLoop(): void {
    if (!this.simulator) return;

    // Create actions map
    const actions = this.fixedTargets || new Map<number, AIAction>();

    // Step simulation
    const result = this.simulator.step(actions);
    this.stepCount++;

    // Get current game state
    const game = this.simulator.getGame();
    const players = game.getPlayers();
    const particles = game.getParticles();

    // Build frame data
    const frameData: FrameData = {
      step: this.stepCount,
      canvasWidth: this.simulator.getConfig().canvasWidth,
      canvasHeight: this.simulator.getConfig().canvasHeight,
      gameOver: result.done,
      winner: result.winner,
      players: players.map((p, i) => ({
        cursorX: p.cursorX,
        cursorY: p.cursorY,
        particleCount: p.particleCount,
        colorIndex: i,
      })),
      particles: particles.map(p => ({
        x: p.x,
        y: p.y,
        owner: p.owner,
      })),
    };

    // Encode frame into buffer
    const buffer = this.buffers[this.activeBuffer];
    if (buffer) {
      const encodedBuffer = encodeFrame(frameData, buffer);

      // Send frame with transferable buffer
      const frameMsg: FrameMessage = {
        type: 'frame',
        buffer: encodedBuffer,
      };
      postMessageToMain(frameMsg, [encodedBuffer]);

      // Clear our reference (ownership transferred)
      this.buffers[this.activeBuffer] = null;

      // Switch to other buffer
      this.activeBuffer = 1 - this.activeBuffer;
    } else {
      // No buffer available (main thread hasn't returned it yet)
      // Skip this frame - this can happen if main thread is slow
      console.warn('No buffer available for frame', this.stepCount);
    }

    // Check for game over
    if (result.done) {
      this.stop();

      const duration = (Date.now() - this.startTime) / 1000;
      const finalCounts = players.map(p => p.particleCount);
      const currentScenario = this.scenarioQueue[this.currentScenarioIndex];

      // If we're running a queue, handle scenario completion
      if (this.scenarioQueue.length > 0) {
        // Store result
        this.queueResults.push({
          scenarioName: currentScenario?.name ?? 'Unknown',
          winner: result.winner,
          steps: this.stepCount,
          duration,
          finalCounts,
        });

        // Send scenario_complete message
        const scenarioCompleteMsg: ScenarioCompleteMessage = {
          type: 'scenario_complete',
          scenarioIndex: this.currentScenarioIndex,
          totalScenarios: this.scenarioQueue.length,
          scenarioName: currentScenario?.name ?? 'Unknown',
          winner: result.winner,
          stats: {
            steps: this.stepCount,
            duration,
            finalCounts,
          },
        };
        postMessageToMain(scenarioCompleteMsg);

        // Check if there are more scenarios
        if (this.currentScenarioIndex < this.scenarioQueue.length - 1) {
          // Start next scenario after delay
          this.currentScenarioIndex++;
          setTimeout(() => {
            this.start(this.scenarioQueue[this.currentScenarioIndex]);
          }, this.delayBetweenScenarios);
        } else {
          // All scenarios complete
          const queueCompleteMsg: QueueCompleteMessage = {
            type: 'queue_complete',
            results: this.queueResults,
          };
          postMessageToMain(queueCompleteMsg);
        }
      } else {
        // Single scenario mode - send regular game_over
        const gameOverMsg: GameOverMessage = {
          type: 'game_over',
          winner: result.winner,
          stats: {
            steps: this.stepCount,
            duration,
            finalCounts,
          },
        };
        postMessageToMain(gameOverMsg);
      }
    }
  }

  /**
   * Stop the current game
   */
  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    if (this.simulator) {
      this.simulator.destroy();
      this.simulator = null;
    }
  }

  /**
   * Create a default scenario when none is provided
   */
  private createDefaultScenario(): ScenarioConfig {
    return {
      name: 'Default Game',
      game: {
        playerCount: 2,
        particlesPerPlayer: 100,
        canvasWidth: 1200,
        canvasHeight: 800,
      },
      win: {
        mode: 'percentage',
        eliminationThreshold: 0,
        percentageThreshold: 0.9,
      },
    };
  }
}
