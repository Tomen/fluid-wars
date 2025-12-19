// Training configuration

import type { TrainerConfig } from '../src/training/NEATTrainer';
import type { EvaluatorConfig } from '../src/training/FitnessEvaluator';
import type { SimulatorConfig } from '../src/core/AIInterface';
import type { EncoderConfig } from '../src/ai/ObservationEncoder';

/**
 * Encoder configuration
 */
export const ENCODER_CONFIG: Partial<EncoderConfig> = {
  gridRows: 16,
  gridCols: 20,
  channels: 5,
  maxDensity: 20,
  canvasWidth: 1200,
  canvasHeight: 800,
};

/**
 * Calculate input size from encoder config
 */
export function getInputSize(): number {
  const gridSize = (ENCODER_CONFIG.gridRows || 16) *
                   (ENCODER_CONFIG.gridCols || 20) *
                   (ENCODER_CONFIG.channels || 5);
  const cursorSize = 4;  // 2 players * 2 coordinates
  const countSize = 2;   // 2 players particle counts
  return gridSize + cursorSize + countSize;
}

/**
 * Simulator configuration for training
 * Uses smaller particle counts for faster simulation
 */
export const SIMULATOR_CONFIG: Partial<SimulatorConfig> = {
  playerCount: 2,
  particlesPerPlayer: 100,  // Reduced for faster training
  canvasWidth: 1200,
  canvasHeight: 800,
  fixedDt: 1 / 60,
  maxSteps: 1800,  // 30 seconds at 60 FPS
  gridRows: 16,
  gridCols: 20,
};

/**
 * NEAT trainer configuration
 */
export const TRAINER_CONFIG: Partial<TrainerConfig> = {
  populationSize: 50,           // Start small for testing
  inputSize: getInputSize(),    // 1606 inputs
  outputSize: 2,                // targetX, targetY
  elitism: 5,                   // Keep top 5 unchanged
  mutationRate: 0.3,
  mutationAmount: 1,
  maxGenerations: 500,
  checkpointInterval: 25,
  verbose: true,
};

/**
 * Fitness evaluator configuration
 */
export const EVALUATOR_CONFIG: Partial<EvaluatorConfig> = {
  matchesPerEvaluation: 3,      // Play 3 matches per opponent sample
  maxStepsPerMatch: 1800,       // 30 seconds per match
  winReward: 100,
  loseReward: -50,
  drawReward: 10,               // Small reward for surviving
  particleAdvantageBonus: 0.5,
  quickWinBonus: 20,
  simulatorConfig: SIMULATOR_CONFIG,
  encoderConfig: ENCODER_CONFIG,
};

/**
 * Difficulty tier checkpoints
 * Save models at these generations for different difficulty levels
 */
export const DIFFICULTY_TIERS = {
  easy: { generation: 25, filename: 'ai_easy.json' },
  medium: { generation: 100, filename: 'ai_medium.json' },
  hard: { generation: 250, filename: 'ai_hard.json' },
  expert: { generation: 500, filename: 'ai_expert.json' },
} as const;

/**
 * Output directory for saved models
 */
export const MODEL_OUTPUT_DIR = './training/models';

/**
 * Checkpoint directory
 */
export const CHECKPOINT_DIR = './training/checkpoints';
