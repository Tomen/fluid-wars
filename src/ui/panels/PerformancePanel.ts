// Performance panel with colored bars showing profiler stats
// Supports drill-down by clicking on categories

import { UIPanel, type PanelConfig } from '../UIPanel';
import type { UIData } from '../UIManager';
import type { HierarchicalStat } from '../../profiler';

// Color scheme for different profiler categories
const CATEGORY_COLORS: Record<string, string> = {
  update: '#ff8c00',     // Orange - game logic
  render: '#4488ff',     // Blue - rendering
  ai: '#44ff88',         // Green - AI
  physics: '#ff6b6b',    // Red - physics
  spatial: '#aa44ff',    // Purple - spatial hash
  convert: '#ffcc44',    // Yellow - conversion
  encode: '#66ddaa',     // Teal - encoding
  predict: '#88aaff',    // Light blue - prediction
};

const DEFAULT_COLOR = '#888888';

interface RowBounds {
  y: number;
  height: number;
  name: string;
  hasChildren: boolean;
}

interface WorkerStats {
  avgComputeTime: number;
  avgEncodeTime: number;
  avgPredictTime: number;
  lastComputeTime: number;
  workerCount: number;
  computeCount: number;
}

export class PerformancePanel extends UIPanel {
  private fps: number = 0;
  private stats: HierarchicalStat[] = [];
  private totalMs: number = 0;
  private maxBarMs: number = 16.67; // Target 60fps frame time

  // Expand/collapse state
  private expandedCategories: Set<string> = new Set();
  private rowBounds: RowBounds[] = [];

  // Worker stats (optional - only when using Web Worker)
  private workerStats: WorkerStats | null = null;

  constructor(x: number, y: number) {
    const config: PanelConfig = {
      x,
      y,
      width: 330,
      height: 210,
      title: 'Performance',
      framed: true,
    };
    super(config);
  }

  update(data: UIData): void {
    if (data.fps !== undefined) {
      this.fps = data.fps;
    }
    if (data.hierarchicalStats) {
      this.stats = data.hierarchicalStats;
    }
    if (data.totalFrameMs !== undefined) {
      this.totalMs = data.totalFrameMs;
      // Adjust max bar scale based on actual times
      this.maxBarMs = Math.max(16.67, this.totalMs * 1.2);
    }

    // Aggregate worker stats if available
    if (data.workerStats && data.workerStats.length > 0) {
      // Sum up times (parallel execution, but total work done)
      const totalAvgTime = data.workerStats.reduce((sum, s) => sum + s.avgComputeTime, 0);
      const totalEncodeTime = data.workerStats.reduce((sum, s) => sum + s.avgEncodeTime, 0);
      const totalPredictTime = data.workerStats.reduce((sum, s) => sum + s.avgPredictTime, 0);
      const maxLastTime = Math.max(...data.workerStats.map(s => s.lastComputeTime));
      const totalComputeCount = data.workerStats.reduce((sum, s) => sum + s.computeCount, 0);
      this.workerStats = {
        avgComputeTime: totalAvgTime,
        avgEncodeTime: totalEncodeTime,
        avgPredictTime: totalPredictTime,
        lastComputeTime: maxLastTime,
        workerCount: data.workerStats.length,
        computeCount: totalComputeCount,
      };
    } else {
      this.workerStats = null;
    }

    // Calculate height based on visible rows (recursive for multi-level)
    const countRows = (stat: HierarchicalStat): number => {
      let count = 1;
      if (this.expandedCategories.has(stat.fullName)) {
        for (const child of stat.children) {
          count += countRows(child);
        }
      }
      return count;
    };
    let rowCount = 0;
    for (const stat of this.stats) {
      rowCount += countRows(stat);
    }
    // Add rows for worker stats if present (1 for parent, +2 if expanded for encode/predict)
    let workerRows = 0;
    if (this.workerStats) {
      workerRows = 1;
      if (this.expandedCategories.has('worker')) {
        workerRows += 2; // encode + predict
      }
    }
    this.height = 85 + rowCount * 27 + workerRows * 27;
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    const lineHeight = 27;
    let y = this.contentY;

    // Clear row bounds for click detection
    this.rowBounds = [];

    // FPS
    ctx.fillStyle = this.fps >= 55 ? '#44ff88' : this.fps >= 30 ? '#ffcc44' : '#ff4444';
    ctx.font = 'bold 18px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`FPS: ${this.fps.toFixed(0)}`, this.contentX, y);
    y += lineHeight + 6;

    // Stats bars - recursive rendering for multi-level nesting
    const barHeight = 18;

    const drawStatRecursive = (stat: HierarchicalStat, depth: number) => {
      const hasChildren = stat.children.length > 0;
      const isExpanded = this.expandedCategories.has(stat.fullName);

      // Draw this row
      const currentBarHeight = Math.max(barHeight - depth * 3, 10);
      this.drawStatRow(ctx, stat, y, currentBarHeight, depth, hasChildren, isExpanded);

      // Store bounds for click detection
      this.rowBounds.push({
        y,
        height: lineHeight,
        name: stat.fullName,
        hasChildren,
      });

      y += lineHeight;

      // Recursively draw children if expanded
      if (isExpanded && hasChildren) {
        for (const child of stat.children) {
          drawStatRecursive(child, depth + 1);
        }
      }
    };

    for (const stat of this.stats) {
      drawStatRecursive(stat, 0);
    }

    // Total
    y += 6;
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Total: ${this.totalMs.toFixed(2)}ms`, this.contentX, y);

    // Worker stats (if using Web Worker) - rendered like hierarchical stats
    if (this.workerStats) {
      const barHeight = 18;
      const isExpanded = this.expandedCategories.has('worker');

      // Draw worker parent row
      y += 6;
      const workerLabel = this.workerStats.workerCount > 1
        ? `worker (${this.workerStats.workerCount}x)`
        : 'worker';

      // Arrow for expand/collapse
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '14px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(isExpanded ? '▼' : '▶', this.contentX, y + barHeight / 2);

      // Bar background
      const barX = this.contentX + 18;
      const barWidth = this.contentWidth - 105 - 18;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX, y, barWidth, barHeight);

      // Filled bar - teal color for worker
      const workerColor = '#66ddaa';
      const fillWidth = Math.min((this.workerStats.avgComputeTime / this.maxBarMs) * barWidth, barWidth);
      ctx.fillStyle = workerColor;
      ctx.fillRect(barX, y, fillWidth, barHeight);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(workerLabel, barX + barWidth + 6, y + barHeight / 2);

      // Time value
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.workerStats.avgComputeTime.toFixed(1)}`, this.x + this.width - 12, y + barHeight / 2);
      ctx.textAlign = 'left';

      // Store bounds for click detection
      this.rowBounds.push({
        y,
        height: lineHeight,
        name: 'worker',
        hasChildren: true,
      });

      y += lineHeight;

      // Draw children if expanded
      if (isExpanded) {
        const childBarHeight = 15;
        const indent = 20;
        const childColor = this.adjustColor(workerColor, 0.7);

        // Encode row
        const encodeBarX = this.contentX + indent;
        const encodeBarWidth = this.contentWidth - 105 - indent;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(encodeBarX, y, encodeBarWidth, childBarHeight);

        const encodeFillWidth = Math.min((this.workerStats.avgEncodeTime / this.maxBarMs) * encodeBarWidth, encodeBarWidth);
        ctx.fillStyle = childColor;
        ctx.fillRect(encodeBarX, y, encodeFillWidth, childBarHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText('encode', encodeBarX + encodeBarWidth + 6, y + childBarHeight / 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.workerStats.avgEncodeTime.toFixed(1)}`, this.x + this.width - 12, y + childBarHeight / 2);
        ctx.textAlign = 'left';

        y += lineHeight;

        // Predict row
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(encodeBarX, y, encodeBarWidth, childBarHeight);

        const predictFillWidth = Math.min((this.workerStats.avgPredictTime / this.maxBarMs) * encodeBarWidth, encodeBarWidth);
        ctx.fillStyle = childColor;
        ctx.fillRect(encodeBarX, y, predictFillWidth, childBarHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText('predict', encodeBarX + encodeBarWidth + 6, y + childBarHeight / 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.workerStats.avgPredictTime.toFixed(1)}`, this.x + this.width - 12, y + childBarHeight / 2);
        ctx.textAlign = 'left';
      }
    }
  }

  private drawStatRow(
    ctx: CanvasRenderingContext2D,
    stat: HierarchicalStat,
    y: number,
    barHeight: number,
    depth: number,
    hasChildren: boolean,
    isExpanded: boolean
  ): void {
    const indent = depth * 20;
    const arrowWidth = hasChildren ? 18 : 0;
    const barX = this.contentX + indent + arrowWidth;
    const barWidth = this.contentWidth - 105 - indent - arrowWidth;

    // Draw expand/collapse arrow
    if (hasChildren) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '14px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(isExpanded ? '▼' : '▶', this.contentX + indent, y + barHeight / 2);
    }

    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, y, barWidth, barHeight);

    // Filled bar - get color from parent category
    const parentName = stat.fullName.split('.')[0];
    const color = CATEGORY_COLORS[parentName] || DEFAULT_COLOR;
    const fillWidth = Math.min((stat.avgMs / this.maxBarMs) * barWidth, barWidth);
    ctx.fillStyle = depth === 0 ? color : this.adjustColor(color, 0.7);
    ctx.fillRect(barX, y, fillWidth, barHeight);

    // Max indicator (thin line)
    const maxX = barX + Math.min((stat.maxMs / this.maxBarMs) * barWidth, barWidth);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(maxX, y);
    ctx.lineTo(maxX, y + barHeight);
    ctx.stroke();

    // Label
    ctx.fillStyle = depth === 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
    ctx.font = depth === 0 ? '14px monospace' : '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(stat.name, barX + barWidth + 6, y + barHeight / 2);

    // Time value
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`${stat.avgMs.toFixed(1)}`, this.x + this.width - 12, y + barHeight / 2);
    ctx.textAlign = 'left';
  }

  private adjustColor(hex: string, factor: number): string {
    // Darken/lighten a hex color
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  }

  override handleClick(x: number, y: number): boolean {
    if (!this.containsPoint(x, y)) {
      return false;
    }

    // Check which row was clicked
    for (const row of this.rowBounds) {
      if (y >= row.y && y < row.y + row.height && row.hasChildren) {
        // Toggle expand/collapse
        if (this.expandedCategories.has(row.name)) {
          this.expandedCategories.delete(row.name);
        } else {
          this.expandedCategories.add(row.name);
        }
        return true;
      }
    }

    return false;
  }
}
