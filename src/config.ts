// Centralized game configuration
// Reads from config.yaml in the project root
// Works in both browser (Vite) and Node.js (training)

// Type definitions for the YAML config
interface YamlConfig {
  game: {
    playerCount: number;
    particlesPerPlayer: number;
    canvasWidth: number;
    canvasHeight: number;
  };
  particle: {
    acceleration: number;
    maxVelocity: number;
    friction: number;
    radius: number;
    repulsionRadius: number;
    repulsionStrength: number;
    enemyRepulsionMultiplier: number;
    spawnRadius: number;
  };
  conversion: {
    radius: number;
    rate: number;
    threshold: number;
    decayMultiplier: number;
  };
  player: {
    cursorSpeed: number;
    cursorRadius: number;
  };
  spatial: {
    cellSize: number;
  };
  obstacle: {
    size: number;
    gridSpacing: number;
    margin: number;
    bounceEnergyLoss: number;
  };
  gameLoop: {
    fixedDt: number;
    maxAccumulator: number;
  };
  win: {
    mode: 'elimination' | 'percentage';
    eliminationThreshold: number;
    percentageThreshold: number;
  };
  ai: {
    enabled: boolean;
    aiPlayers: number[];
    defaultAIType: 'random' | 'aggressive' | 'neural';
    neuralDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
  };
  render: {
    backgroundColor: string;
  };
}

// Load config based on environment
let config: YamlConfig;

// Check if we're in a browser environment (Vite)
const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  // Browser - use Vite plugin import (bundled at build time)
  // @ts-ignore - Vite handles this import at build time
  const rawConfig = await import('../config.yaml');
  config = rawConfig.default as YamlConfig;
} else {
  // Node.js - read file directly using dynamic imports
  const fs = await import('fs');
  const path = await import('path');
  const yaml = await import('js-yaml');
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = yaml.load(configFile) as YamlConfig;
}

/**
 * GAME SETUP
 */
export const GAME_CONFIG = {
  playerCount: config.game.playerCount,
  particlesPerPlayer: config.game.particlesPerPlayer,
  canvasWidth: config.game.canvasWidth,
  canvasHeight: config.game.canvasHeight,
} as const;

/**
 * PARTICLE PHYSICS
 */
export const PARTICLE_CONFIG = {
  // Movement
  acceleration: config.particle.acceleration,
  maxVelocity: config.particle.maxVelocity,
  friction: config.particle.friction,

  // Size
  radius: config.particle.radius,

  // Collision and Repulsion
  repulsionRadius: config.particle.repulsionRadius,
  repulsionStrength: config.particle.repulsionStrength,
  enemyRepulsionMultiplier: config.particle.enemyRepulsionMultiplier,

  // Spawn
  spawnRadius: config.particle.spawnRadius,
} as const;

/**
 * CONVERSION SYSTEM
 */
export const CONVERSION_CONFIG = {
  radius: config.conversion.radius,
  rate: config.conversion.rate,
  threshold: config.conversion.threshold,
  decayMultiplier: config.conversion.decayMultiplier,
} as const;

/**
 * PLAYER CONTROLS
 */
export const PLAYER_CONFIG = {
  cursorSpeed: config.player.cursorSpeed,
  cursorRadius: config.player.cursorRadius,
} as const;

/**
 * SPATIAL HASH (Performance)
 */
export const SPATIAL_CONFIG = {
  cellSize: config.spatial.cellSize,
} as const;

/**
 * OBSTACLES / MAZE
 */
export const OBSTACLE_CONFIG = {
  size: config.obstacle.size,
  gridSpacing: config.obstacle.gridSpacing,
  margin: config.obstacle.margin,
  bounceEnergyLoss: config.obstacle.bounceEnergyLoss,
} as const;

/**
 * GAME LOOP
 */
export const GAME_LOOP_CONFIG = {
  fixedDt: config.gameLoop.fixedDt,
  maxAccumulator: config.gameLoop.maxAccumulator,
} as const;

/**
 * WIN CONDITION
 */
export const WIN_CONFIG = {
  mode: config.win.mode,
  eliminationThreshold: config.win.eliminationThreshold,
  percentageThreshold: config.win.percentageThreshold,
} as const;

/**
 * AI CONFIGURATION
 */
export const AI_CONFIG = {
  enabled: config.ai.enabled,
  aiPlayers: config.ai.aiPlayers,
  defaultAIType: config.ai.defaultAIType,
  neuralDifficulty: config.ai.neuralDifficulty,
} as const;

/**
 * RENDERING
 */
export const RENDER_CONFIG = {
  backgroundColor: config.render.backgroundColor,
} as const;
