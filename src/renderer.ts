// Renderer class for canvas drawing

import type { Particle } from './particle';
import type { Obstacle } from './obstacle';
import type { Player } from './player';
import { RENDER_CONFIG } from './config';
import { ParticleRenderer } from './rendering/ParticleRenderer';

// Height of the power distribution bar at the top
export const POWER_BAR_HEIGHT = 40;

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** The playable game area height (excludes power bar) */
  readonly gameHeight: number;

  private particleRenderer: ParticleRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.gameHeight = canvas.height - POWER_BAR_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;

    // Initialize particle renderer with pre-rendered sprites
    this.particleRenderer = new ParticleRenderer();
  }

  clear(): void {
    this.ctx.fillStyle = RENDER_CONFIG.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawBackground(): void {
    this.clear();
  }

  drawObstacles(obstacles: Obstacle[]): void {
    this.ctx.save();
    this.ctx.translate(0, POWER_BAR_HEIGHT);
    for (const obstacle of obstacles) {
      obstacle.draw(this.ctx);
    }
    this.ctx.restore();
  }

  drawParticles(particles: Particle[], conversionProgressMap?: Map<Particle, number>, convertingColorMap?: Map<Particle, string>): void {
    this.ctx.save();
    this.ctx.translate(0, POWER_BAR_HEIGHT);
    this.particleRenderer.draw(this.ctx, particles, conversionProgressMap, convertingColorMap);
    this.ctx.restore();
  }

  drawPlayers(players: Player[]): void {
    this.ctx.save();
    this.ctx.translate(0, POWER_BAR_HEIGHT);
    for (const player of players) {
      player.draw(this.ctx);
    }
    this.ctx.restore();
  }

}
