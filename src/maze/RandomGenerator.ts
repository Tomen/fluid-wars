// RandomGenerator - Random obstacle placement (original behavior)

import { Obstacle } from '../obstacle';
import type { MazeGenerator, MazeConfig, SpawnPosition } from './MazeGenerator';

/**
 * Random obstacle generator
 *
 * Places random rectangular obstacles throughout the canvas,
 * avoiding player spawn areas. This is the original obstacle
 * generation behavior.
 */
export class RandomGenerator implements MazeGenerator {
  generate(
    canvasWidth: number,
    canvasHeight: number,
    playerSpawns: SpawnPosition[],
    config: MazeConfig
  ): Obstacle[] {
    const obstacles: Obstacle[] = [];

    const { size, minSizeMultiplier, maxSizeMultiplier, minCount, maxCount, playerMargin } = config;

    // Number of obstacles to generate
    const numObstacles = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

    // Size variation based on config multipliers
    const minSize = size * minSizeMultiplier;
    const maxSize = size * maxSizeMultiplier;

    for (let i = 0; i < numObstacles; i++) {
      // Random size (width and height can differ)
      const width = minSize + Math.random() * (maxSize - minSize);
      const height = minSize + Math.random() * (maxSize - minSize);

      // Random position within canvas bounds
      const x = Math.random() * (canvasWidth - width);
      const y = Math.random() * (canvasHeight - height);

      // Check if too close to any player spawn
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      let tooCloseToSpawn = false;
      for (const spawn of playerSpawns) {
        const dist = Math.sqrt((centerX - spawn.x) ** 2 + (centerY - spawn.y) ** 2);
        if (dist < playerMargin) {
          tooCloseToSpawn = true;
          break;
        }
      }

      if (tooCloseToSpawn) {
        continue; // Skip this obstacle, don't block player spawns
      }

      obstacles.push(new Obstacle({
        type: 'rect',
        x,
        y,
        width,
        height
      }));
    }

    return obstacles;
  }
}
