// ObservationEncoder - Convert game state to neural network input
import { CNN_CONFIG } from '../config';
/**
 * Default encoder configuration - uses CNN_CONFIG values for consistency
 */
export const DEFAULT_ENCODER_CONFIG = {
    gridRows: CNN_CONFIG.gridRows,
    gridCols: CNN_CONFIG.gridCols,
    channels: CNN_CONFIG.channels,
    maxDensity: 20,
    canvasWidth: 1200,
    canvasHeight: 800,
};
/**
 * Encodes game state into a 3D grid observation for CNN input
 *
 * The observation is a 3D grid with shape [gridRows][gridCols][channels]:
 * - Channel 0: friendly particle density (0-1)
 * - Channel 1: enemy particle density (all enemies combined, 0-1)
 * - Channel 2: obstacle coverage (0-1, fractional area)
 * - Channel 3: friendly particle velocity magnitude (0-1)
 * - Channel 4: enemy particle velocity magnitude (0-1)
 *
 * All values are normalized to [0, 1] range.
 * Works with 2-8 players (all non-self players treated as "enemy").
 */
export class ObservationEncoder {
    config;
    cellWidth;
    cellHeight;
    // Cached obstacle grid (fractional coverage, computed once per obstacle set)
    cachedObstacleGrid = null;
    cachedObstacles = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_ENCODER_CONFIG, ...config };
        this.cellWidth = this.config.canvasWidth / this.config.gridCols;
        this.cellHeight = this.config.canvasHeight / this.config.gridRows;
    }
    /**
     * Get or compute the obstacle grid with fractional coverage.
     * Cached since obstacles are static.
     */
    getObstacleGrid(obstacles) {
        // Check if we need to recompute (different obstacle array reference)
        if (this.cachedObstacleGrid === null || this.cachedObstacles !== obstacles) {
            this.cachedObstacleGrid = this.computeObstacleGrid(obstacles);
            this.cachedObstacles = obstacles;
        }
        return this.cachedObstacleGrid;
    }
    /**
     * Compute obstacle grid with fractional coverage.
     * Each cell contains the fraction of the cell area covered by obstacles (0-1).
     */
    computeObstacleGrid(obstacles) {
        const { gridRows, gridCols } = this.config;
        // Initialize grid with zeros
        const grid = [];
        for (let r = 0; r < gridRows; r++) {
            grid[r] = new Array(gridCols).fill(0);
        }
        // Calculate fractional coverage for each obstacle
        for (const obstacle of obstacles) {
            this.addObstacleCoverage(grid, obstacle);
        }
        return grid;
    }
    /**
     * Add fractional coverage for a single obstacle to the grid.
     */
    addObstacleCoverage(grid, obstacle) {
        const { gridRows, gridCols } = this.config;
        const data = obstacle.data || obstacle;
        if (data.width !== undefined && data.height !== undefined) {
            // Rectangle obstacle - calculate exact overlap
            const obstacleLeft = data.x;
            const obstacleRight = data.x + data.width;
            const obstacleTop = data.y;
            const obstacleBottom = data.y + data.height;
            // Find cells that might overlap
            const startCol = Math.max(0, Math.floor(obstacleLeft / this.cellWidth));
            const endCol = Math.min(gridCols - 1, Math.floor(obstacleRight / this.cellWidth));
            const startRow = Math.max(0, Math.floor(obstacleTop / this.cellHeight));
            const endRow = Math.min(gridRows - 1, Math.floor(obstacleBottom / this.cellHeight));
            const cellArea = this.cellWidth * this.cellHeight;
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    // Cell bounds
                    const cellLeft = c * this.cellWidth;
                    const cellRight = cellLeft + this.cellWidth;
                    const cellTop = r * this.cellHeight;
                    const cellBottom = cellTop + this.cellHeight;
                    // Calculate intersection
                    const overlapLeft = Math.max(cellLeft, obstacleLeft);
                    const overlapRight = Math.min(cellRight, obstacleRight);
                    const overlapTop = Math.max(cellTop, obstacleTop);
                    const overlapBottom = Math.min(cellBottom, obstacleBottom);
                    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
                    const overlapHeight = Math.max(0, overlapBottom - overlapTop);
                    const overlapArea = overlapWidth * overlapHeight;
                    // Add fractional coverage (clamped to 1.0)
                    grid[r][c] = Math.min(1, grid[r][c] + overlapArea / cellArea);
                }
            }
        }
        else if (data.radius !== undefined) {
            // Circle obstacle - approximate with bounding box overlap
            const obstacleLeft = data.x - data.radius;
            const obstacleRight = data.x + data.radius;
            const obstacleTop = data.y - data.radius;
            const obstacleBottom = data.y + data.radius;
            const startCol = Math.max(0, Math.floor(obstacleLeft / this.cellWidth));
            const endCol = Math.min(gridCols - 1, Math.floor(obstacleRight / this.cellWidth));
            const startRow = Math.max(0, Math.floor(obstacleTop / this.cellHeight));
            const endRow = Math.min(gridRows - 1, Math.floor(obstacleBottom / this.cellHeight));
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    // Sample points within the cell to estimate circle coverage
                    const cellLeft = c * this.cellWidth;
                    const cellTop = r * this.cellHeight;
                    const samples = 4; // 4x4 grid of sample points
                    let insideCount = 0;
                    for (let sy = 0; sy < samples; sy++) {
                        for (let sx = 0; sx < samples; sx++) {
                            const px = cellLeft + (sx + 0.5) * this.cellWidth / samples;
                            const py = cellTop + (sy + 0.5) * this.cellHeight / samples;
                            const dx = px - data.x;
                            const dy = py - data.y;
                            if (dx * dx + dy * dy <= data.radius * data.radius) {
                                insideCount++;
                            }
                        }
                    }
                    const coverage = insideCount / (samples * samples);
                    grid[r][c] = Math.min(1, grid[r][c] + coverage);
                }
            }
        }
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
    buildGrid(particles, obstacles, playerId) {
        const { gridRows, gridCols, channels, maxDensity } = this.config;
        // Initialize grid with zeros
        const grid = [];
        for (let r = 0; r < gridRows; r++) {
            grid[r] = [];
            for (let c = 0; c < gridCols; c++) {
                grid[r][c] = new Array(channels).fill(0);
            }
        }
        // Count particles and velocity per cell
        const velocitySum = [];
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
                }
                else {
                    grid[row][col][1]++; // Enemy count
                    velocitySum[row][col][1] += velocity;
                }
            }
        }
        // Get cached obstacle grid (fractional coverage)
        const obstacleGrid = this.getObstacleGrid(obstacles);
        // Normalize particle counts and compute average velocities
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const friendlyCount = grid[r][c][0];
                const enemyCount = grid[r][c][1];
                // Normalize counts
                grid[r][c][0] = Math.min(1, friendlyCount / maxDensity);
                grid[r][c][1] = Math.min(1, enemyCount / maxDensity);
                // Copy fractional obstacle coverage from cached grid
                grid[r][c][2] = obstacleGrid[r][c];
                // Compute average velocity magnitudes
                if (friendlyCount > 0) {
                    grid[r][c][3] = Math.min(1, (velocitySum[r][c][0] / friendlyCount) / maxVelocity);
                }
                if (enemyCount > 0) {
                    grid[r][c][4] = Math.min(1, (velocitySum[r][c][1] / enemyCount) / maxVelocity);
                }
            }
        }
        return grid;
    }
    /**
     * Encode the game state as a 3D grid for CNN input
     * Returns shape [gridRows][gridCols][channels]
     *
     * @param game The game instance
     * @param playerId The player's perspective (0 to playerCount-1)
     * @returns 3D grid observation
     */
    encode3D(game, playerId) {
        const particles = game.getParticles();
        const obstacles = game.getObstacles();
        return this.buildGrid(particles, obstacles, playerId);
    }
    /**
     * Get the grid dimensions for reference
     */
    getGridDimensions() {
        return {
            rows: this.config.gridRows,
            cols: this.config.gridCols,
            channels: this.config.channels,
        };
    }
}
//# sourceMappingURL=ObservationEncoder.js.map