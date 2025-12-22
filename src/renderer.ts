// Renderer class for canvas drawing
// The canvas now represents only the game area (no power bar)

import type { Particle } from './particle';
import type { Obstacle } from './obstacle';
import type { Player } from './player';
import { RENDER_CONFIG } from './config';
import { ParticleRenderer } from './rendering/ParticleRenderer';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particleRenderer: ParticleRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;

    // Initialize particle renderer with pre-rendered sprites
    this.particleRenderer = new ParticleRenderer();
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  clear(): void {
    this.ctx.fillStyle = RENDER_CONFIG.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground(): void {
    this.clear();
  }

  drawObstacles(obstacles: Obstacle[]): void {
    for (const obstacle of obstacles) {
      obstacle.draw(this.ctx);
    }
  }

  drawParticles(particles: Particle[], conversionProgressMap?: Map<Particle, number>, convertingColorMap?: Map<Particle, string>): void {
    this.particleRenderer.draw(this.ctx, particles, conversionProgressMap, convertingColorMap);
  }

  drawPlayers(players: Player[]): void {
    for (const player of players) {
      player.draw(this.ctx);
    }
  }
}
