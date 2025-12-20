// Victory overlay panel

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

interface WinnerData {
  id: number;
  color: string;
  particleCount: number;
  isAI: boolean;
  colorName: string;
}

export class VictoryPanel extends UIPanel {
  private winner: WinnerData | null = null;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    const config: PanelConfig = {
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      framed: false,
    };
    super(config);
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.visible = false; // Hidden by default
  }

  update(data: UIData): void {
    if (data.winner !== undefined) {
      this.winner = data.winner;
      this.visible = this.winner !== null;
    }
    if (data.canvasWidth !== undefined) {
      this.canvasWidth = data.canvasWidth;
      this.width = data.canvasWidth;
    }
    if (data.canvasHeight !== undefined) {
      this.canvasHeight = data.canvasHeight;
      this.height = data.canvasHeight;
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (!this.winner) return;

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw victory message
    ctx.fillStyle = this.winner.color;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VICTORY!', centerX, centerY - 80);

    // Draw player info
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px sans-serif';
    const playerType = this.winner.isAI ? 'AI' : (this.winner.id === 0 ? 'WASD' : 'Arrows');
    ctx.fillText(`${this.winner.colorName} (${playerType}) Wins!`, centerX, centerY);

    // Draw particle count
    ctx.font = '24px sans-serif';
    ctx.fillText(`${this.winner.particleCount} particles remaining`, centerX, centerY + 50);

    // Draw restart instruction
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Press R to restart', centerX, centerY + 120);

    // Reset text align
    ctx.textAlign = 'left';
  }
}
