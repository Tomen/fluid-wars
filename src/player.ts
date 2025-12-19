// Player class with cursor management

import type { Vec2 } from './types';
import { clamp } from './utils';

const CURSOR_SPEED = 300; // units/sec
const CURSOR_RADIUS = 8;

export class Player {
  readonly id: number;
  readonly color: string;
  cursorX: number;
  cursorY: number;
  readonly isAI: boolean;
  particleCount: number = 0;

  constructor(id: number, color: string, isAI: boolean, startX: number, startY: number) {
    this.id = id;
    this.color = color;
    this.isAI = isAI;
    this.cursorX = startX;
    this.cursorY = startY;
  }

  updateCursor(input: Vec2, dt: number, canvasWidth: number, canvasHeight: number): void {
    // Move cursor based on input direction (normalized vector expected)
    this.cursorX += input.x * CURSOR_SPEED * dt;
    this.cursorY += input.y * CURSOR_SPEED * dt;

    // Keep cursor within bounds
    this.cursorX = clamp(this.cursorX, CURSOR_RADIUS, canvasWidth - CURSOR_RADIUS);
    this.cursorY = clamp(this.cursorY, CURSOR_RADIUS, canvasHeight - CURSOR_RADIUS);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Draw cursor as a circle with color
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(this.cursorX, this.cursorY, CURSOR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cursorX - CURSOR_RADIUS - 4, this.cursorY);
    ctx.lineTo(this.cursorX + CURSOR_RADIUS + 4, this.cursorY);
    ctx.moveTo(this.cursorX, this.cursorY - CURSOR_RADIUS - 4);
    ctx.lineTo(this.cursorX, this.cursorY + CURSOR_RADIUS + 4);
    ctx.stroke();
  }
}
