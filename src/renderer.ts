// Renderer class for canvas drawing

import type { Particle } from './particle';
import type { Obstacle } from './obstacle';
import type { Player } from './player';
import { RENDER_CONFIG } from './config';

// Height of the power distribution bar at the top
export const POWER_BAR_HEIGHT = 40;

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** The playable game area height (excludes power bar) */
  readonly gameHeight: number;

  constructor(canvas: HTMLCanvasElement) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.gameHeight = canvas.height - POWER_BAR_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
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
    for (const particle of particles) {
      const progress = conversionProgressMap?.get(particle);
      const convertingColor = convertingColorMap?.get(particle);
      particle.draw(this.ctx, progress, convertingColor);
    }
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

  drawDebugText(text: string, x: number = 10, y: number = 20): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(text, x, y);
  }

  drawFPS(fps: number): void {
    this.drawDebugText(`FPS: ${fps.toFixed(1)}`, 10, 20);
  }

  /**
   * Draw a power distribution bar at the top of the screen
   * Each player's segment is proportional to their particle count
   */
  drawPowerBar(players: Player[], totalParticles: number): void {
    if (totalParticles === 0) return;

    const barHeight = 40;
    const barY = 0;
    const barWidth = this.width;

    let xOffset = 0;

    for (const player of players) {
      const ratio = player.particleCount / totalParticles;
      const segmentWidth = ratio * barWidth;

      if (segmentWidth > 0) {
        this.ctx.fillStyle = player.color;
        this.ctx.fillRect(xOffset, barY, segmentWidth, barHeight);
        xOffset += segmentWidth;
      }
    }

    // Draw subtle border at bottom of bar
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, barHeight);
    this.ctx.lineTo(barWidth, barHeight);
    this.ctx.stroke();
  }

  /**
   * Draw the AI observation grid overlay
   * Green = friendly particles, Red = enemy particles, Blue = obstacles
   */
  drawObservationGrid(
    observation: number[][][],
    x: number,
    y: number,
    cellSize: number = 10,
    playerColor?: string
  ): void {
    const rows = observation.length;
    const cols = observation[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const friendly = observation[r][c][0];
        const enemy = observation[r][c][1];
        const obstacle = observation[r][c][2];

        const red = Math.floor(enemy * 255);
        const green = Math.floor(friendly * 255);
        const blue = Math.floor(obstacle * 255);

        this.ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        this.ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
      }
    }

    // Border with player color
    this.ctx.strokeStyle = playerColor || '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, cols * cellSize, rows * cellSize);

    // Label with player color
    this.ctx.fillStyle = playerColor || '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText('AI View', x, y - 5);
  }
}
