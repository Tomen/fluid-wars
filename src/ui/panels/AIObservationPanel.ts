// AI observation grid overlay panel

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

interface ObservationData {
  playerId: number;
  playerColor: string;
  observation: number[][][];
}

export class AIObservationPanel extends UIPanel {
  private observations: ObservationData[] = [];
  private cellSize: number = 15;

  constructor(x: number, y: number) {
    const config: PanelConfig = {
      x,
      y,
      width: 330,
      height: 150, // Will be updated based on observations
      title: 'AI View',
      framed: true,
    };
    super(config);
  }

  update(data: UIData): void {
    if (data.aiObservations) {
      this.observations = data.aiObservations;
      // Update height based on number of observations
      if (this.observations.length > 0) {
        const gridHeight = this.observations[0].observation.length * this.cellSize;
        this.height = 26 + this.observations.length * (gridHeight + 30);
      }
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (this.observations.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '16px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText('Press V to toggle', this.contentX, this.contentY);
      return;
    }

    let y = this.contentY;

    for (const obs of this.observations) {
      const rows = obs.observation.length;
      const cols = obs.observation[0].length;
      const gridWidth = cols * this.cellSize;
      const gridHeight = rows * this.cellSize;

      // Label with player color
      ctx.fillStyle = obs.playerColor;
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`Player ${obs.playerId + 1}`, this.contentX, y);
      y += 20;

      // Draw grid
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const friendly = obs.observation[r][c][0];
          const enemy = obs.observation[r][c][1];
          const obstacle = obs.observation[r][c][2];

          const red = Math.floor(enemy * 255);
          const green = Math.floor(friendly * 255);
          const blue = Math.floor(obstacle * 255);

          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          ctx.fillRect(this.contentX + c * this.cellSize, y + r * this.cellSize, this.cellSize, this.cellSize);
        }
      }

      // Border with player color
      ctx.strokeStyle = obs.playerColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.contentX, y, gridWidth, gridHeight);

      y += gridHeight + 10;
    }
  }
}
