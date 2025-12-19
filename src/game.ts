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

  constructor(config: GameConfig, canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.input = new InputManager();
    this.spatialHash = new SpatialHash();
    this.conversionSystem = new ConversionSystem();

    // Create players
    this.initPlayers(config);

    // Create particles and assign to players
    this.initParticles(config);

    // Create obstacles
    this.initObstacles();

    console.log(`Game initialized with ${this.players.length} players`);
    console.log(`Total particles: ${this.particles.length}`);
    console.log(`Obstacles: ${this.obstacles.length}`);
  }

  private initPlayers(config: GameConfig): void {
    const { playerCount } = config;

    for (let i = 0; i < playerCount; i++) {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      // Start players at different positions
      const startX = (this.canvasWidth / (playerCount + 1)) * (i + 1);
      const startY = this.canvasHeight / 2;

      this.players.push(new Player(i, color, false, startX, startY));
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

    console.log(`Spawned ${this.particles.length} total particles (${particlesPerPlayer} per player)`);
  }

  private initObstacles(): void {
    // Create maze-like checker pattern of obstacles
    const { size, gridSpacing, margin } = OBSTACLE_CONFIG;

    // Calculate grid dimensions
    const cols = Math.floor((this.canvasWidth - 2 * margin) / gridSpacing);
    const rows = Math.floor((this.canvasHeight - 2 * margin) / gridSpacing);

    // Create checker pattern
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Only place obstacles in checker pattern (skip some cells)
        if ((row + col) % 2 === 0) {
          const x = margin + col * gridSpacing;
          const y = margin + row * gridSpacing;

          this.obstacles.push(new Obstacle({
            type: 'rect',
            x: x - size / 2,
            y: y - size / 2,
            width: size,
            height: size
          }));
        }
      }
    }

    console.log(`Created ${this.obstacles.length} maze obstacles`);
  }

  update(dt: number): void {
    // Update players based on input
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      const input = this.input.getPlayerInput(i);
      player.updateCursor(input, dt, this.canvasWidth, this.canvasHeight);
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
}
