// Centralized game configuration
// Reads from config.yaml in the project root
// Works in both browser (Vite) and Node.js (training)

// Type definitions for the YAML config
interface WinConfig {
  mode: 'elimination' | 'percentage';
  eliminationThreshold: number;
  percentageThreshold: number;
}

interface YamlConfig {
  game: {
    playerCount: number;
    particlesPerPlayer: number;
    canvasWidth: number;
    canvasHeight: number;
    win: WinConfig;
  };
  particle: {
    acceleration: number;
    maxVelocity: number;
    friction: number;
    radius: number;
    repulsionRadius: number;
    repulsionStrength: number;
    enemyRepulsionMultiplier: number;
    friendlyRepulsionMultiplier: number;
    collisionDamping: number;
    spawnRadius: number;
  };
  conversion: {
    radius: number;
    rate: number;
    threshold: number;
    decayMultiplier: number;
    friendlySupportFactor: number;
  };
  player: {
    cursorSpeed: number;
    cursorRadius: number;
  };
  spatial: {
    cellSize: number;
  };
  obstacle: {
    generator: 'random' | 'grid';
    playerMargin: number;
    bounceEnergyLoss: number;
    // Random generator settings
    size: number;
    minSizeMultiplier: number;
    maxSizeMultiplier: number;
    minCount: number;
    maxCount: number;
    margin: number;
    // Grid maze settings
    gridSpacing: number;
    wallThickness: number;
    gapSize: number;
    wallProbability: number;
  };
  gameLoop: {
    fixedDt: number;
    maxAccumulator: number;
  };
  ai: {
    enabled: boolean;
    aiPlayers: number[];
    defaultAIType: 'random' | 'aggressive' | 'neural';
    neuralDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
    useWebWorker: boolean;
  };
  render: {
    backgroundColor: string;
    particleStyle: 'solid' | 'soft' | 'glow';
    shadowBlur: number;
    shadowAlpha: number;
  };
  cnn: {
    conv1Filters: number;
    conv2Filters: number;
    kernelSize: number;
    denseUnits: number;
    gridRows: number;
    gridCols: number;
    channels: number;
  };
  training: {
    // Genetic algorithm settings
    populationSize: number;
    eliteCount: number;
    mutationRate: number;
    mutationStrength: number;
    crossoverRate: number;
    maxGenerations: number;
    checkpointInterval: number;
    verbose: boolean;
    // Evaluation settings
    matchesPerGenome: number;
    maxGameSteps: number;
    stepsPerSecond: number;
    // Game overrides (partial - inherits from game section)
    overrides?: {
      playerCount?: number;
      particlesPerPlayer?: number;
      canvasWidth?: number;
      canvasHeight?: number;
      win?: Partial<WinConfig>;
    };
    difficultyTiers: {
      easy: number;
      medium: number;
      hard: number;
      expert: number;
    };
  };
}

// Load config based on environment
let config: YamlConfig;

// Check if we're in Node.js (has process.versions.node)
// This correctly handles: browser main thread, web workers, AND Node.js
const isNode = typeof process !== 'undefined'
  && process.versions != null
  && process.versions.node != null;

if (!isNode) {
  // Browser or Web Worker - Vite transforms this import at build time via yaml plugin
  // @ts-ignore - Vite handles yaml imports
  const yamlModule = await import('../config.yaml');
  config = yamlModule.default as YamlConfig;
} else {
  // Node.js - use dynamic imports (ESM compatible)
  const fs = await import('fs');
  const path = await import('path');
  const yaml = await import('js-yaml');
  // Support CONFIG_PATH env var for testing with different configs
  const configFilename = process.env.CONFIG_PATH || 'config.yaml';
  const configPath = path.resolve(process.cwd(), configFilename);
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
  friendlyRepulsionMultiplier: config.particle.friendlyRepulsionMultiplier,
  collisionDamping: config.particle.collisionDamping,

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
  friendlySupportFactor: config.conversion.friendlySupportFactor,
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
  generator: config.obstacle.generator,
  playerMargin: config.obstacle.playerMargin,
  bounceEnergyLoss: config.obstacle.bounceEnergyLoss,
  // Random generator settings
  size: config.obstacle.size,
  minSizeMultiplier: config.obstacle.minSizeMultiplier,
  maxSizeMultiplier: config.obstacle.maxSizeMultiplier,
  minCount: config.obstacle.minCount,
  maxCount: config.obstacle.maxCount,
  margin: config.obstacle.margin,
  // Grid maze settings
  gridSpacing: config.obstacle.gridSpacing,
  wallThickness: config.obstacle.wallThickness,
  gapSize: config.obstacle.gapSize,
  wallProbability: config.obstacle.wallProbability,
} as const;

/**
 * GAME LOOP
 */
export const GAME_LOOP_CONFIG = {
  fixedDt: config.gameLoop.fixedDt,
  maxAccumulator: config.gameLoop.maxAccumulator,
} as const;

/**
 * WIN CONDITION (for regular play)
 */
export const WIN_CONFIG = {
  mode: config.game.win.mode,
  eliminationThreshold: config.game.win.eliminationThreshold,
  percentageThreshold: config.game.win.percentageThreshold,
} as const;

/**
 * AI CONFIGURATION
 */
export const AI_CONFIG = {
  enabled: config.ai.enabled,
  aiPlayers: config.ai.aiPlayers,
  defaultAIType: config.ai.defaultAIType,
  neuralDifficulty: config.ai.neuralDifficulty,
  useWebWorker: config.ai.useWebWorker,
} as const;

/**
 * RENDERING
 */
export const RENDER_CONFIG = {
  backgroundColor: config.render.backgroundColor,
  particleStyle: config.render.particleStyle,
  shadowBlur: config.render.shadowBlur,
  shadowAlpha: config.render.shadowAlpha,
} as const;

/**
 * CNN ARCHITECTURE
 */
export const CNN_CONFIG = {
  conv1Filters: config.cnn.conv1Filters,
  conv2Filters: config.cnn.conv2Filters,
  kernelSize: config.cnn.kernelSize,
  denseUnits: config.cnn.denseUnits,
  gridRows: config.cnn.gridRows,
  gridCols: config.cnn.gridCols,
  channels: config.cnn.channels,
} as const;

/**
 * TRAINING (genetic algorithm and evaluation settings)
 */
export const TRAINING_CONFIG = {
  // Genetic algorithm
  populationSize: config.training.populationSize,
  eliteCount: config.training.eliteCount,
  mutationRate: config.training.mutationRate,
  mutationStrength: config.training.mutationStrength,
  crossoverRate: config.training.crossoverRate,
  maxGenerations: config.training.maxGenerations,
  checkpointInterval: config.training.checkpointInterval,
  verbose: config.training.verbose,
  // Evaluation
  matchesPerGenome: config.training.matchesPerGenome,
  maxGameSteps: config.training.maxGameSteps,
  stepsPerSecond: config.training.stepsPerSecond,
  // Difficulty tiers
  difficultyTiers: config.training.difficultyTiers,
} as const;

/**
 * TRAINING GAME CONFIG (game settings merged with training overrides)
 * Used by training simulator - inherits from game, applies overrides
 */
const trainingOverrides = config.training.overrides || {};
export const TRAINING_GAME_CONFIG = {
  // Base game settings with overrides applied
  playerCount: trainingOverrides.playerCount ?? config.game.playerCount,
  particlesPerPlayer: trainingOverrides.particlesPerPlayer ?? config.game.particlesPerPlayer,
  canvasWidth: trainingOverrides.canvasWidth ?? config.game.canvasWidth,
  canvasHeight: trainingOverrides.canvasHeight ?? config.game.canvasHeight,
  // Win config: merge base game win with overrides
  win: {
    mode: trainingOverrides.win?.mode ?? config.game.win.mode,
    eliminationThreshold: trainingOverrides.win?.eliminationThreshold ?? config.game.win.eliminationThreshold,
    percentageThreshold: trainingOverrides.win?.percentageThreshold ?? config.game.win.percentageThreshold,
  },
} as const;

/**
 * BALANCE RATIOS (computed from other configs)
 * These dimensionless ratios determine gameplay dynamics.
 * See docs/GAME_BALANCE.md for detailed explanations.
 */
export const BALANCE_RATIOS = {
  /** repulsionRadius / conversionRadius - should be < 1 */
  repulsionReach: PARTICLE_CONFIG.repulsionRadius / CONVERSION_CONFIG.radius,

  /** 1 / friendlySupportFactor - attackers need this many more particles */
  defenderAdvantage: 1 / CONVERSION_CONFIG.friendlySupportFactor,

  /** threshold / rate - seconds to convert when outnumbered */
  conversionTime: CONVERSION_CONFIG.threshold / CONVERSION_CONFIG.rate,

  /** (conversionTime × maxVelocity) / conversionRadius - if > 1, escape is easy */
  escapeRatio: (CONVERSION_CONFIG.threshold / CONVERSION_CONFIG.rate)
               * PARTICLE_CONFIG.maxVelocity / CONVERSION_CONFIG.radius,

  /** decayMultiplier - how much faster defenders recover than attackers build */
  recoverySpeed: CONVERSION_CONFIG.decayMultiplier,

  /** enemyRepulsionMultiplier × repulsionStrength / acceleration - higher = more spread */
  enemyClusterDensity: PARTICLE_CONFIG.enemyRepulsionMultiplier
                       * PARTICLE_CONFIG.repulsionStrength / PARTICLE_CONFIG.acceleration,
} as const;
