// MazeGenerator - Interface for obstacle/maze generation strategies

import type { Obstacle } from '../obstacle';

/**
 * Configuration passed to maze generators
 */
export interface MazeConfig {
  // Common settings
  playerMargin: number;

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
}

/**
 * Player spawn position
 */
export interface SpawnPosition {
  x: number;
  y: number;
}

/**
 * Interface for maze/obstacle generators
 *
 * Generators create obstacle layouts for the game.
 * Different generators can create different styles of mazes.
 */
export interface MazeGenerator {
  /**
   * Generate obstacles for the game
   *
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   * @param playerSpawns - Array of player spawn positions
   * @param config - Configuration for the generator
   * @returns Array of generated obstacles
   */
  generate(
    canvasWidth: number,
    canvasHeight: number,
    playerSpawns: SpawnPosition[],
    config: MazeConfig
  ): Obstacle[];
}
