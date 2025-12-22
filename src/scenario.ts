// Scenario configuration for Fluid Wars
// Scenarios define level setups, test cases, and custom game configurations

import type { WinConfig, ObstacleData } from './types';

/**
 * Particle spawn pattern configuration
 */
export interface ParticleSpawnConfig {
  count: number;
  pattern: 'disk' | 'ring';
  center: { x: number; y: number };
  radius: number;
  innerRadius?: number;  // Only for 'ring' pattern
}

/**
 * Per-player spawn configuration
 */
export interface PlayerSpawnConfig {
  id: number;
  spawn: { x: number; y: number };  // Cursor starting position
  particles?: ParticleSpawnConfig;   // Custom particle distribution
}

/**
 * AI configuration for a scenario
 */
export interface ScenarioAIConfig {
  enabled: boolean;
  aiPlayers?: number[];              // Which player IDs are AI controlled
  defaultAIType?: 'random' | 'aggressive' | 'neural';
  neuralDifficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  useWebWorker?: boolean;
}

/**
 * Obstacle/maze configuration for a scenario
 */
export interface ScenarioObstacleConfig {
  enabled: boolean;
  generator?: 'random' | 'grid';

  // Random generator settings
  size?: number;
  minSizeMultiplier?: number;
  maxSizeMultiplier?: number;
  minCount?: number;
  maxCount?: number;
  margin?: number;

  // Grid maze settings
  gridSpacing?: number;
  wallThickness?: number;
  gapSize?: number;
  wallProbability?: number;

  // Pre-defined obstacles (for custom maps)
  obstacles?: ObstacleData[];
}

/**
 * Test runner configuration (for balance testing scenarios)
 */
export interface ScenarioTestConfig {
  cursorTargets: Array<{ x: number; y: number }>;  // Fixed cursor positions per player
  maxSteps: number;                                 // Max simulation steps
  runs: number;                                     // Number of test runs
}

/**
 * Complete scenario configuration
 * Defines everything needed to set up a game level or test case
 */
export interface ScenarioConfig {
  name: string;
  description?: string;

  // Core game settings
  game: {
    playerCount: number;
    particlesPerPlayer?: number;  // Default particles per player (if not overridden per-player)
    canvasWidth: number;
    canvasHeight: number;
  };

  // Win condition
  win: WinConfig;

  // AI settings
  ai?: ScenarioAIConfig;

  // Obstacle/maze settings
  obstacles?: ScenarioObstacleConfig;

  // Custom player configurations (optional - overrides default spawn positions)
  players?: PlayerSpawnConfig[];

  // Test runner configuration (for balance tests)
  test?: ScenarioTestConfig;
}

// Note: For Node.js scenario loading (balance tests), use the loader in
// src/testing/balance-test.ts which uses fs and js-yaml directly.
// Browser scenario loading is not currently needed since the game uses config.yaml.

/**
 * Create default scenario from current game config
 * Used for backwards compatibility when no scenario is specified
 */
export function createDefaultScenario(
  playerCount: number,
  particlesPerPlayer: number,
  canvasWidth: number,
  canvasHeight: number,
  win: WinConfig
): ScenarioConfig {
  return {
    name: 'Default Game',
    game: {
      playerCount,
      particlesPerPlayer,
      canvasWidth,
      canvasHeight,
    },
    win,
    ai: {
      enabled: true,
      aiPlayers: Array.from({ length: playerCount - 1 }, (_, i) => i + 1),
      defaultAIType: 'neural',
      neuralDifficulty: 'easy',
      useWebWorker: true,
    },
    obstacles: {
      enabled: true,
      generator: 'grid',
    },
  };
}

/**
 * Spawn particles for a player based on spawn config
 */
export function spawnParticlePositions(
  config: ParticleSpawnConfig
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const { count, pattern, center, radius, innerRadius } = config;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    let dist: number;

    if (pattern === 'ring' && innerRadius !== undefined) {
      // Ring pattern: spawn between innerRadius and radius
      dist = innerRadius + Math.random() * (radius - innerRadius);
    } else {
      // Disk pattern: spawn within radius (weighted towards center)
      dist = Math.random() * radius;
    }

    positions.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    });
  }

  return positions;
}
