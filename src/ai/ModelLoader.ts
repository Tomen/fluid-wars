// ModelLoader - Load trained AI models in the browser

import * as tf from '@tensorflow/tfjs';
import { createModel, setWeights, weightsFromJSON } from './CNNModel';

/**
 * Available AI difficulty levels
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'random';

/**
 * Metadata about a loaded model
 */
export interface ModelMetadata {
  generation: number | null;
  bestFitness: number | null;
  averageFitness: number | null;
  difficulty: AIDifficulty;
}

/**
 * Result of loading a model
 */
export interface LoadedModel {
  model: tf.Sequential;
  metadata: ModelMetadata;
}

/**
 * Model file format (with metadata wrapper)
 */
interface ModelFileFormat {
  generation?: number;
  bestFitness?: number;
  averageFitness?: number;
  weights: number[];
}

/**
 * Model file paths for each difficulty
 */
const MODEL_PATHS: Record<Exclude<AIDifficulty, 'random'>, string> = {
  easy: '/models/ai_easy.json',
  medium: '/models/ai_medium.json',
  hard: '/models/ai_hard.json',
  expert: '/models/ai_expert.json',
};

/**
 * Cache for loaded models (with metadata)
 */
const modelCache = new Map<AIDifficulty, LoadedModel>();

/**
 * Load a trained AI model from a JSON file
 *
 * @param difficulty The difficulty level to load
 * @returns The loaded TensorFlow model
 */
export async function loadModel(difficulty: Exclude<AIDifficulty, 'random'>): Promise<tf.Sequential> {
  const loaded = await loadModelWithMetadata(difficulty);
  return loaded.model;
}

/**
 * Load a trained AI model with metadata from a JSON file
 *
 * @param difficulty The difficulty level to load
 * @returns The loaded model with metadata
 */
export async function loadModelWithMetadata(difficulty: Exclude<AIDifficulty, 'random'>): Promise<LoadedModel> {
  // Check cache first
  if (modelCache.has(difficulty)) {
    return modelCache.get(difficulty)!;
  }

  const path = MODEL_PATHS[difficulty];

  try {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as ModelFileFormat;

    // Create model and load weights
    const model = createModel();
    const weights = weightsFromJSON(json.weights);
    setWeights(model, weights);

    const loaded: LoadedModel = {
      model,
      metadata: {
        generation: json.generation ?? null,
        bestFitness: json.bestFitness ?? null,
        averageFitness: json.averageFitness ?? null,
        difficulty,
      },
    };

    // Cache the model
    modelCache.set(difficulty, loaded);

    console.log(`Loaded AI model: ${difficulty}${json.generation !== undefined ? ` (gen ${json.generation})` : ''}`);
    return loaded;
  } catch (error) {
    console.error(`Error loading AI model (${difficulty}):`, error);
    throw error;
  }
}

/**
 * Check if a model is available (cached or can be loaded)
 */
export async function isModelAvailable(difficulty: Exclude<AIDifficulty, 'random'>): Promise<boolean> {
  if (modelCache.has(difficulty)) {
    return true;
  }

  try {
    const response = await fetch(MODEL_PATHS[difficulty], { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available difficulty levels
 */
export async function getAvailableDifficulties(): Promise<AIDifficulty[]> {
  const available: AIDifficulty[] = ['random']; // Random is always available

  for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
    if (await isModelAvailable(difficulty)) {
      available.push(difficulty);
    }
  }

  return available;
}

/**
 * Clear the model cache (disposes TensorFlow models)
 */
export function clearModelCache(): void {
  for (const loaded of modelCache.values()) {
    loaded.model.dispose();
  }
  modelCache.clear();
}

/**
 * Load a model from weights array directly (for testing)
 */
export function loadModelFromWeights(
  weights: number[],
  cacheAs?: AIDifficulty,
  generation?: number
): tf.Sequential {
  const model = createModel();
  setWeights(model, weightsFromJSON(weights));

  if (cacheAs) {
    modelCache.set(cacheAs, {
      model,
      metadata: {
        generation: generation ?? null,
        bestFitness: null,
        averageFitness: null,
        difficulty: cacheAs,
      },
    });
  }

  return model;
}
