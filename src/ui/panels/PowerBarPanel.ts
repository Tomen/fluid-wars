// Power distribution bar at the top of the screen

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

interface PlayerData {
  id: number;
  color: string;
  particleCount: number;
}

export class PowerBarPanel extends UIPanel {
  private players: PlayerData[] = [];
  private totalParticles: number = 0;

  constructor(canvasWidth: number) {
    const config: PanelConfig = {
      x: 0,
      y: 0,
      width: canvasWidth,
      height: 40,
      framed: false,
    };
    super(config);
  }

  update(data: UIData): void {
    if (data.players) {
      this.players = data.players;
    }
    if (data.totalParticles !== undefined) {
      this.totalParticles = data.totalParticles;
    }
    if (data.canvasWidth !== undefined) {
      this.width = data.canvasWidth;
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (this.totalParticles === 0) return;

    let xOffset = 0;

    for (const player of this.players) {
      const ratio = player.particleCount / this.totalParticles;
      const segmentWidth = ratio * this.width;

      if (segmentWidth > 0) {
        ctx.fillStyle = player.color;
        ctx.fillRect(xOffset, 0, segmentWidth, this.height);
        xOffset += segmentWidth;
      }
    }

    // Draw subtle border at bottom of bar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(this.width, this.height);
    ctx.stroke();
  }
}
