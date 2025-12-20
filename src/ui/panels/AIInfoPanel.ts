// AI model info panel

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

interface WorkerStatsData {
  computeCount: number;
  avgComputeTime: number;
  lastComputeTime: number;
}

export class AIInfoPanel extends UIPanel {
  private generation: number | null = null;
  private bestFitness: number | null = null;
  private averageFitness: number | null = null;
  private hasData: boolean = false;

  // Worker stats (aggregated across all AI players)
  private workerStats: WorkerStatsData | null = null;

  constructor(x: number, y: number) {
    const config: PanelConfig = {
      x,
      y,
      width: 270,
      height: 120,
      title: 'AI Model',
      framed: true,
    };
    super(config);
  }

  update(data: UIData): void {
    if (data.aiModelInfo) {
      this.generation = data.aiModelInfo.generation;
      this.bestFitness = data.aiModelInfo.bestFitness;
      this.averageFitness = data.aiModelInfo.averageFitness;
      this.hasData = true;
    }

    // Aggregate worker stats from all AI players
    if (data.workerStats && data.workerStats.length > 0) {
      const totalCompute = data.workerStats.reduce((sum, s) => sum + s.computeCount, 0);
      const avgTime = data.workerStats.reduce((sum, s) => sum + s.avgComputeTime, 0) / data.workerStats.length;
      const lastTime = Math.max(...data.workerStats.map(s => s.lastComputeTime));

      this.workerStats = {
        computeCount: totalCompute,
        avgComputeTime: avgTime,
        lastComputeTime: lastTime,
      };

      // Increase panel height when showing worker stats
      this.height = 170;
    } else {
      this.workerStats = null;
      this.height = 120;
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (!this.hasData) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '16px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText('No AI model loaded', this.contentX, this.contentY);
      return;
    }

    const lineHeight = 24;
    let y = this.contentY;

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';

    const gen = this.generation !== null ? this.generation : '?';
    ctx.fillText(`Generation: ${gen}`, this.contentX, y);
    y += lineHeight;

    const best = this.bestFitness !== null ? this.bestFitness.toFixed(1) : '?';
    ctx.fillText(`Best Fitness: ${best}`, this.contentX, y);
    y += lineHeight;

    const avg = this.averageFitness !== null ? this.averageFitness.toFixed(1) : '?';
    ctx.fillText(`Avg Fitness: ${avg}`, this.contentX, y);
    y += lineHeight;

    // Worker stats (if using web worker)
    if (this.workerStats) {
      y += 8; // Extra spacing

      ctx.fillStyle = '#66ddaa';
      ctx.fillText('Worker Thread:', this.contentX, y);
      y += lineHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Avg Time: ${this.workerStats.avgComputeTime.toFixed(1)}ms`, this.contentX, y);
    }
  }
}
