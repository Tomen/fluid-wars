// Game info panel showing particle count, obstacles, grid cells

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

export class GameInfoPanel extends UIPanel {
  private particleCount: number = 0;
  private obstacleCount: number = 0;
  private gridCells: number = 0;

  constructor(x: number, y: number) {
    const config: PanelConfig = {
      x,
      y,
      width: 270,
      height: 120,
      title: 'Game Info',
      framed: true,
    };
    super(config);
  }

  update(data: UIData): void {
    if (data.particleCount !== undefined) {
      this.particleCount = data.particleCount;
    }
    if (data.obstacleCount !== undefined) {
      this.obstacleCount = data.obstacleCount;
    }
    if (data.gridCells !== undefined) {
      this.gridCells = data.gridCells;
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    const lineHeight = 24;
    let y = this.contentY;

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';

    ctx.fillText(`Particles: ${this.particleCount}`, this.contentX, y);
    y += lineHeight;

    ctx.fillText(`Obstacles: ${this.obstacleCount}`, this.contentX, y);
    y += lineHeight;

    ctx.fillText(`Grid Cells: ${this.gridCells}`, this.contentX, y);
  }
}
