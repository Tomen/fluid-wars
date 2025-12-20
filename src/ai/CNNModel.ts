// CNN Model for Fluid Wars AI
// Uses TensorFlow.js with configurable architecture from config.yaml

import * as tf from '@tensorflow/tfjs';
import { CNN_CONFIG } from '../config';

/**
 * Create a CNN model for the game AI
 * Input: 3D grid of shape [gridRows, gridCols, channels]
 * Output: 2 values [targetX, targetY] in range [0, 1]
 */
export function createModel(): tf.Sequential {
  const model = tf.sequential();

  // Conv layer 1: detect local patterns
  model.add(tf.layers.conv2d({
    inputShape: [CNN_CONFIG.gridRows, CNN_CONFIG.gridCols, CNN_CONFIG.channels],
    filters: CNN_CONFIG.conv1Filters,
    kernelSize: CNN_CONFIG.kernelSize,
    activation: 'relu',
    padding: 'same',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // Conv layer 2: combine patterns
  model.add(tf.layers.conv2d({
    filters: CNN_CONFIG.conv2Filters,
    kernelSize: CNN_CONFIG.kernelSize,
    activation: 'relu',
    padding: 'same',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // Flatten and dense layers
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({
    units: CNN_CONFIG.denseUnits,
    activation: 'relu',
    kernelInitializer: 'glorotUniform',
  }));

  // Output layer with sigmoid for [0, 1] range
  model.add(tf.layers.dense({
    units: 2,
    activation: 'sigmoid',
    kernelInitializer: 'glorotUniform',
  }));

  return model;
}

/**
 * Get all weights from a model as a flat Float32Array
 * Used by genetic algorithm for mutation/crossover
 */
export function getWeights(model: tf.Sequential): Float32Array {
  const weights: number[] = [];

  for (const layer of model.layers) {
    const layerWeights = layer.getWeights();
    for (const w of layerWeights) {
      const data = w.dataSync();
      for (let i = 0; i < data.length; i++) {
        weights.push(data[i]);
      }
    }
  }

  return new Float32Array(weights);
}

/**
 * Set all weights in a model from a flat Float32Array
 * Used by genetic algorithm to apply evolved weights
 */
export function setWeights(model: tf.Sequential, weights: Float32Array): void {
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
 * Get the total number of weights in the model
 */
export function getWeightCount(model: tf.Sequential): number {
  let count = 0;

  for (const layer of model.layers) {
    const layerWeights = layer.getWeights();
    for (const w of layerWeights) {
      count += w.size;
    }
  }

  return count;
}

/**
 * Clone a model by copying its weights
 */
export function cloneModel(source: tf.Sequential): tf.Sequential {
  const clone = createModel();
  const weights = getWeights(source);
  setWeights(clone, weights);
  return clone;
}

/**
 * Run inference on the model
 * Input: 3D array of shape [gridRows][gridCols][channels]
 * Output: [targetX, targetY] in range [0, 1]
 */
export function predict(model: tf.Sequential, input: number[][][]): [number, number] {
  // Convert to tensor with batch dimension
  const inputTensor = tf.tensor4d([input]);

  // Run prediction
  const outputTensor = model.predict(inputTensor) as tf.Tensor;
  const output = outputTensor.dataSync();

  // Clean up tensors
  inputTensor.dispose();
  outputTensor.dispose();

  return [output[0], output[1]];
}

/**
 * Save model to file (Node.js) or IndexedDB (browser)
 */
export async function saveModel(model: tf.Sequential, path: string): Promise<void> {
  await model.save(`file://${path}`);
}

/**
 * Load model from file (Node.js) or IndexedDB (browser)
 */
export async function loadModel(path: string): Promise<tf.Sequential> {
  const model = await tf.loadLayersModel(`file://${path}/model.json`);
  return model as tf.Sequential;
}

/**
 * Serialize model weights to JSON-compatible format
 */
export function weightsToJSON(weights: Float32Array): number[] {
  return Array.from(weights);
}

/**
 * Deserialize model weights from JSON
 */
export function weightsFromJSON(json: number[]): Float32Array {
  return new Float32Array(json);
}
