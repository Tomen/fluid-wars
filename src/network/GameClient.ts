// GameClient - Main thread client that connects to game worker
// Handles spawning the worker, receiving frames, and rendering

import type { ScenarioConfig } from '../scenario';
import type { ObstacleData } from '../types';
import {
  decodeFrame,
  type ServerMessage,
  type FrameData,
  type StartGameMessage,
  type StartQueueMessage,
  type BufferReturnMessage,
} from './protocol';

export interface ScenarioResult {
  scenarioName: string;
  winner: number;
  steps: number;
  duration: number;
  finalCounts: number[];
}

export interface GameClientCallbacks {
  onReady?: () => void;
  onScenarioLoaded?: (scenario: ScenarioConfig, obstacles: ObstacleData[]) => void;
  onGameStart?: (info: { canvasWidth: number; canvasHeight: number; playerCount: number; playerColors: string[] }) => void;
  onFrame?: (frame: FrameData, buffer: ArrayBuffer) => void;
  onGameOver?: (winner: number, stats: { steps: number; duration: number; finalCounts: number[] }) => void;
  onScenarioComplete?: (scenarioIndex: number, totalScenarios: number, result: ScenarioResult) => void;
  onQueueComplete?: (results: ScenarioResult[]) => void;
  onError?: (error: Error) => void;
}

export class GameClient {
  private worker: Worker | null = null;
  private callbacks: GameClientCallbacks;
  private isReady = false;

  // Latest frame data for external access
  private latestFrame: FrameData | null = null;

  constructor(callbacks: GameClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to the game worker
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Spawn worker using Vite's worker syntax
        this.worker = new Worker(
          new URL('./game.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent<ServerMessage | { type: 'ready' }>) => {
          this.handleMessage(e.data);
          if (e.data.type === 'ready') {
            this.isReady = true;
            resolve();
          }
        };

        this.worker.onerror = (e) => {
          const error = new Error(`Worker error: ${e.message}`);
          this.callbacks.onError?.(error);
          reject(error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Start a game with optional scenario
   */
  start(scenario?: ScenarioConfig): void {
    if (!this.worker) {
      throw new Error('Not connected - call connect() first');
    }

    const msg: StartGameMessage = {
      type: 'start',
      scenario,
    };
    this.worker.postMessage(msg);
  }

  /**
   * Start a queue of scenarios
   */
  startQueue(scenarios: ScenarioConfig[], delayBetweenMs?: number): void {
    if (!this.worker) {
      throw new Error('Not connected - call connect() first');
    }

    const msg: StartQueueMessage = {
      type: 'start_queue',
      scenarios,
      delayBetweenMs,
    };
    this.worker.postMessage(msg);
  }

  /**
   * Send cursor input (for player mode)
   */
  sendInput(cursorX: number, cursorY: number): void {
    if (!this.worker) return;

    this.worker.postMessage({
      type: 'input',
      cursorX,
      cursorY,
    });
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.latestFrame = null;
  }

  /**
   * Check if connected and ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Get the latest frame data
   */
  getLatestFrame(): FrameData | null {
    return this.latestFrame;
  }

  /**
   * Handle incoming messages from the worker
   */
  private handleMessage(msg: ServerMessage | { type: 'ready' }): void {
    switch (msg.type) {
      case 'ready':
        this.callbacks.onReady?.();
        break;

      case 'load_scenario':
        this.callbacks.onScenarioLoaded?.(msg.scenario, msg.obstacles);
        break;

      case 'game_start':
        this.callbacks.onGameStart?.({
          canvasWidth: msg.canvasWidth,
          canvasHeight: msg.canvasHeight,
          playerCount: msg.playerCount,
          playerColors: msg.playerColors,
        });
        break;

      case 'frame':
        this.handleFrame(msg.buffer);
        break;

      case 'game_over':
        this.callbacks.onGameOver?.(msg.winner, msg.stats);
        break;

      case 'scenario_complete':
        this.callbacks.onScenarioComplete?.(
          msg.scenarioIndex,
          msg.totalScenarios,
          {
            scenarioName: msg.scenarioName,
            winner: msg.winner,
            steps: msg.stats.steps,
            duration: msg.stats.duration,
            finalCounts: msg.stats.finalCounts,
          }
        );
        break;

      case 'queue_complete':
        this.callbacks.onQueueComplete?.(msg.results);
        break;

      default:
        console.warn('Unknown message type:', (msg as { type: string }).type);
    }
  }

  /**
   * Handle an incoming frame buffer
   */
  private handleFrame(buffer: ArrayBuffer): void {
    // Decode the binary frame
    const frame = decodeFrame(buffer);
    this.latestFrame = frame;

    // Notify callback
    this.callbacks.onFrame?.(frame, buffer);

    // Return the buffer to the worker for reuse
    this.returnBuffer(buffer);
  }

  /**
   * Return a buffer to the worker (for double-buffer pattern)
   */
  private returnBuffer(buffer: ArrayBuffer): void {
    if (!this.worker) return;

    const msg: BufferReturnMessage = {
      type: 'buffer_return',
      buffer,
    };

    // Transfer the buffer back to the worker
    this.worker.postMessage(msg, [buffer]);
  }
}
