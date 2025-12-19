// ModelLoader - Load trained AI models in the browser

import neataptic from 'neataptic';
import type { Network as NetworkType, NetworkJSON } from 'neataptic';
const { Network } = neataptic;

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
  network: NetworkType;
  metadata: ModelMetadata;
}

/**
 * Model file format (with metadata wrapper)
 */
interface ModelFileFormat {
  generation?: number;
  bestFitness?: number;
  averageFitness?: number;
  network: NetworkJSON;
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
 * @returns The loaded neural network
 */
export async function loadModel(difficulty: Exclude<AIDifficulty, 'random'>): Promise<NetworkType> {
  const loaded = await loadModelWithMetadata(difficulty);
  return loaded.network;
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

    const json = await response.json();

    // Support both formats: raw NetworkJSON or wrapped with metadata
    let networkJson: NetworkJSON;
    let generation: number | null = null;

    let bestFitness: number | null = null;
    let averageFitness: number | null = null;

    if ('network' in json && json.network) {
      // New format with metadata wrapper
      const modelFile = json as ModelFileFormat;
      networkJson = modelFile.network;
      generation = modelFile.generation ?? null;
      bestFitness = modelFile.bestFitness ?? null;
      averageFitness = modelFile.averageFitness ?? null;
    } else {
      // Legacy format: raw network JSON
      networkJson = json as NetworkJSON;
    }

    const network = Network.fromJSON(networkJson);

    const loaded: LoadedModel = {
      network,
      metadata: {
        generation,
        bestFitness,
        averageFitness,
        difficulty,
      },
    };

    // Cache the model
    modelCache.set(difficulty, loaded);

    console.log(`Loaded AI model: ${difficulty}${generation !== null ? ` (gen ${generation})` : ''}`);
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
 * Clear the model cache
 */
export function clearModelCache(): void {
  modelCache.clear();
}

/**
 * Load a model from a JSON object directly (for testing)
 */
export function loadModelFromJSON(json: NetworkJSON, cacheAs?: AIDifficulty, generation?: number): NetworkType {
  const network = Network.fromJSON(json);

  if (cacheAs) {
    modelCache.set(cacheAs, {
      network,
      metadata: {
        generation: generation ?? null,
        bestFitness: null,
        averageFitness: null,
        difficulty: cacheAs,
      },
    });
  }

  return network;
}
