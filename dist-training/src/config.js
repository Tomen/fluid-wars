// Centralized game configuration
// Reads from config.yaml in the project root
// Works in both browser (Vite) and Node.js (training)
// Load config based on environment
let config;
// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
    // Browser - Vite transforms this import at build time via yaml plugin
    // @ts-ignore - Vite handles yaml imports
    const yamlModule = await import('../config.yaml');
    config = yamlModule.default;
}
else {
    // Node.js - use dynamic imports (ESM compatible)
    const fs = await import('fs');
    const path = await import('path');
    const yaml = await import('js-yaml');
    // Support CONFIG_PATH env var for testing with different configs
    const configFilename = process.env.CONFIG_PATH || 'config.yaml';
    const configPath = path.resolve(process.cwd(), configFilename);
    const configFile = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(configFile);
}
/**
 * GAME SETUP
 */
export const GAME_CONFIG = {
    playerCount: config.game.playerCount,
    particlesPerPlayer: config.game.particlesPerPlayer,
    canvasWidth: config.game.canvasWidth,
    canvasHeight: config.game.canvasHeight,
};
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
};
/**
 * CONVERSION SYSTEM
 */
export const CONVERSION_CONFIG = {
    radius: config.conversion.radius,
    rate: config.conversion.rate,
    threshold: config.conversion.threshold,
    decayMultiplier: config.conversion.decayMultiplier,
    friendlySupportFactor: config.conversion.friendlySupportFactor,
};
/**
 * PLAYER CONTROLS
 */
export const PLAYER_CONFIG = {
    cursorSpeed: config.player.cursorSpeed,
    cursorRadius: config.player.cursorRadius,
};
/**
 * SPATIAL HASH (Performance)
 */
export const SPATIAL_CONFIG = {
    cellSize: config.spatial.cellSize,
};
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
};
/**
 * GAME LOOP
 */
export const GAME_LOOP_CONFIG = {
    fixedDt: config.gameLoop.fixedDt,
    maxAccumulator: config.gameLoop.maxAccumulator,
};
/**
 * WIN CONDITION (for regular play)
 */
export const WIN_CONFIG = {
    mode: config.game.win.mode,
    eliminationThreshold: config.game.win.eliminationThreshold,
    percentageThreshold: config.game.win.percentageThreshold,
};
/**
 * AI CONFIGURATION
 */
export const AI_CONFIG = {
    enabled: config.ai.enabled,
    aiPlayers: config.ai.aiPlayers,
    defaultAIType: config.ai.defaultAIType,
    neuralDifficulty: config.ai.neuralDifficulty,
    useWebWorker: config.ai.useWebWorker,
};
/**
 * RENDERING
 */
export const RENDER_CONFIG = {
    backgroundColor: config.render.backgroundColor,
};
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
};
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
};
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
};
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
};
//# sourceMappingURL=config.js.map