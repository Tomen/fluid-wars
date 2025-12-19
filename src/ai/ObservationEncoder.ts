// ObservationEncoder - Convert game state to neural network input

import type { Game } from '../game';
import type { Particle } from '../particle';

/**
 * Configuration for the observation encoder
 */
export interface EncoderConfig {
  /** Number of grid rows */
  gridRows: number;
  /** Number of grid columns */
  gridCols: number;
  /** Number of channels per grid cell */
  channels: number;
  /** Maximum expected particle density per cell (for normalization) */
  maxDensity: number;
  /** Canvas width */
  canvasWidth: number;
  /** Canvas height */
  canvasHeight: number;
}

/**
 * Default encoder configuration
 */
export const DEFAULT_ENCODER_CONFIG: EncoderConfig = {
  gridRows: 16,
  gridCols: 20,
  channels: 5,
  maxDensity: 20,
  canvasWidth: 1200,
  canvasHeight: 800,
};

/**
 * Encodes game state into a fixed-size observation vector for neural networks
 *
 * The observation consists of:
 * 1. A spatial grid with multiple channels (particle densities, obstacles, etc.)
 * 2. Cursor positions for all players (normalized)
 * 3. Particle counts for all players (normalized)
 *
 * All values are normalized to [0, 1] range.
 */
export class ObservationEncoder {
  private config: EncoderConfig;
  private cellWidth: number;
  private cellHeight: number;

  constructor(config: Partial<EncoderConfig> = {}) {
    this.config = { ...DEFAULT_ENCODER_CONFIG, ...config };
    this.cellWidth = this.config.canvasWidth / this.config.gridCols;
    this.cellHeight = this.config.canvasHeight / this.config.gridRows;
  }

  /**
   * Get the total size of the flattened observation vector
   */
  getObservationSize(): number {
    const gridSize = this.config.gridRows * this.config.gridCols * this.config.channels;
    const cursorSize = 4; // 2 players * 2 coordinates (x, y)
    const countSize = 2;  // 2 players particle counts
    return gridSize + cursorSize + countSize;
  }

  /**
   * Encode the game state from a specific player's perspective
   *
   * @param game The game instance
   * @param playerId The player's perspective (0 or 1)
   * @returns Flattened observation vector
   */
  encode(game: Game, playerId: number): number[] {
    const players = game.getPlayers();
    const particles = game.getParticles();
    const obstacles = game.getObstacles();
    const totalParticles = particles.length;

    // Build the grid
    const grid = this.buildGrid(particles, obstacles, playerId);

    // Flatten grid to 1D array
    const flatGrid = this.flattenGrid(grid);

    // Encode cursor positions (from this player's perspective)
    // Self cursor first, then primary enemy cursor
    const selfPlayer = players[playerId];

    // Find primary enemy (first player that isn't us, or player with most particles)
    let enemyPlayer = players.find((_p, i) => i !== playerId);
    if (!enemyPlayer) {
      enemyPlayer = selfPlayer; // Fallback (shouldn't happen)
    }

    const cursorData = [
      selfPlayer.cursorX / this.config.canvasWidth,
      selfPlayer.cursorY / this.config.canvasHeight,
      enemyPlayer.cursorX / this.config.canvasWidth,
      enemyPlayer.cursorY / this.config.canvasHeight,
    ];

    // Encode particle counts (normalized by total)
    // For multi-player: self count vs all enemies combined
    const enemyParticleCount = players
      .filter((_, i) => i !== playerId)
      .reduce((sum, p) => sum + p.particleCount, 0);

    const countData = [
      totalParticles > 0 ? selfPlayer.particleCount / totalParticles : 0.5,
      totalParticles > 0 ? enemyParticleCount / totalParticles : 0.5,
    ];

    // Combine all features
    return [...flatGrid, ...cursorData, ...countData];
  }

  /**
   * Build the spatial grid observation
   *
   * Channels:
   * [0] = friendly particle density (0-1)
   * [1] = enemy particle density (0-1)
   * [2] = obstacle presence (0 or 1)
   * [3] = friendly particle velocity magnitude (0-1)
   * [4] = enemy particle velocity magnitude (0-1)
   */
  private buildGrid(particles: Particle[], obstacles: any[], playerId: number): number[][][] {
    const { gridRows, gridCols, channels, maxDensity } = this.config;

    // Initialize grid with zeros
    const grid: number[][][] = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = [];
      for (let c = 0; c < gridCols; c++) {
        grid[r][c] = new Array(channels).fill(0);
      }
    }

    // Count particles and velocity per cell
    const velocitySum: number[][][] = [];
    for (let r = 0; r < gridRows; r++) {
      velocitySum[r] = [];
      for (let c = 0; c < gridCols; c++) {
        velocitySum[r][c] = [0, 0]; // [friendly velocity sum, enemy velocity sum]
      }
    }

    const maxVelocity = 150; // From PARTICLE_CONFIG.maxVelocity

    for (const particle of particles) {
      const col = Math.floor(particle.x / this.cellWidth);
      const row = Math.floor(particle.y / this.cellHeight);

      if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
        const isFriendly = particle.owner === playerId;
        const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);

        if (isFriendly) {
          grid[row][col][0]++; // Friendly count
          velocitySum[row][col][0] += velocity;
        } else {
          grid[row][col][1]++; // Enemy count
          velocitySum[row][col][1] += velocity;
        }
      }
    }

    // Normalize particle counts and compute average velocities
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const friendlyCount = grid[r][c][0];
        const enemyCount = grid[r][c][1];

        // Normalize counts
        grid[r][c][0] = Math.min(1, friendlyCount / maxDensity);
        grid[r][c][1] = Math.min(1, enemyCount / maxDensity);

        // Compute average velocity magnitudes
        if (friendlyCount > 0) {
          grid[r][c][3] = Math.min(1, (velocitySum[r][c][0] / friendlyCount) / maxVelocity);
        }
        if (enemyCount > 0) {
          grid[r][c][4] = Math.min(1, (velocitySum[r][c][1] / enemyCount) / maxVelocity);
        }
      }
    }

    // Mark obstacle cells
    for (const obstacle of obstacles) {
      this.markObstacleInGrid(grid, obstacle);
    }

    return grid;
  }

  /**
   * Mark obstacle cells in the grid
   */
  private markObstacleInGrid(grid: number[][][], obstacle: any): void {
    const { gridRows, gridCols } = this.config;

    // Handle different obstacle data structures
    const data = obstacle.data || obstacle;

    if (data.width !== undefined && data.height !== undefined) {
      // Rectangle obstacle
      const startCol = Math.floor(data.x / this.cellWidth);
      const endCol = Math.floor((data.x + data.width) / this.cellWidth);
      const startRow = Math.floor(data.y / this.cellHeight);
      const endRow = Math.floor((data.y + data.height) / this.cellHeight);

      for (let r = Math.max(0, startRow); r <= Math.min(gridRows - 1, endRow); r++) {
        for (let c = Math.max(0, startCol); c <= Math.min(gridCols - 1, endCol); c++) {
          grid[r][c][2] = 1;
        }
      }
    } else if (data.radius !== undefined) {
      // Circle obstacle
      const centerCol = Math.floor(data.x / this.cellWidth);
      const centerRow = Math.floor(data.y / this.cellHeight);
      const radiusCells = Math.ceil(data.radius / Math.min(this.cellWidth, this.cellHeight));

      for (let dr = -radiusCells; dr <= radiusCells; dr++) {
        for (let dc = -radiusCells; dc <= radiusCells; dc++) {
          const r = centerRow + dr;
          const c = centerCol + dc;

          if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
            // Check if cell center is within circle
            const cellCenterX = (c + 0.5) * this.cellWidth;
            const cellCenterY = (r + 0.5) * this.cellHeight;
            const dx = cellCenterX - data.x;
            const dy = cellCenterY - data.y;

            if (dx * dx + dy * dy <= data.radius * data.radius) {
              grid[r][c][2] = 1;
            }
          }
        }
      }
    }
  }

  /**
   * Flatten the 3D grid to a 1D array
   * Order: row-major, then channels
   */
  private flattenGrid(grid: number[][][]): number[] {
    const flat: number[] = [];

    for (let r = 0; r < this.config.gridRows; r++) {
      for (let c = 0; c < this.config.gridCols; c++) {
        for (let ch = 0; ch < this.config.channels; ch++) {
          flat.push(grid[r][c][ch]);
        }
      }
    }

    return flat;
  }

  /**
   * Get the grid dimensions for reference
   */
  getGridDimensions(): { rows: number; cols: number; channels: number } {
    return {
      rows: this.config.gridRows,
      cols: this.config.gridCols,
      channels: this.config.channels,
    };
  }
}
