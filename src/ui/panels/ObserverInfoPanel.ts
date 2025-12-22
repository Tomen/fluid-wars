// Observer mode info panel - shows scenario info, progress, and player stats

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';

export interface ObserverData {
  scenarioName: string;
  scenarioDescription?: string;
  currentStep: number;
  maxSteps: number;
  gameOver: boolean;
  winner: number; // -1 if no winner
  players: Array<{
    id: number;
    color: string;
    particleCount: number;
  }>;
  totalParticles: number;
  // Queue info
  scenarioIndex?: number;
  totalScenarios?: number;
  completedResults?: Array<{
    scenarioName: string;
    winner: number;
    steps: number;
  }>;
  queueComplete?: boolean;
}

export class ObserverInfoPanel extends UIPanel {
  private data: ObserverData | null = null;

  constructor(x: number, y: number) {
    const config: PanelConfig = {
      x,
      y,
      width: 280,
      height: 200,
      title: 'Observer Mode',
      framed: true,
    };
    super(config);
  }

  update(uiData: UIData): void {
    if (uiData.observerData !== undefined) {
      this.data = uiData.observerData;
      // Adjust height based on player count and completed results
      const playerCount = this.data?.players.length ?? 0;
      const completedCount = this.data?.completedResults?.length ?? 0;
      const hasQueue = (this.data?.totalScenarios ?? 0) > 1;
      this.height = 160 + playerCount * 24 + (hasQueue ? 30 + completedCount * 20 : 0);
    }
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (!this.data) {
      ctx.fillStyle = '#888888';
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText('Waiting for data...', this.contentX, this.contentY);
      return;
    }

    const lineHeight = 20;
    let y = this.contentY;

    // Queue progress (if applicable)
    const hasQueue = (this.data.totalScenarios ?? 0) > 1;
    if (hasQueue) {
      ctx.fillStyle = '#88aaff';
      ctx.font = '12px monospace';
      ctx.textBaseline = 'top';
      const queueText = `Test ${(this.data.scenarioIndex ?? 0) + 1} of ${this.data.totalScenarios}`;
      ctx.fillText(queueText, this.contentX, y);
      y += lineHeight - 4;
    }

    // Scenario name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(this.data.scenarioName, this.contentX, y);
    y += lineHeight;

    // Description (if available)
    if (this.data.scenarioDescription) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '12px monospace';
      // Wrap long descriptions
      const maxWidth = this.contentWidth;
      const words = this.data.scenarioDescription.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        if (ctx.measureText(testLine).width > maxWidth) {
          ctx.fillText(line, this.contentX, y);
          y += lineHeight - 4;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, this.contentX, y);
        y += lineHeight;
      }
    }

    y += 4; // Small gap

    // Progress bar
    const progress = this.data.maxSteps > 0
      ? this.data.currentStep / this.data.maxSteps
      : 0;
    const barWidth = this.contentWidth;
    const barHeight = 16;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(this.contentX, y, barWidth, barHeight);

    // Progress fill
    ctx.fillStyle = this.data.gameOver ? '#44aa44' : '#4488ff';
    ctx.fillRect(this.contentX, y, barWidth * progress, barHeight);

    // Border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.contentX, y, barWidth, barHeight);

    // Progress text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const progressText = `${this.data.currentStep} / ${this.data.maxSteps}`;
    ctx.fillText(progressText, this.contentX + barWidth / 2, y + barHeight / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    y += barHeight + 8;

    // Status
    if (this.data.gameOver) {
      const winnerText = this.data.winner >= 0
        ? `Player ${this.data.winner + 1} wins!`
        : 'Game Over (timeout)';
      ctx.fillStyle = '#44ff44';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(winnerText, this.contentX, y);
      y += lineHeight;
    }

    y += 4;

    // Player stats
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.fillText('Players:', this.contentX, y);
    y += lineHeight;

    for (const player of this.data.players) {
      const percentage = this.data.totalParticles > 0
        ? (player.particleCount / this.data.totalParticles * 100).toFixed(1)
        : '0.0';

      // Color indicator
      ctx.fillStyle = player.color;
      ctx.fillRect(this.contentX, y + 2, 12, 12);

      // Player text
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px monospace';
      ctx.fillText(
        `P${player.id + 1}: ${player.particleCount} (${percentage}%)`,
        this.contentX + 18,
        y
      );
      y += lineHeight;
    }

    // Completed results (if in queue mode)
    if (hasQueue && this.data.completedResults && this.data.completedResults.length > 0) {
      y += 8;
      ctx.fillStyle = '#888888';
      ctx.font = '11px monospace';
      ctx.fillText('Completed:', this.contentX, y);
      y += 16;

      for (const result of this.data.completedResults) {
        const winnerText = result.winner >= 0 ? `P${result.winner + 1}` : 'T/O';
        const resultText = `${result.scenarioName}: ${winnerText} (${result.steps} steps)`;
        ctx.fillStyle = result.winner === 0 ? '#ff8888' : result.winner === 1 ? '#88ff88' : '#888888';
        ctx.font = '11px monospace';
        ctx.fillText(resultText, this.contentX, y);
        y += 16;
      }
    }

    // Queue complete message
    if (this.data.queueComplete) {
      y += 8;
      ctx.fillStyle = '#ffff44';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('All tests complete!', this.contentX, y);
      y += lineHeight;
    }

    // Controls hint at bottom
    y += 8;
    ctx.fillStyle = '#666666';
    ctx.font = '11px monospace';
    ctx.fillText('R: Restart | Esc: Exit', this.contentX, y);
  }
}
