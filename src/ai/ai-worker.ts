// AI Web Worker - Runs neural network inference in a separate thread
// Uses WASM backend for TensorFlow.js (works in workers, faster than CPU)

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import type { RawParticle, RawObstacle } from './ObservationEncoder';

/**
 * CNN config passed from main thread (can't import config.ts in worker due to top-level await)
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
 * Messages from main thread to worker
 */
interface AIWorkerInitMessage {
  type: 'init';
  modelWeights: number[];
  cnnConfig: CNNConfig;
}

interface AIWorkerComputeMessage {
  type: 'compute';
  playerId: number;
  timestamp: number;
  particles: RawParticle[];
  obstacles: RawObstacle[];
  canvasWidth: number;
  canvasHeight: number;
}

type AIWorkerMessage = AIWorkerInitMessage | AIWorkerComputeMessage;

/**
 * Messages from worker to main thread
 */
interface AIWorkerReadyResponse {
  type: 'ready';
}

interface AIWorkerActionResponse {
  type: 'action';
  playerId: number;
  targetX: number;
  targetY: number;
  computeTime: number;
  encodeTime: number;
  predictTime: number;
  timestamp: number;
}

interface AIWorkerErrorResponse {
  type: 'error';
  message: string;
}

type AIWorkerResponse = AIWorkerReadyResponse | AIWorkerActionResponse | AIWorkerErrorResponse;

// Worker state
let model: tf.Sequential | null = null;
let cnnConfig: CNNConfig | null = null;

/**
 * Create CNN model (duplicated from CNNModel.ts to avoid config.ts import)
 */
function createModel(config: CNNConfig): tf.Sequential {
  const model = tf.sequential();

  model.add(tf.layers.conv2d({
    inputShape: [config.gridRows, config.gridCols, config.channels],
    filters: config.conv1Filters,
    kernelSize: config.kernelSize,
    activation: 'relu',
    padding: 'same',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(tf.layers.conv2d({
    filters: config.conv2Filters,
    kernelSize: config.kernelSize,
    activation: 'relu',
    padding: 'same',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({
    units: config.denseUnits,
    activation: 'relu',
    kernelInitializer: 'glorotUniform',
  }));

  model.add(tf.layers.dense({
    units: 2,
    activation: 'sigmoid',
    kernelInitializer: 'glorotUniform',
  }));

  return model;
}

/**
 * Set model weights from flat array
 */
function setWeights(model: tf.Sequential, weights: Float32Array): void {
  let offset = 0;

  for (const layer of model.layers) {
    const layerWeights = layer.getWeights();
    const newWeights: tf.Tensor[] = [];

    for (const w of layerWeights) {
      const shape = w.shape;
      const size = w.size;
      const data = weights.slice(offset, offset + size);
      newWeights.push(tf.tensor(Array.from(data), shape));
      offset += size;
    }

    layer.setWeights(newWeights);
  }
}

/**
 * Run model prediction
 */
function predict(model: tf.Sequential, input: number[][][]): [number, number] {
  const inputTensor = tf.tensor4d([input]);
  const outputTensor = model.predict(inputTensor) as tf.Tensor;
  const output = outputTensor.dataSync();

  inputTensor.dispose();
  outputTensor.dispose();

  return [output[0], output[1]];
}

/**
 * Encode game state to observation grid (simplified from ObservationEncoder)
 */
function encodeObservation(
  playerId: number,
  particles: RawParticle[],
  obstacles: RawObstacle[],
  canvasWidth: number,
  canvasHeight: number,
  config: CNNConfig
): number[][][] {
  const { gridRows, gridCols, channels } = config;
  const maxDensity = 20;
  const maxVelocity = 150;

  const cellWidth = canvasWidth / gridCols;
  const cellHeight = canvasHeight / gridRows;

  // Initialize grid
  const grid: number[][][] = [];
  for (let r = 0; r < gridRows; r++) {
    grid[r] = [];
    for (let c = 0; c < gridCols; c++) {
      grid[r][c] = new Array(channels).fill(0);
    }
  }

  // Velocity sums for averaging
  const velocitySum: number[][][] = [];
  for (let r = 0; r < gridRows; r++) {
    velocitySum[r] = [];
    for (let c = 0; c < gridCols; c++) {
      velocitySum[r][c] = [0, 0];
    }
  }

  // Count particles per cell
  for (const particle of particles) {
    const col = Math.floor(particle.x / cellWidth);
    const row = Math.floor(particle.y / cellHeight);

    if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
      const isFriendly = particle.owner === playerId;
      const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);

      if (isFriendly) {
        grid[row][col][0]++;
        velocitySum[row][col][0] += velocity;
      } else {
        grid[row][col][1]++;
        velocitySum[row][col][1] += velocity;
      }
    }
  }

  // Compute obstacle grid
  const obstacleGrid = computeObstacleGrid(obstacles, gridRows, gridCols, cellWidth, cellHeight);

  // Normalize
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const friendlyCount = grid[r][c][0];
      const enemyCount = grid[r][c][1];

      grid[r][c][0] = Math.min(1, friendlyCount / maxDensity);
      grid[r][c][1] = Math.min(1, enemyCount / maxDensity);
      grid[r][c][2] = obstacleGrid[r][c];

      if (friendlyCount > 0) {
        grid[r][c][3] = Math.min(1, (velocitySum[r][c][0] / friendlyCount) / maxVelocity);
      }
      if (enemyCount > 0) {
        grid[r][c][4] = Math.min(1, (velocitySum[r][c][1] / enemyCount) / maxVelocity);
      }
    }
  }

  return grid;
}

/**
 * Compute obstacle coverage grid
 */
function computeObstacleGrid(
  obstacles: RawObstacle[],
  gridRows: number,
  gridCols: number,
  cellWidth: number,
  cellHeight: number
): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < gridRows; r++) {
    grid[r] = new Array(gridCols).fill(0);
  }

  const cellArea = cellWidth * cellHeight;

  for (const obstacle of obstacles) {
    if (obstacle.width !== undefined && obstacle.height !== undefined) {
      // Rectangle
      const obstacleLeft = obstacle.x;
      const obstacleRight = obstacle.x + obstacle.width;
      const obstacleTop = obstacle.y;
      const obstacleBottom = obstacle.y + obstacle.height;

      const startCol = Math.max(0, Math.floor(obstacleLeft / cellWidth));
      const endCol = Math.min(gridCols - 1, Math.floor(obstacleRight / cellWidth));
      const startRow = Math.max(0, Math.floor(obstacleTop / cellHeight));
      const endRow = Math.min(gridRows - 1, Math.floor(obstacleBottom / cellHeight));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cellLeft = c * cellWidth;
          const cellRight = cellLeft + cellWidth;
          const cellTop = r * cellHeight;
          const cellBottom = cellTop + cellHeight;

          const overlapLeft = Math.max(cellLeft, obstacleLeft);
          const overlapRight = Math.min(cellRight, obstacleRight);
          const overlapTop = Math.max(cellTop, obstacleTop);
          const overlapBottom = Math.min(cellBottom, obstacleBottom);

          const overlapWidth = Math.max(0, overlapRight - overlapLeft);
          const overlapHeight = Math.max(0, overlapBottom - overlapTop);
          const overlapArea = overlapWidth * overlapHeight;

          grid[r][c] = Math.min(1, grid[r][c] + overlapArea / cellArea);
        }
      }
    } else if (obstacle.radius !== undefined) {
      // Circle
      const obstacleLeft = obstacle.x - obstacle.radius;
      const obstacleRight = obstacle.x + obstacle.radius;
      const obstacleTop = obstacle.y - obstacle.radius;
      const obstacleBottom = obstacle.y + obstacle.radius;

      const startCol = Math.max(0, Math.floor(obstacleLeft / cellWidth));
      const endCol = Math.min(gridCols - 1, Math.floor(obstacleRight / cellWidth));
      const startRow = Math.max(0, Math.floor(obstacleTop / cellHeight));
      const endRow = Math.min(gridRows - 1, Math.floor(obstacleBottom / cellHeight));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cellLeft = c * cellWidth;
          const cellTop = r * cellHeight;
          const samples = 4;
          let insideCount = 0;

          for (let sy = 0; sy < samples; sy++) {
            for (let sx = 0; sx < samples; sx++) {
              const px = cellLeft + (sx + 0.5) * cellWidth / samples;
              const py = cellTop + (sy + 0.5) * cellHeight / samples;
              const dx = px - obstacle.x;
              const dy = py - obstacle.y;
              if (dx * dx + dy * dy <= obstacle.radius * obstacle.radius) {
                insideCount++;
              }
            }
          }

          const coverage = insideCount / (samples * samples);
          grid[r][c] = Math.min(1, grid[r][c] + coverage);
        }
      }
    }
  }

  return grid;
}

/**
 * Initialize WASM backend
 */
async function initWasm(): Promise<void> {
  // Set WASM paths - files are copied to public/tfjs-wasm/
  // The base path /fluid-wars/ is for GitHub Pages deployment
  const basePath = self.location.pathname.includes('/fluid-wars/')
    ? '/fluid-wars/tfjs-wasm/'
    : '/tfjs-wasm/';
  setWasmPaths(basePath);

  await tf.setBackend('wasm');
  await tf.ready();
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (e: MessageEvent<AIWorkerMessage>) => {
  const data = e.data;

  try {
    if (data.type === 'init') {
      // Initialize WASM backend
      await initWasm();

      // Store config
      cnnConfig = data.cnnConfig;

      // Create and load model
      model = createModel(cnnConfig);
      const weights = new Float32Array(data.modelWeights);
      setWeights(model, weights);

      const response: AIWorkerReadyResponse = { type: 'ready' };
      self.postMessage(response);
    }

    if (data.type === 'compute' && model && cnnConfig) {
      const start = performance.now();

      // Encode observation
      const encodeStart = performance.now();
      const observation = encodeObservation(
        data.playerId,
        data.particles,
        data.obstacles,
        data.canvasWidth,
        data.canvasHeight,
        cnnConfig
      );
      const encodeTime = performance.now() - encodeStart;

      // Run inference
      const predictStart = performance.now();
      const [targetX, targetY] = predict(model, observation);
      const predictTime = performance.now() - predictStart;

      const totalTime = performance.now() - start;

      const response: AIWorkerActionResponse = {
        type: 'action',
        playerId: data.playerId,
        targetX,
        targetY,
        computeTime: totalTime,
        encodeTime,
        predictTime,
        timestamp: data.timestamp,
      };
      self.postMessage(response);
    }
  } catch (error) {
    const response: AIWorkerErrorResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};

// Export types for use in AsyncNeuralAI
export type { AIWorkerMessage, AIWorkerResponse, CNNConfig };
