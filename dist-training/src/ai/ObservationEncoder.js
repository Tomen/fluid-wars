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
 * - Channel 2: obstacle presence (0 or 1)
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
    constructor(config = {}) {
        this.config = { ...DEFAULT_ENCODER_CONFIG, ...config };
        this.cellWidth = this.config.canvasWidth / this.config.gridCols;
        this.cellHeight = this.config.canvasHeight / this.config.gridRows;
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
    markObstacleInGrid(grid, obstacle) {
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
        }
        else if (data.radius !== undefined) {
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