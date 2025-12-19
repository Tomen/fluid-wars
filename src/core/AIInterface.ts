// AI Interface types for game state observation and actions

import type { Vec2 } from '../types';

/**
 * Normalized game state for AI observation
 * All values are normalized to 0-1 range for neural network input
 */
export interface GameState {
  /**
   * Spatial grid encoding: [rows][cols][channels]
   * Channels:
   * [0] = friendly particle density (0-1)
   * [1] = enemy particle density (0-1)
   * [2] = obstacle presence (0 or 1)
   * [3] = friendly conversion pressure (0-1)
   * [4] = enemy conversion pressure (0-1)
   */
  grid: number[][][];

  /** Cursor positions for all players, normalized to 0-1 */
  cursorPositions: Vec2[];

  /** Particle counts for all players, normalized by total particles */
  particleCounts: number[];

  /** Game time elapsed, normalized (0 = start, 1 = max time) */
  timeElapsed: number;

  /** Total particles in the game (for denormalization) */
  totalParticles: number;

  /** Canvas dimensions (for denormalization) */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Result of a simulation step
 */
export interface StepResult {
  /** Current game state after the step */
  state: GameState;

  /** Reward for each player this step */
  rewards: Map<number, number>;

  /** Whether the game has ended */
  done: boolean;

  /** Winner ID (-1 if no winner yet) */
  winner: number;

  /** Number of steps taken so far */
  stepCount: number;
}

/**
 * Configuration for the game simulator
 */
export interface SimulatorConfig {
  /** Number of players */
  playerCount: number;

  /** Particles per player at start */
  particlesPerPlayer: number;

  /** Canvas width for simulation */
  canvasWidth: number;

  /** Canvas height for simulation */
  canvasHeight: number;

  /** Fixed timestep for physics (seconds) */
  fixedDt: number;

  /** Maximum steps before forced termination (0 = no limit) */
  maxSteps: number;

  /** Grid rows for observation encoding */
  gridRows: number;

  /** Grid columns for observation encoding */
  gridCols: number;
}

/**
 * Default simulator configuration
 */
export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  playerCount: 2,
  particlesPerPlayer: 200,
  canvasWidth: 1200,
  canvasHeight: 800,
  fixedDt: 1 / 60,
  maxSteps: 3600, // 60 seconds at 60 FPS
  gridRows: 16,
  gridCols: 20,
};

/**
 * AI action: target cursor position (normalized 0-1)
 */
export interface AIAction {
  /** Target X position (0-1, will be scaled to canvas width) */
  targetX: number;

  /** Target Y position (0-1, will be scaled to canvas height) */
  targetY: number;
}

/**
 * Reward configuration for training
 */
export interface RewardConfig {
  /** Reward for winning the game */
  winReward: number;

  /** Penalty for losing the game */
  loseReward: number;

  /** Reward multiplier for particle advantage (per particle difference) */
  particleAdvantageMultiplier: number;

  /** Small reward for survival per step */
  survivalReward: number;
}

/**
 * Default reward configuration
 */
export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  winReward: 100,
  loseReward: -50,
  particleAdvantageMultiplier: 0.1,
  survivalReward: 0.01,
};
