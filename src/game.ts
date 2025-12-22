// Game class to coordinate all game systems

import type { GameConfig, Vec2, WinConfig } from './types';
import type { ScenarioConfig } from './scenario';
import { spawnParticlePositions } from './scenario';
import { Particle } from './particle';
import { Obstacle } from './obstacle';
import { Player } from './player';
import { InputManager } from './input';
import { SpatialHash } from './collision';
import { ConversionSystem } from './conversion';
import { PLAYER_COLORS } from './types';
import { PARTICLE_CONFIG, OBSTACLE_CONFIG, WIN_CONFIG } from './config';
import { POWER_BAR_HEIGHT } from './renderer';
import type { AIController } from './ai/AIController';
import { AsyncNeuralAI } from './ai/AsyncNeuralAI';
import { RandomGenerator } from './maze/RandomGenerator';
import { GridMazeGenerator } from './maze/GridMazeGenerator';
import type { MazeGenerator, SpawnPosition } from './maze/MazeGenerator';
import { profiler } from './profiler';

export class Game {
  private players: Player[] = [];
  private particles: Particle[] = [];
  private obstacles: Obstacle[] = [];
  private input: InputManager;
  private spatialHash: SpatialHash;
  private conversionSystem: ConversionSystem;
  private canvasWidth: number;
  private canvasHeight: number;

  // Cache conversion data to avoid recalculating every frame
  private conversionProgressCache: Map<Particle, number> = new Map();
  private convertingPlayerColorCache: Map<Particle, string> = new Map();

  // Game state
  private winner: number = -1; // -1 = no winner, 0+ = player ID
  private readonly headless: boolean;
  private readonly winConfig: WinConfig;

  // Optional scenario config for custom spawns
  private readonly scenario?: ScenarioConfig;

  // AI controllers (one per AI player)
  private aiControllers: Map<number, AIController> = new Map();

  constructor(config: GameConfig, canvasWidth: number, canvasHeight: number, headless: boolean = false, winConfig?: WinConfig, scenario?: ScenarioConfig) {
    this.headless = headless;
    this.winConfig = winConfig || WIN_CONFIG;
    this.scenario = scenario;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.input = new InputManager(headless);
    this.spatialHash = new SpatialHash();
    this.conversionSystem = new ConversionSystem();

    // Create players
    this.initPlayers(config);

    // Create particles and assign to players
    this.initParticles(config);

    // Create obstacles (skip if scenario disables them)
    if (!scenario || scenario.obstacles?.enabled !== false) {
      this.initObstacles();
    }

    // Only log in non-headless mode
    if (!this.headless) {
      console.log(`Game initialized with ${this.players.length} players`);
      console.log(`Total particles: ${this.particles.length}`);
      console.log(`Obstacles: ${this.obstacles.length}`);
    }
  }

  private initPlayers(config: GameConfig): void {
    const { playerCount } = config;

    // Check if scenario provides custom spawn positions
    const scenarioPlayers = this.scenario?.players;

    // Spawn positions in an ellipse around the center for equidistant spacing (default)
    const margin = 150;
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    // Ellipse radii (fit within canvas with margin)
    const radiusX = (this.canvasWidth / 2) - margin;
    const radiusY = (this.canvasHeight / 2) - margin;

    // Generate equidistant spawn positions around the ellipse
    // Start at top (angle = -PI/2) so player 0 is at top
    const defaultSpawnPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < playerCount; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / playerCount;
      defaultSpawnPositions.push({
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      });
    }

    for (let i = 0; i < playerCount; i++) {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];

      // Use scenario spawn position if available, otherwise use default
      const scenarioPlayer = scenarioPlayers?.find(p => p.id === i);
      const pos = scenarioPlayer?.spawn ?? defaultSpawnPositions[i];

      this.players.push(new Player(i, color, false, pos.x, pos.y));
    }
  }

  private initParticles(config: GameConfig): void {
    const { playerCount, particlesPerPlayer } = config;
    const scenarioPlayers = this.scenario?.players;

    // Spawn particles for each player
    for (let playerId = 0; playerId < playerCount; playerId++) {
      const player = this.players[playerId];
      const scenarioPlayer = scenarioPlayers?.find(p => p.id === playerId);

      // Check if scenario provides custom particle spawn config
      if (scenarioPlayer?.particles) {
        // Use scenario's custom particle spawn pattern
        const positions = spawnParticlePositions(scenarioPlayer.particles);
        for (const pos of positions) {
          const particle = new Particle(pos.x, pos.y);
          particle.owner = player.id;
          particle.color = player.color;
          this.particles.push(particle);
        }
        player.particleCount = scenarioPlayer.particles.count;
      } else {
        // Default: spawn particles near player's cursor (disk pattern)
        const spawnRadius = PARTICLE_CONFIG.spawnRadius;
        const count = scenarioPlayer?.particles?.count ?? particlesPerPlayer;

        for (let i = 0; i < count; i++) {
          // Random angle and distance from cursor
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * spawnRadius;

          const x = player.cursorX + Math.cos(angle) * distance;
          const y = player.cursorY + Math.sin(angle) * distance;

          const particle = new Particle(x, y);
          particle.owner = player.id;
          particle.color = player.color;

          this.particles.push(particle);
        }

        player.particleCount = count;
      }
    }
  }

  private initObstacles(): void {
    // Select generator based on config
    const generator: MazeGenerator = OBSTACLE_CONFIG.generator === 'grid'
      ? new GridMazeGenerator()
      : new RandomGenerator();

    // Get player spawn positions
    const playerSpawns = this.getPlayerSpawns();

    // Generate obstacles using the selected generator
    this.obstacles = generator.generate(
      this.canvasWidth,
      this.canvasHeight,
      playerSpawns,
      OBSTACLE_CONFIG
    );
  }

  /**
   * Get player spawn positions for maze generation
   */
  private getPlayerSpawns(): SpawnPosition[] {
    return this.players.map(player => ({
      x: player.cursorX,
      y: player.cursorY
    }));
  }

  update(dt: number): void {
    // Update players based on input (human) or AI controllers
    // Track AI actions to profile - only wrap getAction(), not cursor movement
    const aiActions: Array<{ player: Player; action: { targetX: number; targetY: number } }> = [];

    profiler.start('update.ai');
    for (let i = 0; i < this.players.length; i++) {
      if (this.aiControllers.has(i)) {
        const ai = this.aiControllers.get(i)!;
        const action = ai.getAction(this);
        aiActions.push({ player: this.players[i], action });
      }
    }
    profiler.end('update.ai');

    // Apply AI actions and handle human input (outside AI profiling)
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];

      if (this.aiControllers.has(i)) {
        // AI player - set cursor directly to target position
        const aiAction = aiActions.find(a => a.player === player);
        if (aiAction) {
          const targetX = aiAction.action.targetX * this.canvasWidth;
          const targetY = aiAction.action.targetY * this.canvasHeight;
          player.setCursor(targetX, targetY, this.canvasWidth, this.canvasHeight);
        }
      } else if (i === 0) {
        // Player 1 - mouse takes priority, fallback to keyboard
        const mousePos = this.input.getMousePosition();
        if (mousePos) {
          // Offset Y by power bar height to convert canvas coords to game coords
          const gameY = mousePos.y - POWER_BAR_HEIGHT;
          player.setCursor(mousePos.x, gameY, this.canvasWidth, this.canvasHeight);
        } else {
          const input = this.input.getPlayerInput(i);
          player.moveCursor(input, dt, this.canvasWidth, this.canvasHeight);
        }
      } else {
        // Other human players - keyboard only
        const input = this.input.getPlayerInput(i);
        player.moveCursor(input, dt, this.canvasWidth, this.canvasHeight);
      }
    }

    // Build spatial hash for efficient collision detection
    profiler.start('update.spatial');
    this.spatialHash.clear();
    for (const particle of this.particles) {
      this.spatialHash.insert(particle);
    }
    profiler.end('update.spatial');

    // Clear conversion caches
    this.conversionProgressCache.clear();
    this.convertingPlayerColorCache.clear();

    // Update particles - each particle follows its owner's cursor
    profiler.start('update.physics');
    for (const particle of this.particles) {
      const owner = this.players[particle.owner];
      if (!owner) continue;

      const cursorPos: Vec2 = { x: owner.cursorX, y: owner.cursorY };

      // Query nearby particles from spatial hash (much faster than checking all particles)
      const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);

      particle.update(dt, cursorPos, this.canvasWidth, this.canvasHeight, nearbyParticles, this.obstacles);
    }
    profiler.end('update.physics');

    // Handle conversion system
    profiler.start('update.convert');
    for (const particle of this.particles) {
      const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);

      // Check for conversion
      const shouldConvert = this.conversionSystem.updateConversion(particle, nearbyParticles, dt);

      if (shouldConvert) {
        // Find which player should take ownership
        const newOwner = this.conversionSystem.getDominantEnemyPlayer(particle, nearbyParticles);

        if (newOwner !== -1 && newOwner !== particle.owner) {
          // Update particle counts
          this.players[particle.owner].particleCount--;
          this.players[newOwner].particleCount++;

          // Transfer ownership
          particle.owner = newOwner;
          particle.color = this.players[newOwner].color;
        }
      }

      // Cache conversion data for rendering (avoid recalculating each frame)
      const progress = this.conversionSystem.getProgress(particle);
      if (progress > 0) {
        this.conversionProgressCache.set(particle, progress);

        // Find dominant enemy player for color
        const dominantPlayer = this.conversionSystem.getDominantEnemyPlayer(particle, nearbyParticles);
        if (dominantPlayer !== -1) {
          this.convertingPlayerColorCache.set(particle, this.players[dominantPlayer].color);
        }
      }
    }
    profiler.end('update.convert');

    // Check win condition
    if (this.winner === -1) {
      this.checkWinCondition();
    }
  }

  private checkWinCondition(): void {
    const totalParticles = this.particles.length;

    if (this.winConfig.mode === 'elimination') {
      // Elimination mode: player loses when they have <= threshold particles
      for (const player of this.players) {
        if (player.particleCount <= this.winConfig.eliminationThreshold) {
          // Find the winner (player with most particles remaining)
          let maxParticles = -1;
          for (const p of this.players) {
            if (p.particleCount > maxParticles) {
              maxParticles = p.particleCount;
              this.winner = p.id;
            }
          }
          if (!this.headless) {
            console.log(`Player ${this.winner + 1} wins by elimination!`);
          }
          break;
        }
      }
    } else if (this.winConfig.mode === 'percentage') {
      // Percentage mode: player wins when they control X% of all particles
      for (const player of this.players) {
        const percentage = player.particleCount / totalParticles;
        if (percentage >= this.winConfig.percentageThreshold) {
          this.winner = player.id;
          if (!this.headless) {
            console.log(`Player ${this.winner + 1} wins with ${(percentage * 100).toFixed(1)}% of particles!`);
          }
          break;
        }
      }
    }
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  getObstacles(): Obstacle[] {
    return this.obstacles;
  }

  getSpatialHashStats(): { cellCount: number; particleCount: number } {
    return {
      cellCount: this.spatialHash.getCellCount(),
      particleCount: this.spatialHash.getCount()
    };
  }

  getConversionProgress(particle: Particle): number {
    return this.conversionSystem.getProgress(particle);
  }

  getConversionProgressMap(): Map<Particle, number> {
    return this.conversionProgressCache;
  }

  getConvertingPlayerColorMap(): Map<Particle, string> {
    return this.convertingPlayerColorCache;
  }

  isGameOver(): boolean {
    return this.winner !== -1;
  }

  getWinner(): number {
    return this.winner;
  }

  getWinnerPlayer(): Player | null {
    if (this.winner === -1) return null;
    return this.players[this.winner];
  }

  destroy(): void {
    this.input.destroy();
  }

  /**
   * Set the canvas for mouse input tracking
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.input.setCanvas(canvas);
  }

  /**
   * Set an AI controller for a player
   * @param playerId The player ID to control
   * @param controller The AI controller to use
   */
  setAIController(playerId: number, controller: AIController): void {
    if (playerId < 0 || playerId >= this.players.length) {
      throw new Error(`Invalid player ID: ${playerId}`);
    }
    this.aiControllers.set(playerId, controller);
    this.players[playerId].isAI = true;
  }

  /**
   * Remove an AI controller from a player
   * @param playerId The player ID to remove AI from
   */
  removeAIController(playerId: number): void {
    this.aiControllers.delete(playerId);
    if (playerId >= 0 && playerId < this.players.length) {
      this.players[playerId].isAI = false;
    }
  }

  /**
   * Check if a player has an AI controller
   */
  hasAIController(playerId: number): boolean {
    return this.aiControllers.has(playerId);
  }

  /**
   * Get the canvas dimensions
   */
  getCanvasSize(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }

  /**
   * Get worker stats from all AsyncNeuralAI controllers
   */
  getWorkerStats(): {
    playerId: number;
    computeCount: number;
    avgComputeTime: number;
    avgEncodeTime: number;
    avgPredictTime: number;
    lastComputeTime: number;
  }[] {
    const stats: {
      playerId: number;
      computeCount: number;
      avgComputeTime: number;
      avgEncodeTime: number;
      avgPredictTime: number;
      lastComputeTime: number;
    }[] = [];

    for (const [playerId, controller] of this.aiControllers) {
      if (controller instanceof AsyncNeuralAI) {
        const workerStats = controller.getStats();
        stats.push({
          playerId,
          ...workerStats,
        });
      }
    }

    return stats;
  }
}
