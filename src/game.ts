// Game class to coordinate all game systems

import type { GameConfig, Vec2 } from './types';
import { Particle } from './particle';
import { Obstacle } from './obstacle';
import { Player } from './player';
import { InputManager } from './input';
import { SpatialHash } from './collision';
import { ConversionSystem } from './conversion';
import { PLAYER_COLORS } from './types';
import { PARTICLE_CONFIG, OBSTACLE_CONFIG, WIN_CONFIG } from './config';
import type { AIController } from './ai/AIController';

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

  // AI controllers (one per AI player)
  private aiControllers: Map<number, AIController> = new Map();

  constructor(config: GameConfig, canvasWidth: number, canvasHeight: number, headless: boolean = false) {
    this.headless = headless;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.input = new InputManager(headless);
    this.spatialHash = new SpatialHash();
    this.conversionSystem = new ConversionSystem();

    // Create players
    this.initPlayers(config);

    // Create particles and assign to players
    this.initParticles(config);

    // Create obstacles
    this.initObstacles();

    // Only log in non-headless mode
    if (!this.headless) {
      console.log(`Game initialized with ${this.players.length} players`);
      console.log(`Total particles: ${this.particles.length}`);
      console.log(`Obstacles: ${this.obstacles.length}`);
    }
  }

  private initPlayers(config: GameConfig): void {
    const { playerCount } = config;

    // Corner positions with margin from edges
    const margin = 150;
    const corners = [
      { x: margin, y: margin },                                    // top-left
      { x: this.canvasWidth - margin, y: margin },                 // top-right
      { x: margin, y: this.canvasHeight - margin },                // bottom-left
      { x: this.canvasWidth - margin, y: this.canvasHeight - margin }, // bottom-right
    ];

    for (let i = 0; i < playerCount; i++) {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      // Start players in corners (or spread evenly if more than 4)
      const pos = corners[i % corners.length];

      this.players.push(new Player(i, color, false, pos.x, pos.y));
    }
  }

  private initParticles(config: GameConfig): void {
    const { playerCount, particlesPerPlayer } = config;

    // Spawn particles near each player's cursor
    for (let playerId = 0; playerId < playerCount; playerId++) {
      const player = this.players[playerId];
      const spawnRadius = PARTICLE_CONFIG.spawnRadius;

      for (let i = 0; i < particlesPerPlayer; i++) {
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

      player.particleCount = particlesPerPlayer;
    }
  }

  private initObstacles(): void {
    // Create randomly positioned and sized obstacles
    const { size, margin } = OBSTACLE_CONFIG;

    // Number of obstacles to generate (roughly similar density to old grid)
    const numObstacles = 25 + Math.floor(Math.random() * 15); // 25-40 obstacles

    // Size variation: obstacles can be 50% to 500% of base size
    const minSize = size * 0.5;
    const maxSize = size * 5;

    // Keep track of player spawn areas to avoid blocking them
    const playerMargin = 200; // Don't place obstacles too close to corners

    for (let i = 0; i < numObstacles; i++) {
      // Random size (width and height can differ)
      const width = minSize + Math.random() * (maxSize - minSize);
      const height = minSize + Math.random() * (maxSize - minSize);

      // Random position within canvas bounds (with margin)
      const x = margin + Math.random() * (this.canvasWidth - 2 * margin - width);
      const y = margin + Math.random() * (this.canvasHeight - 2 * margin - height);

      // Check if too close to any corner (player spawn areas)
      const corners = [
        { x: 0, y: 0 },
        { x: this.canvasWidth, y: 0 },
        { x: 0, y: this.canvasHeight },
        { x: this.canvasWidth, y: this.canvasHeight },
      ];

      const centerX = x + width / 2;
      const centerY = y + height / 2;

      let tooCloseToCorner = false;
      for (const corner of corners) {
        const dist = Math.sqrt((centerX - corner.x) ** 2 + (centerY - corner.y) ** 2);
        if (dist < playerMargin) {
          tooCloseToCorner = true;
          break;
        }
      }

      if (tooCloseToCorner) {
        continue; // Skip this obstacle, don't block player spawns
      }

      this.obstacles.push(new Obstacle({
        type: 'rect',
        x,
        y,
        width,
        height
      }));
    }
  }

  update(dt: number): void {
    // Update players based on input (human) or AI controllers
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];

      if (this.aiControllers.has(i)) {
        // AI player - get action from controller
        const ai = this.aiControllers.get(i)!;
        const action = ai.getAction(this);

        // Move cursor towards target at same speed as human players
        const targetX = action.targetX * this.canvasWidth;
        const targetY = action.targetY * this.canvasHeight;
        player.moveCursorTowards(targetX, targetY, dt, this.canvasWidth, this.canvasHeight);
      } else {
        // Human player - use keyboard input
        const input = this.input.getPlayerInput(i);
        player.updateCursor(input, dt, this.canvasWidth, this.canvasHeight);
      }
    }

    // Build spatial hash for efficient collision detection
    this.spatialHash.clear();
    for (const particle of this.particles) {
      this.spatialHash.insert(particle);
    }

    // Clear conversion caches
    this.conversionProgressCache.clear();
    this.convertingPlayerColorCache.clear();

    // Update particles - each particle follows its owner's cursor
    for (const particle of this.particles) {
      const owner = this.players[particle.owner];
      if (!owner) continue;

      const cursorPos: Vec2 = { x: owner.cursorX, y: owner.cursorY };

      // Query nearby particles from spatial hash (much faster than checking all particles)
      const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);

      particle.update(dt, cursorPos, this.canvasWidth, this.canvasHeight, nearbyParticles, this.obstacles);

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

    // Check win condition
    if (this.winner === -1) {
      this.checkWinCondition();
    }
  }

  private checkWinCondition(): void {
    const totalParticles = this.particles.length;

    if (WIN_CONFIG.mode === 'elimination') {
      // Elimination mode: player loses when they have <= threshold particles
      for (const player of this.players) {
        if (player.particleCount <= WIN_CONFIG.eliminationThreshold) {
          // Find the winner (player with most particles remaining)
          let maxParticles = -1;
          for (const p of this.players) {
            if (p.particleCount > maxParticles) {
              maxParticles = p.particleCount;
              this.winner = p.id;
            }
          }
          console.log(`Player ${this.winner + 1} wins by elimination!`);
          break;
        }
      }
    } else if (WIN_CONFIG.mode === 'percentage') {
      // Percentage mode: player wins when they control X% of all particles
      for (const player of this.players) {
        const percentage = player.particleCount / totalParticles;
        if (percentage >= WIN_CONFIG.percentageThreshold) {
          this.winner = player.id;
          console.log(`Player ${this.winner + 1} wins with ${(percentage * 100).toFixed(1)}% of particles!`);
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

    if (!this.headless) {
      console.log(`AI controller set for player ${playerId + 1}: ${controller.getName()}`);
    }
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
}
