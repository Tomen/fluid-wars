// AI Interface types for game state observation and actions
/**
 * Default simulator configuration
 */
export const DEFAULT_SIMULATOR_CONFIG = {
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
 * Default reward configuration
 */
export const DEFAULT_REWARD_CONFIG = {
    winReward: 100,
    loseReward: -50,
    particleAdvantageMultiplier: 0.1,
    survivalReward: 0.01,
};
//# sourceMappingURL=AIInterface.js.map