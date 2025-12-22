// GameSimulator - Headless game wrapper for AI training

import { Game } from '../game';
import { Player } from '../player';
import { Particle } from '../particle';
import type { GameConfig } from '../types';
import type { ScenarioConfig } from '../scenario';
import type {
  GameState,
  StepResult,
  SimulatorConfig,
  AIAction,
  RewardConfig,
} from './AIInterface';

/**
 * Headless game simulator for AI training
 * Wraps the Game class and provides a step-based interface
 */
export class GameSimulator {
  private game: Game;
  private config: SimulatorConfig;
  private rewardConfig: RewardConfig;
  private stepCount: number = 0;
  private previousParticleCounts: number[] = [];

  // Cached obstacle grid (fractional coverage, computed once per game)
  private cachedObstacleGrid: number[][] | null = null;

  // Optional scenario config for custom spawns
  private scenario?: ScenarioConfig;

  constructor(
    config: Partial<SimulatorConfig> = {},
    rewardConfig: Partial<RewardConfig> = {},
    scenario?: ScenarioConfig
  ) {
    // Merge with defaults
    this.config = {
      playerCount: config.playerCount ?? 2,
      particlesPerPlayer: config.particlesPerPlayer ?? 200,
      canvasWidth: config.canvasWidth ?? 1200,
      canvasHeight: config.canvasHeight ?? 800,
      fixedDt: config.fixedDt ?? 1 / 60,
      maxSteps: config.maxSteps ?? 3600,
      gridRows: config.gridRows ?? 16,
      gridCols: config.gridCols ?? 20,
      winConfig: config.winConfig,
    };

    this.rewardConfig = {
      winReward: rewardConfig.winReward ?? 100,
      loseReward: rewardConfig.loseReward ?? -50,
      particleAdvantageMultiplier: rewardConfig.particleAdvantageMultiplier ?? 0.1,
      survivalReward: rewardConfig.survivalReward ?? 0.01,
    };

    // Store scenario config
    this.scenario = scenario;

    // Create the game
    this.game = this.createGame();
    this.initializePreviousCounts();
  }

  private createGame(): Game {
    const gameConfig: GameConfig = {
      playerCount: this.config.playerCount,
      particlesPerPlayer: this.config.particlesPerPlayer,
    };

    // Pass headless=true to avoid browser dependencies, and optional winConfig and scenario
    return new Game(
      gameConfig,
      this.config.canvasWidth,
      this.config.canvasHeight,
      true,
      this.config.winConfig,
      this.scenario
    );
  }

  private initializePreviousCounts(): void {
    this.previousParticleCounts = this.game.getPlayers().map(p => p.particleCount);
  }

  /**
   * Reset the simulator to initial state
   */
  reset(): GameState {
    // Destroy old game
    this.game.destroy();

    // Create new game
    this.game = this.createGame();
    this.stepCount = 0;
    this.initializePreviousCounts();

    // Clear cached obstacle grid (new game may have different obstacles)
    this.cachedObstacleGrid = null;

    return this.getState();
  }

  /**
   * Advance the simulation by one timestep
   * @param actions Map of player ID to their action (target cursor position)
   */
  step(actions: Map<number, AIAction>): StepResult {
    // Apply AI actions - set cursor positions directly
    const players = this.game.getPlayers();
    for (const [playerId, action] of actions) {
      const player = players[playerId];
      if (player) {
        this.applyAIAction(player, action);
      }
    }

    // Run one physics step
    this.game.update(this.config.fixedDt);
    this.stepCount++;

    // Calculate rewards
    const rewards = this.calculateRewards();

    // Check if done
    const done = this.isTerminal();
    const winner = this.game.getWinner();

    // Update previous counts for next step
    this.initializePreviousCounts();

    return {
      state: this.getState(),
      rewards,
      done,
      winner,
      stepCount: this.stepCount,
    };
  }

  /**
   * Apply an AI action to a player (set cursor directly to target)
   */
  private applyAIAction(player: Player, action: AIAction): void {
    // Convert normalized action to canvas coordinates
    const targetX = action.targetX * this.config.canvasWidth;
    const targetY = action.targetY * this.config.canvasHeight;

    // Set cursor directly to target position
    player.setCursor(targetX, targetY, this.config.canvasWidth, this.config.canvasHeight);
  }

  /**
   * Calculate rewards for each player
   */
  private calculateRewards(): Map<number, number> {
    const rewards = new Map<number, number>();
    const players = this.game.getPlayers();

    for (const player of players) {
      let reward = 0;

      // Check for win/lose
      if (this.game.isGameOver()) {
        if (this.game.getWinner() === player.id) {
          reward += this.rewardConfig.winReward;
        } else {
          reward += this.rewardConfig.loseReward;
        }
      } else {
        // Ongoing game rewards
        // Reward for gaining particles (or penalize for losing)
        const previousCount = this.previousParticleCounts[player.id] || 0;
        const particleChange = player.particleCount - previousCount;
        reward += particleChange * this.rewardConfig.particleAdvantageMultiplier;

        // Small survival bonus
        reward += this.rewardConfig.survivalReward;
      }

      rewards.set(player.id, reward);
    }

    return rewards;
  }

  /**
   * Get the current game state for AI observation
   */
  getState(): GameState {
    const players = this.game.getPlayers();
    const particles = this.game.getParticles();
    const obstacles = this.game.getObstacles();
    const totalParticles = particles.length;

    // Build the grid observation
    const grid = this.buildGrid(particles, obstacles);

    // Normalize cursor positions
    const cursorPositions = players.map(p => ({
      x: p.cursorX / this.config.canvasWidth,
      y: p.cursorY / this.config.canvasHeight,
    }));

    // Normalize particle counts
    const particleCounts = players.map(p =>
      totalParticles > 0 ? p.particleCount / totalParticles : 0
    );

    // Normalize time
    const timeElapsed = this.config.maxSteps > 0
      ? this.stepCount / this.config.maxSteps
      : 0;

    return {
      grid,
      cursorPositions,
      particleCounts,
      timeElapsed,
      totalParticles,
      canvasWidth: this.config.canvasWidth,
      canvasHeight: this.config.canvasHeight,
    };
  }

  /**
   * Build the spatial grid observation
   */
  private buildGrid(particles: Particle[], obstacles: any[]): number[][][] {
    const { gridRows, gridCols } = this.config;
    const cellWidth = this.config.canvasWidth / gridCols;
    const cellHeight = this.config.canvasHeight / gridRows;

    // Initialize grid: [rows][cols][5 channels]
    // Channels: friendly(0), enemy(1), obstacle(2), friendly_conversion(3), enemy_conversion(4)
    const grid: number[][][] = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = [];
      for (let c = 0; c < gridCols; c++) {
        grid[r][c] = [0, 0, 0, 0, 0];
      }
    }

    // Count particles per cell (for player 0's perspective)
    // Note: For player 1, we would swap friendly/enemy channels
    for (const particle of particles) {
      const col = Math.floor(particle.x / cellWidth);
      const row = Math.floor(particle.y / cellHeight);

      if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
        if (particle.owner === 0) {
          grid[row][col][0]++; // Friendly
        } else {
          grid[row][col][1]++; // Enemy
        }
      }
    }

    // Get cached obstacle grid (fractional coverage)
    if (this.cachedObstacleGrid === null) {
      this.cachedObstacleGrid = this.computeObstacleGrid(obstacles, cellWidth, cellHeight);
    }

    // Normalize particle counts and copy obstacle coverage
    const maxDensity = 20; // Tune this based on game parameters
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        grid[r][c][0] = Math.min(1, grid[r][c][0] / maxDensity);
        grid[r][c][1] = Math.min(1, grid[r][c][1] / maxDensity);
        grid[r][c][2] = this.cachedObstacleGrid![r][c]; // Fractional obstacle coverage
        // Channels 3, 4 (conversion pressure) would need ConversionSystem access
        // For now, leave as 0 - can be added later
      }
    }

    return grid;
  }

  /**
   * Compute obstacle grid with fractional coverage.
   */
  private computeObstacleGrid(obstacles: any[], cellWidth: number, cellHeight: number): number[][] {
    const { gridRows, gridCols } = this.config;
    const cellArea = cellWidth * cellHeight;

    // Initialize grid with zeros
    const grid: number[][] = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = new Array(gridCols).fill(0);
    }

    // Calculate fractional coverage for each obstacle
    for (const obstacle of obstacles) {
      const data = obstacle.data || obstacle;

      if (data.width !== undefined && data.height !== undefined) {
        const obstacleLeft = data.x;
        const obstacleRight = data.x + data.width;
        const obstacleTop = data.y;
        const obstacleBottom = data.y + data.height;

        const startCol = Math.max(0, Math.floor(obstacleLeft / cellWidth));
        const endCol = Math.min(gridCols - 1, Math.floor(obstacleRight / cellWidth));
        const startRow = Math.max(0, Math.floor(obstacleTop / cellHeight));
        const endRow = Math.min(gridRows - 1, Math.floor(obstacleBottom / cellHeight));

        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cellLeft = c * cellWidth;
            const cellRight = cellLeft + cellWidth;
            const cellTop = r * cellHeight;
            const cellBottom = cellTop + cellHeight;

            const overlapLeft = Math.max(cellLeft, obstacleLeft);
            const overlapRight = Math.min(cellRight, obstacleRight);
            const overlapTop = Math.max(cellTop, obstacleTop);
            const overlapBottom = Math.min(cellBottom, obstacleBottom);

            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const overlapHeight = Math.max(0, overlapBottom - overlapTop);
            const overlapArea = overlapWidth * overlapHeight;

            grid[r][c] = Math.min(1, grid[r][c] + overlapArea / cellArea);
          }
        }
      }
    }

    return grid;
  }

  /**
   * Check if the game is in a terminal state
   */
  isTerminal(): boolean {
    // Game over (someone won)
    if (this.game.isGameOver()) {
      return true;
    }

    // Max steps reached
    if (this.config.maxSteps > 0 && this.stepCount >= this.config.maxSteps) {
      return true;
    }

    return false;
  }

  /**
   * Get the winner ID (-1 if no winner)
   */
  getWinner(): number {
    return this.game.getWinner();
  }

  /**
   * Get the current step count
   */
  getStepCount(): number {
    return this.stepCount;
  }

  /**
   * Get the underlying game (for advanced access)
   */
  getGame(): Game {
    return this.game;
  }

  /**
   * Get the simulator configuration
   */
  getConfig(): SimulatorConfig {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.game.destroy();
  }
}
