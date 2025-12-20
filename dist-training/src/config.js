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
    const configPath = path.resolve(process.cwd(), 'config.yaml');
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
 * WIN CONDITION
 */
export const WIN_CONFIG = {
    mode: config.win.mode,
    eliminationThreshold: config.win.eliminationThreshold,
    percentageThreshold: config.win.percentageThreshold,
};
/**
 * AI CONFIGURATION
 */
export const AI_CONFIG = {
    enabled: config.ai.enabled,
    aiPlayers: config.ai.aiPlayers,
    defaultAIType: config.ai.defaultAIType,
    neuralDifficulty: config.ai.neuralDifficulty,
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
 * TRAINING
 */
export const TRAINING_CONFIG = {
    populationSize: config.training.populationSize,
    eliteCount: config.training.eliteCount,
    mutationRate: config.training.mutationRate,
    mutationStrength: config.training.mutationStrength,
    crossoverRate: config.training.crossoverRate,
    maxGenerations: config.training.maxGenerations,
    checkpointInterval: config.training.checkpointInterval,
    verbose: config.training.verbose,
    matchesPerGenome: config.training.matchesPerGenome,
    maxGameSteps: config.training.maxGameSteps,
    stepsPerSecond: config.training.stepsPerSecond,
    simulator: config.training.simulator,
    difficultyTiers: config.training.difficultyTiers,
};
//# sourceMappingURL=config.js.map