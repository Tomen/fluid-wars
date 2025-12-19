// Training configuration
// Reads from config.yaml in the project root

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { TrainerConfig } from '../src/training/NEATTrainer';
import type { EvaluatorConfig } from '../src/training/FitnessEvaluator';
import type { SimulatorConfig } from '../src/core/AIInterface';
import type { EncoderConfig } from '../src/ai/ObservationEncoder';

// Load YAML config
const configPath = path.resolve(process.cwd(), 'config.yaml');
const configFile = fs.readFileSync(configPath, 'utf8');
const rawConfig = yaml.load(configFile) as Record<string, unknown>;

// Extract training section
const trainingConfig = rawConfig.training as {
  trainer: {
    populationSize: number;
    elitism: number;
    mutationRate: number;
    mutationAmount: number;
    maxGenerations: number;
    checkpointInterval: number;
    verbose: boolean;
  };
  evaluator: {
    matchesPerGenome: number;
    maxGameSteps: number;
    stepsPerSecond: number;
  };
  simulator: {
    playerCount: number;
    particlesPerPlayer: number;
    canvasWidth: number;
    canvasHeight: number;
  };
  difficultyTiers: {
    easy: number;
    medium: number;
    hard: number;
    expert: number;
  };
};

/**
 * Encoder configuration
 */
export const ENCODER_CONFIG: Partial<EncoderConfig> = {
  gridRows: 16,
  gridCols: 20,
  channels: 5,
  maxDensity: 20,
  canvasWidth: trainingConfig.simulator.canvasWidth,
  canvasHeight: trainingConfig.simulator.canvasHeight,
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
  playerCount: trainingConfig.simulator.playerCount,
  particlesPerPlayer: trainingConfig.simulator.particlesPerPlayer,
  canvasWidth: trainingConfig.simulator.canvasWidth,
  canvasHeight: trainingConfig.simulator.canvasHeight,
  fixedDt: 1 / 60,
  maxSteps: trainingConfig.evaluator.maxGameSteps,
  gridRows: 16,
  gridCols: 20,
};

/**
 * NEAT trainer configuration
 */
export const TRAINER_CONFIG: Partial<TrainerConfig> = {
  populationSize: trainingConfig.trainer.populationSize,
  inputSize: getInputSize(),
  outputSize: 2,  // targetX, targetY
  elitism: trainingConfig.trainer.elitism,
  mutationRate: trainingConfig.trainer.mutationRate,
  mutationAmount: trainingConfig.trainer.mutationAmount,
  maxGenerations: trainingConfig.trainer.maxGenerations,
  checkpointInterval: trainingConfig.trainer.checkpointInterval,
  verbose: trainingConfig.trainer.verbose,
};

/**
 * Fitness evaluator configuration
 *
 * Reward function:
 * - Base score = particle advantage (my particles - enemy particles)
 * - If win before timeout, add remaining seconds as bonus
 */
export const EVALUATOR_CONFIG: Partial<EvaluatorConfig> = {
  matchesPerEvaluation: trainingConfig.evaluator.matchesPerGenome,
  maxStepsPerMatch: trainingConfig.evaluator.maxGameSteps,
  stepsPerSecond: trainingConfig.evaluator.stepsPerSecond,
  simulatorConfig: SIMULATOR_CONFIG,
  encoderConfig: ENCODER_CONFIG,
};

/**
 * Difficulty tier checkpoints
 * Save models at these generations for different difficulty levels
 */
export const DIFFICULTY_TIERS = {
  easy: { generation: trainingConfig.difficultyTiers.easy, filename: 'ai_easy.json' },
  medium: { generation: trainingConfig.difficultyTiers.medium, filename: 'ai_medium.json' },
  hard: { generation: trainingConfig.difficultyTiers.hard, filename: 'ai_hard.json' },
  expert: { generation: trainingConfig.difficultyTiers.expert, filename: 'ai_expert.json' },
} as const;

/**
 * Output directory for saved models (public folder for browser access)
 */
export const MODEL_OUTPUT_DIR = './public/models';

/**
 * Checkpoint directory
 */
export const CHECKPOINT_DIR = './training/checkpoints';
