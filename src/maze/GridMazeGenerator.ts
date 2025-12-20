// GridMazeGenerator - Grid-based maze with walls and gaps

import { Obstacle } from '../obstacle';
import type { MazeGenerator, MazeConfig, SpawnPosition } from './MazeGenerator';

/**
 * Grid-based maze generator
 *
 * Creates a maze structure with horizontal and vertical walls
 * arranged on a grid, with random gaps for passage.
 * This creates more strategic gameplay by forcing players
 * to navigate through corridors.
 */
export class GridMazeGenerator implements MazeGenerator {
  generate(
    canvasWidth: number,
    canvasHeight: number,
    playerSpawns: SpawnPosition[],
    config: MazeConfig
  ): Obstacle[] {
    const obstacles: Obstacle[] = [];

    const { gridSpacing, wallThickness, gapSize, wallProbability, playerMargin } = config;

    // Margin from canvas edges
    const edgeMargin = 50;

    // Generate horizontal walls
    for (let y = gridSpacing; y < canvasHeight - edgeMargin; y += gridSpacing) {
      this.generateWallLine(
        obstacles,
        edgeMargin,
        canvasWidth - edgeMargin,
        y,
        'horizontal',
        wallThickness,
        gapSize,
        wallProbability,
        playerSpawns,
        playerMargin
      );
    }

    // Generate vertical walls
    for (let x = gridSpacing; x < canvasWidth - edgeMargin; x += gridSpacing) {
      this.generateWallLine(
        obstacles,
        edgeMargin,
        canvasHeight - edgeMargin,
        x,
        'vertical',
        wallThickness,
        gapSize,
        wallProbability,
        playerSpawns,
        playerMargin
      );
    }

    return obstacles;
  }

  /**
   * Generate a line of wall segments with gaps
   */
  private generateWallLine(
    obstacles: Obstacle[],
    start: number,
    end: number,
    position: number,
    direction: 'horizontal' | 'vertical',
    thickness: number,
    gapSize: number,
    probability: number,
    playerSpawns: SpawnPosition[],
    playerMargin: number
  ): void {
    const segmentLength = 100; // Length of each wall segment
    let current = start;

    while (current < end) {
      // Decide if we place a wall segment or a gap
      const isGap = Math.random() > probability;

      if (isGap) {
        // Create a gap
        current += gapSize;
      } else {
        // Create a wall segment
        const length = Math.min(segmentLength, end - current);

        let x: number, y: number, width: number, height: number;

        if (direction === 'horizontal') {
          x = current;
          y = position - thickness / 2;
          width = length;
          height = thickness;
        } else {
          x = position - thickness / 2;
          y = current;
          width = thickness;
          height = length;
        }

        // Check if wall is too close to any player spawn
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

        if (!tooCloseToSpawn) {
          obstacles.push(new Obstacle({
            type: 'rect',
            x,
            y,
            width,
            height
          }));
        }

        current += length;
      }

      // Add small random variation to prevent perfect alignment
      current += Math.random() * 20;
    }
  }
}
