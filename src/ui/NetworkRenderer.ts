// NetworkRenderer - Renders game state from binary frame data
// Used for observer mode when game runs in a worker

import type { FrameData } from '../network/protocol';
import type { ObstacleData, RectObstacle, CircleObstacle } from '../types';
import { PLAYER_COLORS } from '../types';
import { PARTICLE_CONFIG, PLAYER_CONFIG, RENDER_CONFIG } from '../config';

// Height of the power bar at the top
export const POWER_BAR_HEIGHT = 40;

export class NetworkRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private obstacles: ObstacleData[] = [];
  private playerColors: string[] = [];

  // Sprite cache for gradient particles
  private spriteCache: Map<string, OffscreenCanvas> = new Map();
  private spriteSize: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.spriteSize = Math.ceil(PARTICLE_CONFIG.radius * RENDER_CONFIG.shadowBlur * 2);
  }

  /**
   * Set the obstacles to render (received once at game start)
   */
  setObstacles(obstacles: ObstacleData[]): void {
    this.obstacles = obstacles;
  }

  /**
   * Set player colors (received at game start)
   */
  setPlayerColors(colors: string[]): void {
    this.playerColors = colors;
  }

  /**
   * Resize canvas to match game dimensions
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height + POWER_BAR_HEIGHT;
  }

  /**
   * Render a frame from binary data
   */
  renderFrame(frame: FrameData): void {
    // Clear canvas
    this.ctx.fillStyle = RENDER_CONFIG.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw power bar
    this.drawPowerBar(frame);

    // Translate for game area
    this.ctx.save();
    this.ctx.translate(0, POWER_BAR_HEIGHT);

    // Draw obstacles
    this.drawObstacles();

    // Draw particles
    this.drawParticles(frame);

    // Draw player cursors
    this.drawPlayers(frame);

    this.ctx.restore();
  }

  /**
   * Draw the power distribution bar at the top
   */
  private drawPowerBar(frame: FrameData): void {
    const totalParticles = frame.particles.length;
    if (totalParticles === 0) return;

    const barHeight = POWER_BAR_HEIGHT - 4;
    const barY = 2;

    // Calculate cumulative widths
    let x = 0;
    for (const player of frame.players) {
      const ratio = player.particleCount / totalParticles;
      const width = ratio * this.canvas.width;

      const color = this.getPlayerColor(player.colorIndex);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, barY, width, barHeight);

      x += width;
    }

    // Draw separator lines
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    x = 0;
    for (let i = 0; i < frame.players.length - 1; i++) {
      const ratio = frame.players[i].particleCount / totalParticles;
      x += ratio * this.canvas.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, barY);
      this.ctx.lineTo(x, barY + barHeight);
      this.ctx.stroke();
    }
  }

  /**
   * Draw all obstacles
   */
  private drawObstacles(): void {
    this.ctx.fillStyle = '#222244';
    this.ctx.strokeStyle = '#444466';
    this.ctx.lineWidth = 2;

    for (const obstacle of this.obstacles) {
      if (obstacle.type === 'rect') {
        const rect = obstacle as RectObstacle;
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      } else {
        const circle = obstacle as CircleObstacle;
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
    }
  }

  /**
   * Draw all particles
   */
  private drawParticles(frame: FrameData): void {
    const style = RENDER_CONFIG.particleStyle;

    if (style === 'solid') {
      // Simple solid circles
      for (const particle of frame.particles) {
        const color = this.getPlayerColor(particle.owner);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, PARTICLE_CONFIG.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else {
      // Gradient sprites (soft or glow)
      const halfSize = this.spriteSize / 2;

      if (style === 'glow') {
        this.ctx.globalCompositeOperation = 'lighter';
      }

      for (const particle of frame.particles) {
        const color = this.getPlayerColor(particle.owner);
        const sprite = this.getSprite(color);
        this.ctx.drawImage(sprite, particle.x - halfSize, particle.y - halfSize);
      }

      if (style === 'glow') {
        this.ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /**
   * Draw player cursors
   */
  private drawPlayers(frame: FrameData): void {
    const r = PLAYER_CONFIG.cursorRadius;

    for (const player of frame.players) {
      // Skip eliminated players
      if (player.particleCount <= 0) continue;

      const color = this.getPlayerColor(player.colorIndex);

      // Draw cursor circle
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;

      this.ctx.beginPath();
      this.ctx.arc(player.cursorX, player.cursorY, r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw crosshair
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(player.cursorX - r - 4, player.cursorY);
      this.ctx.lineTo(player.cursorX + r + 4, player.cursorY);
      this.ctx.moveTo(player.cursorX, player.cursorY - r - 4);
      this.ctx.lineTo(player.cursorX, player.cursorY + r + 4);
      this.ctx.stroke();
    }
  }

  /**
   * Get player color by index
   */
  private getPlayerColor(index: number): string {
    if (index < this.playerColors.length) {
      return this.playerColors[index];
    }
    return PLAYER_COLORS[index % PLAYER_COLORS.length];
  }

  /**
   * Get or create a gradient sprite for a color
   */
  private getSprite(color: string): OffscreenCanvas {
    let sprite = this.spriteCache.get(color);
    if (!sprite) {
      sprite = this.createGradientSprite(color);
      this.spriteCache.set(color, sprite);
    }
    return sprite;
  }

  /**
   * Create a gradient sprite for particle rendering
   */
  private createGradientSprite(color: string): OffscreenCanvas {
    const size = this.spriteSize;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Radial gradient
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return canvas;
  }

  /**
   * Draw game over overlay
   */
  drawGameOver(winner: number, stats: { steps: number; duration: number; finalCounts: number[] }): void {
    const winnerColor = this.getPlayerColor(winner);

    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Winner text
    this.ctx.fillStyle = winnerColor;
    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.fillText(`Player ${winner + 1} Wins!`, centerX, centerY - 40);

    // Stats
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px sans-serif';
    this.ctx.fillText(`Steps: ${stats.steps} | Duration: ${stats.duration.toFixed(1)}s`, centerX, centerY + 20);

    const countsText = stats.finalCounts.map((c, i) => `P${i + 1}: ${c}`).join(' | ');
    this.ctx.fillText(countsText, centerX, centerY + 60);
  }
}
