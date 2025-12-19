// Game class to coordinate all game systems

import type { GameConfig, Vec2 } from './types';
import { Particle } from './particle';
import { Obstacle } from './obstacle';
import { Player } from './player';
import { InputManager } from './input';
import { SpatialHash } from './collision';
import { ConversionSystem } from './conversion';
import { PLAYER_COLORS } from './types';

export class Game {
  private players: Player[] = [];
  private particles: Particle[] = [];
  private obstacles: Obstacle[] = [];
  private input: InputManager;
  private spatialHash: SpatialHash;
  private conversionSystem: ConversionSystem;
  private canvasWidth: number;
  private canvasHeight: number;

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
      const spawnRadius = 150; // Radius around cursor to spawn particles

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
    const obstacleSize = 40; // Size of each obstacle square
    const gridSpacing = 100; // Distance between obstacle centers
    const margin = 100; // Margin from edges

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
            x: x - obstacleSize / 2,
            y: y - obstacleSize / 2,
            width: obstacleSize,
            height: obstacleSize
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

          console.log(`Particle converted to Player ${newOwner + 1}!`);
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
    const progressMap = new Map<Particle, number>();

    for (const particle of this.particles) {
      const progress = this.conversionSystem.getProgress(particle);
      if (progress > 0) {
        progressMap.set(particle, progress);
      }
    }

    return progressMap;
  }

  getConvertingPlayerColorMap(): Map<Particle, string> {
    const colorMap = new Map<Particle, string>();

    for (const particle of this.particles) {
      const progress = this.conversionSystem.getProgress(particle);
      if (progress > 0) {
        // Query nearby particles to find dominant enemy
        const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);
        const dominantPlayer = this.conversionSystem.getDominantEnemyPlayer(particle, nearbyParticles);

        if (dominantPlayer !== -1) {
          colorMap.set(particle, this.players[dominantPlayer].color);
        }
      }
    }

    return colorMap;
  }

  destroy(): void {
    this.input.destroy();
  }
}
