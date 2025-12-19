// Renderer class for canvas drawing

import type { Particle } from './particle';
import type { Obstacle } from './obstacle';

const BACKGROUND_COLOR = '#0a0a0f';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
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

  drawParticles(particles: Particle[]): void {
    for (const particle of particles) {
      particle.draw(this.ctx);
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
