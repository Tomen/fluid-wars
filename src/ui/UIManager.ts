// Central UI manager that coordinates all UI panels

import type { UIPanel } from './UIPanel';

import type { HierarchicalStat } from '../profiler';

export interface UIData {
  fps?: number;
  particleCount?: number;
  obstacleCount?: number;
  gridCells?: number;
  profilerStats?: Array<{ name: string; avgMs: number; maxMs: number }>;
  hierarchicalStats?: HierarchicalStat[];
  totalFrameMs?: number;
  aiModelInfo?: {
    generation: number | null;
    bestFitness: number | null;
    averageFitness: number | null;
  };
  workerStats?: Array<{
    playerId: number;
    computeCount: number;
    avgComputeTime: number;
    avgEncodeTime: number;
    avgPredictTime: number;
    lastComputeTime: number;
  }>;
  players?: Array<{ id: number; color: string; particleCount: number; isAI: boolean }>;
  totalParticles?: number;
  winner?: {
    id: number;
    color: string;
    particleCount: number;
    isAI: boolean;
    colorName: string;
  } | null;
  aiObservations?: Array<{
    playerId: number;
    playerColor: string;
    observation: number[][][];
  }>;
  canvasWidth?: number;
  canvasHeight?: number;
  // Observer mode data
  observerData?: {
    scenarioName: string;
    scenarioDescription?: string;
    currentStep: number;
    maxSteps: number;
    gameOver: boolean;
    winner: number;
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
  };
}

export class UIManager {
  private panels: Map<string, UIPanel> = new Map();
  private renderOrder: string[] = [];
  private leftColumn: string[] = [];  // Panel IDs stacked in left column
  private rightColumn: string[] = []; // Panel IDs stacked in right column
  private columnStartY: number = 0;   // Y offset for columns
  private columnGap: number = 10;     // Gap between panels

  /**
   * Add a panel with a unique ID
   */
  addPanel(id: string, panel: UIPanel): void {
    this.panels.set(id, panel);
    if (!this.renderOrder.includes(id)) {
      this.renderOrder.push(id);
    }
  }

  /**
   * Remove a panel by ID
   */
  removePanel(id: string): void {
    this.panels.delete(id);
    this.renderOrder = this.renderOrder.filter(i => i !== id);
  }

  /**
   * Get a panel by ID
   */
  getPanel<T extends UIPanel>(id: string): T | undefined {
    return this.panels.get(id) as T | undefined;
  }

  /**
   * Check if a panel exists
   */
  hasPanel(id: string): boolean {
    return this.panels.has(id);
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.toggle();
    }
  }

  /**
   * Set panel visibility
   */
  setPanelVisible(id: string, visible: boolean): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.setVisible(visible);
    }
  }

  /**
   * Update all panels with new data
   */
  update(data: UIData): void {
    for (const panel of this.panels.values()) {
      panel.update(data);
    }
  }

  /**
   * Render all visible panels in order
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const id of this.renderOrder) {
      const panel = this.panels.get(id);
      if (panel && panel.visible) {
        panel.render(ctx);
      }
    }
  }

  /**
   * Bring a panel to the front (render last)
   */
  bringToFront(id: string): void {
    this.renderOrder = this.renderOrder.filter(i => i !== id);
    this.renderOrder.push(id);
  }

  /**
   * Get all panel IDs
   */
  getPanelIds(): string[] {
    return Array.from(this.panels.keys());
  }

  /**
   * Handle a click event, delegating to panels in reverse render order
   * Returns true if any panel handled the click
   */
  handleClick(x: number, y: number): boolean {
    // Check panels in reverse render order (top-most first)
    for (let i = this.renderOrder.length - 1; i >= 0; i--) {
      const id = this.renderOrder[i];
      const panel = this.panels.get(id);
      if (panel && panel.visible && panel.handleClick(x, y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Configure responsive layout
   */
  setColumnLayout(startY: number, gap: number = 10): void {
    this.columnStartY = startY;
    this.columnGap = gap;
  }

  /**
   * Add a panel to the left column (stacks top to bottom)
   */
  addToLeftColumn(id: string): void {
    if (!this.leftColumn.includes(id)) {
      this.leftColumn.push(id);
    }
  }

  /**
   * Add a panel to the right column (stacks top to bottom)
   */
  addToRightColumn(id: string): void {
    if (!this.rightColumn.includes(id)) {
      this.rightColumn.push(id);
    }
  }

  /**
   * Layout columns - call after update() to reposition panels
   */
  layoutColumns(canvasWidth: number): void {
    const margin = 10;

    // Layout left column
    let y = this.columnStartY;
    for (const id of this.leftColumn) {
      const panel = this.panels.get(id);
      if (panel && panel.visible) {
        panel.setPosition(margin, y);
        y += panel.height + this.columnGap;
      }
    }

    // Layout right column
    y = this.columnStartY;
    for (const id of this.rightColumn) {
      const panel = this.panels.get(id);
      if (panel && panel.visible) {
        panel.setPosition(canvasWidth - panel.width - margin, y);
        y += panel.height + this.columnGap;
      }
    }
  }
}
