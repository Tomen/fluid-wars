// Renderer class for canvas drawing

import type { Particle } from './particle';
import type { Obstacle } from './obstacle';
import type { Player } from './player';

const BACKGROUND_COLOR = '#0a0a0f';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.width = canvas.width;
    this.height = canvas.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
  }

  clear(): void {
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.width, this.height);
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
    for (const particle of particles) {
      const progress = conversionProgressMap?.get(particle);
      const convertingColor = convertingColorMap?.get(particle);
      particle.draw(this.ctx, progress, convertingColor);
    }
  }

  drawPlayers(players: Player[]): void {
    for (const player of players) {
      player.draw(this.ctx);
    }
  }

  drawDebugText(text: string, x: number = 10, y: number = 20): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(text, x, y);
  }

  drawFPS(fps: number): void {
    this.drawDebugText(`FPS: ${fps.toFixed(1)}`, 10, 20);
  }
}
