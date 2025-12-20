// Base class for UI panels

export interface PanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  framed?: boolean;
}

export abstract class UIPanel {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean = true;
  title: string;
  framed: boolean;

  constructor(config: PanelConfig) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.title = config.title || '';
    this.framed = config.framed ?? false;
  }

  abstract update(data: unknown): void;
  abstract renderContent(ctx: CanvasRenderingContext2D): void;

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    if (this.framed) this.renderFrame(ctx);
    this.renderContent(ctx);
  }

  protected renderFrame(ctx: CanvasRenderingContext2D): void {
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.width - 1, this.height - 1);

    // Title bar background
    if (this.title) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, 26);

      // Title text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '14px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.title, this.x + 12, this.y + 14);
    }
  }

  /** Get the Y offset for content (accounts for title bar) */
  protected get contentY(): number {
    return this.y + (this.title ? 32 : 6);
  }

  /** Get the X offset for content */
  protected get contentX(): number {
    return this.x + 12;
  }

  /** Get available content width */
  protected get contentWidth(): number {
    return this.width - 24;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  /**
   * Handle a click event at the given coordinates
   * Override in subclasses to handle clicks
   * @returns true if the click was handled, false otherwise
   */
  handleClick(_x: number, _y: number): boolean {
    return false;
  }

  /**
   * Check if a point is within this panel's bounds
   */
  containsPoint(x: number, y: number): boolean {
    return x >= this.x && x < this.x + this.width &&
           y >= this.y && y < this.y + this.height;
  }
}
