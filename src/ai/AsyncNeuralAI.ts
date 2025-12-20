// AsyncNeuralAI - Non-blocking AI controller using Web Worker
// Runs neural network inference in a separate thread

import type { Game } from '../game';
import type { AIAction } from '../core/AIInterface';
import type { AIController } from './AIController';
import type { RawParticle, RawObstacle } from './ObservationEncoder';
import { CNN_CONFIG } from '../config';
import { getWeights } from './CNNModel';
import type * as tf from '@tensorflow/tfjs';

/**
 * CNN config for worker (matches ai-worker.ts interface)
 */
interface CNNConfig {
  gridRows: number;
  gridCols: number;
  channels: number;
  conv1Filters: number;
  conv2Filters: number;
  kernelSize: number;
  denseUnits: number;
}

/**
 * AsyncNeuralAI - Non-blocking neural network AI using Web Workers
 *
 * This controller runs the CNN inference in a separate thread, allowing
 * the main game loop to continue without waiting. It returns the last
 * computed action immediately while queuing new computation requests.
 *
 * Key characteristics:
 * - Non-blocking: getAction() returns immediately with cached result
 * - Asynchronous: New actions computed in background and cached when ready
 * - Latency: 1-2 frame delay between game state and AI decision (imperceptible)
 */
export class AsyncNeuralAI implements AIController {
  readonly playerId: number;
  private worker: Worker | null = null;
  private workerReady: boolean = false;
  private pendingRequest: boolean = false;
  private lastAction: AIAction = { targetX: 0.5, targetY: 0.5 };
  private name: string;
  private initPromise: Promise<void> | null = null;

  // Stats for debugging
  private computeCount: number = 0;
  private totalComputeTime: number = 0;
  private totalEncodeTime: number = 0;
  private totalPredictTime: number = 0;
  private lastComputeTime: number = 0;

  /**
   * Create an AsyncNeuralAI controller
   *
   * @param playerId The player ID this AI controls
   * @param model The TensorFlow model (weights will be extracted and sent to worker)
   * @param name Optional name for this AI instance
   */
  constructor(playerId: number, model: tf.Sequential, name?: string) {
    this.playerId = playerId;
    this.name = name || 'AsyncNeuralAI';

    // Initialize worker
    this.initPromise = this.initWorker(model);
  }

  /**
   * Initialize the Web Worker
   */
  private async initWorker(model: tf.Sequential): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create worker using Vite's worker import
      this.worker = new Worker(
        new URL('./ai-worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Handle messages from worker
      this.worker.onmessage = (e) => {
        const data = e.data;

        if (data.type === 'ready') {
          console.log(`[AsyncNeuralAI] Worker ready for player ${this.playerId}`);
          this.workerReady = true;
          resolve();
        }

        if (data.type === 'action') {
          // Update cached action
          this.lastAction = {
            targetX: data.targetX,
            targetY: data.targetY,
          };
          this.pendingRequest = false;

          // Update stats
          this.computeCount++;
          this.lastComputeTime = data.computeTime;
          this.totalComputeTime += data.computeTime;
          this.totalEncodeTime += data.encodeTime;
          this.totalPredictTime += data.predictTime;
        }

        if (data.type === 'error') {
          console.error(`[AsyncNeuralAI] Worker error:`, data.message);
          this.pendingRequest = false;
        }
      };

      this.worker.onerror = (error) => {
        console.error(`[AsyncNeuralAI] Worker failed:`, error);
        reject(error);
      };

      // Extract weights from model and send init message
      const weights = getWeights(model);
      const cnnConfig: CNNConfig = {
        gridRows: CNN_CONFIG.gridRows,
        gridCols: CNN_CONFIG.gridCols,
        channels: CNN_CONFIG.channels,
        conv1Filters: CNN_CONFIG.conv1Filters,
        conv2Filters: CNN_CONFIG.conv2Filters,
        kernelSize: CNN_CONFIG.kernelSize,
        denseUnits: CNN_CONFIG.denseUnits,
      };

      this.worker.postMessage({
        type: 'init',
        modelWeights: Array.from(weights),
        cnnConfig,
      });
    });
  }

  getName(): string {
    return this.name;
  }

  /**
   * Get the AI's action for the current game state
   *
   * This method returns immediately with the last computed action.
   * It queues a new computation request if one isn't already pending.
   *
   * @param game The current game instance
   * @returns Action with normalized target position (cached from last computation)
   */
  getAction(game: Game): AIAction {
    // Queue new computation if worker is ready and no request pending
    if (this.workerReady && !this.pendingRequest && this.worker) {
      this.requestNewAction(game);
    }

    // Return cached action immediately (non-blocking)
    return this.lastAction;
  }

  /**
   * Send game state to worker for new action computation
   */
  private requestNewAction(game: Game): void {
    if (!this.worker) return;

    this.pendingRequest = true;

    // Extract raw particle data (serializable)
    const particles = game.getParticles();
    const rawParticles: RawParticle[] = particles.map(p => ({
      owner: p.owner,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
    }));

    // Extract raw obstacle data (serializable)
    const obstacles = game.getObstacles();
    const rawObstacles: RawObstacle[] = obstacles.map(o => {
      const data = o.getData();
      const raw: RawObstacle = { x: data.x, y: data.y };
      if (o.type === 'rect') {
        const rectData = data as { width: number; height: number; x: number; y: number };
        raw.width = rectData.width;
        raw.height = rectData.height;
      } else {
        const circleData = data as { radius: number; x: number; y: number };
        raw.radius = circleData.radius;
      }
      return raw;
    });

    const { width: canvasWidth, height: canvasHeight } = game.getCanvasSize();

    // Send compute request to worker
    this.worker.postMessage({
      type: 'compute',
      playerId: this.playerId,
      timestamp: performance.now(),
      particles: rawParticles,
      obstacles: rawObstacles,
      canvasWidth,
      canvasHeight,
    });
  }

  /**
   * Reset the controller's internal state
   */
  reset(): void {
    this.lastAction = { targetX: 0.5, targetY: 0.5 };
    this.pendingRequest = false;
    this.computeCount = 0;
    this.totalComputeTime = 0;
    this.totalEncodeTime = 0;
    this.totalPredictTime = 0;
    this.lastComputeTime = 0;
  }

  /**
   * Wait for worker to be ready
   * Call this before the first getAction() for guaranteed initialization
   */
  async waitForReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get whether the worker is ready
   */
  isReady(): boolean {
    return this.workerReady;
  }

  /**
   * Get performance stats
   */
  getStats(): {
    computeCount: number;
    avgComputeTime: number;
    avgEncodeTime: number;
    avgPredictTime: number;
    lastComputeTime: number;
  } {
    return {
      computeCount: this.computeCount,
      avgComputeTime: this.computeCount > 0 ? this.totalComputeTime / this.computeCount : 0,
      avgEncodeTime: this.computeCount > 0 ? this.totalEncodeTime / this.computeCount : 0,
      avgPredictTime: this.computeCount > 0 ? this.totalPredictTime / this.computeCount : 0,
      lastComputeTime: this.lastComputeTime,
    };
  }

  /**
   * Terminate the worker (cleanup)
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }
}
