// ModelLoader - Load trained AI models in the browser
import { createModel, setWeights, weightsFromJSON } from './CNNModel';
/**
 * Get the base URL for assets (handles GitHub Pages subdirectory deployment)
 */
function getBaseUrl() {
    // Vite injects BASE_URL from the `base` config option
    // Falls back to '/' for environments without Vite
    return import.meta.env?.BASE_URL ?? '/';
}
/**
 * Model file paths for each difficulty (relative to base URL)
 */
function getModelPath(difficulty) {
    const base = getBaseUrl();
    const paths = {
        easy: 'models/ai_easy.json',
        medium: 'models/ai_medium.json',
        hard: 'models/ai_hard.json',
        expert: 'models/ai_expert.json',
    };
    return `${base}${paths[difficulty]}`;
}
/**
 * Cache for loaded models (with metadata)
 */
const modelCache = new Map();
/**
 * Load a trained AI model from a JSON file
 *
 * @param difficulty The difficulty level to load
 * @returns The loaded TensorFlow model
 */
export async function loadModel(difficulty) {
    const loaded = await loadModelWithMetadata(difficulty);
    return loaded.model;
}
/**
 * Load a trained AI model with metadata from a JSON file
 *
 * @param difficulty The difficulty level to load
 * @returns The loaded model with metadata
 */
export async function loadModelWithMetadata(difficulty) {
    // Check cache first
    if (modelCache.has(difficulty)) {
        return modelCache.get(difficulty);
    }
    const path = getModelPath(difficulty);
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        // Create model and load weights
        const model = createModel();
        const weights = weightsFromJSON(json.weights);
        setWeights(model, weights);
        const loaded = {
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
    }
    catch (error) {
        console.error(`Error loading AI model (${difficulty}):`, error);
        throw error;
    }
}
/**
 * Check if a model is available (cached or can be loaded)
 */
export async function isModelAvailable(difficulty) {
    if (modelCache.has(difficulty)) {
        return true;
    }
    try {
        const response = await fetch(getModelPath(difficulty), { method: 'HEAD' });
        return response.ok;
    }
    catch {
        return false;
    }
}
/**
 * Get list of available difficulty levels
 */
export async function getAvailableDifficulties() {
    const available = ['random']; // Random is always available
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
        if (await isModelAvailable(difficulty)) {
            available.push(difficulty);
        }
    }
    return available;
}
/**
 * Clear the model cache (disposes TensorFlow models)
 */
export function clearModelCache() {
    for (const loaded of modelCache.values()) {
        loaded.model.dispose();
    }
    modelCache.clear();
}
/**
 * Load a model from weights array directly (for testing)
 */
export function loadModelFromWeights(weights, cacheAs, generation) {
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
//# sourceMappingURL=ModelLoader.js.map