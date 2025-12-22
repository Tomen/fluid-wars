// Training configuration
// Uses settings from config.yaml via the centralized config module
import { TRAINING_CONFIG, TRAINING_GAME_CONFIG, CNN_CONFIG } from '../src/config';
/**
 * Difficulty tier checkpoints
 * Save models at these generations for different difficulty levels
 */
export const DIFFICULTY_TIERS = {
    easy: { generation: TRAINING_CONFIG.difficultyTiers.easy, filename: 'ai_easy.json' },
    medium: { generation: TRAINING_CONFIG.difficultyTiers.medium, filename: 'ai_medium.json' },
    hard: { generation: TRAINING_CONFIG.difficultyTiers.hard, filename: 'ai_hard.json' },
    expert: { generation: TRAINING_CONFIG.difficultyTiers.expert, filename: 'ai_expert.json' },
};
/**
 * Output directory for saved models (public folder for browser access)
 */
export const MODEL_OUTPUT_DIR = './public/models';
/**
 * Checkpoint directory
 */
export const CHECKPOINT_DIR = './training/checkpoints';
// Re-export config for convenience
export { TRAINING_CONFIG, TRAINING_GAME_CONFIG, CNN_CONFIG };
//# sourceMappingURL=config.js.map