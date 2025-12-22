// Player class with cursor management

import type { Vec2 } from './types';
import { clamp } from './utils';
import { PLAYER_CONFIG } from './config';

export class Player {
  readonly id: number;
  readonly color: string;
  cursorX: number;
  cursorY: number;
  isAI: boolean;
  particleCount: number = 0;

  constructor(id: number, color: string, isAI: boolean, startX: number, startY: number) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    this.cursorX = startX;
    this.cursorY = startY;
  }

  /**
   * Set cursor to an absolute position (used by AI and mouse input)
   */
  setCursor(x: number, y: number, canvasWidth: number, canvasHeight: number): void {
    this.cursorX = clamp(x, PLAYER_CONFIG.cursorRadius, canvasWidth - PLAYER_CONFIG.cursorRadius);
    this.cursorY = clamp(y, PLAYER_CONFIG.cursorRadius, canvasHeight - PLAYER_CONFIG.cursorRadius);
  }

  /**
   * Move cursor by a delta (used by keyboard input)
   */
  moveCursor(input: Vec2, dt: number, canvasWidth: number, canvasHeight: number): void {
    this.cursorX += input.x * PLAYER_CONFIG.cursorSpeed * dt;
    this.cursorY += input.y * PLAYER_CONFIG.cursorSpeed * dt;

    // Keep cursor within bounds
    this.cursorX = clamp(this.cursorX, PLAYER_CONFIG.cursorRadius, canvasWidth - PLAYER_CONFIG.cursorRadius);
    this.cursorY = clamp(this.cursorY, PLAYER_CONFIG.cursorRadius, canvasHeight - PLAYER_CONFIG.cursorRadius);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Don't draw cursor for eliminated players
    if (this.particleCount <= 0) {
      return;
    }

    const r = PLAYER_CONFIG.cursorRadius;

    // Draw cursor as a circle with color
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(this.cursorX, this.cursorY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cursorX - r - 4, this.cursorY);
    ctx.lineTo(this.cursorX + r + 4, this.cursorY);
    ctx.moveTo(this.cursorX, this.cursorY - r - 4);
    ctx.lineTo(this.cursorX, this.cursorY + r + 4);
    ctx.stroke();
  }
}
