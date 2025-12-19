// Spatial hashing for efficient collision detection

import type { Particle } from './particle';
import { SPATIAL_CONFIG } from './config';

export class SpatialHash {
  private grid: Map<string, Particle[]> = new Map();
  private readonly cellSize: number;

  constructor(cellSize: number = SPATIAL_CONFIG.cellSize) {
    this.cellSize = cellSize;
  }

  /**
   * Converts world coordinates to grid cell coordinates
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Clears all particles from the spatial hash
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Inserts a particle into the spatial hash
   */
  insert(particle: Particle): void {
    const key = this.getCellKey(particle.x, particle.y);

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }

    this.grid.get(key)!.push(particle);
  }

  /**
   * Queries nearby particles within a certain radius
   * Returns particles in the same cell and adjacent cells
   */
  queryNearby(x: number, y: number): Particle[] {
    const nearby: Particle[] = [];

    // Get the cell coordinates
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);

    // Check the current cell and 8 adjacent cells (3x3 grid)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const particles = this.grid.get(key);

        if (particles) {
          nearby.push(...particles);
        }
      }
    }

    return nearby;
  }

  /**
   * Gets the total number of particles in the spatial hash
   */
  getCount(): number {
    let count = 0;
    for (const particles of this.grid.values()) {
      count += particles.length;
    }
    return count;
  }

  /**
   * Gets the number of cells in use
   */
  getCellCount(): number {
    return this.grid.size;
  }
}
