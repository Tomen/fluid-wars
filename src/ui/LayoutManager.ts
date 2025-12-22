// LayoutManager - Responsive layout calculator for game canvas and UI area

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutInfo {
  gameRect: LayoutRect;
  uiRect: LayoutRect;
  uiPosition: 'bottom' | 'right';
  scale: number; // How much the game is scaled from native resolution
}

export interface LayoutConfig {
  gameWidth: number;   // Native game width from config
  gameHeight: number;  // Native game height from config
  uiSize: number;      // Fixed UI area size in pixels
  padding: number;     // Padding around the layout
}

export class LayoutManager {
  private config: LayoutConfig;
  private currentLayout: LayoutInfo;
  private resizeCallback: (() => void) | null = null;

  constructor(config: LayoutConfig) {
    this.config = config;
    this.currentLayout = this.calculateLayout();

    // Listen for window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.currentLayout = this.calculateLayout();
    if (this.resizeCallback) {
      this.resizeCallback();
    }
  }

  /**
   * Set callback to be called when layout changes
   */
  onResize(callback: () => void): void {
    this.resizeCallback = callback;
  }

  /**
   * Get the current layout info
   */
  getLayout(): LayoutInfo {
    return this.currentLayout;
  }

  /**
   * Recalculate layout (call after config changes)
   */
  recalculate(): LayoutInfo {
    this.currentLayout = this.calculateLayout();
    return this.currentLayout;
  }

  /**
   * Calculate optimal layout based on window size
   */
  private calculateLayout(): LayoutInfo {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const { gameWidth, gameHeight, uiSize, padding } = this.config;

    // Available space after padding
    const availWidth = windowWidth - padding * 2;
    const availHeight = windowHeight - padding * 2;

    // Try layout with UI on right (reserve minimum uiSize for UI)
    const rightLayoutGameWidth = availWidth - uiSize;
    const rightLayoutGameHeight = availHeight;
    const rightScale = Math.min(
      rightLayoutGameWidth / gameWidth,
      rightLayoutGameHeight / gameHeight
    );
    const rightGameActualWidth = gameWidth * rightScale;
    const rightGameActualHeight = gameHeight * rightScale;

    // Try layout with UI on bottom (reserve minimum uiSize for UI)
    const bottomLayoutGameWidth = availWidth;
    const bottomLayoutGameHeight = availHeight - uiSize;
    const bottomScale = Math.min(
      bottomLayoutGameWidth / gameWidth,
      bottomLayoutGameHeight / gameHeight
    );
    const bottomGameActualWidth = gameWidth * bottomScale;
    const bottomGameActualHeight = gameHeight * bottomScale;

    // Choose the layout that gives the larger game area
    const rightArea = rightGameActualWidth * rightGameActualHeight;
    const bottomArea = bottomGameActualWidth * bottomGameActualHeight;

    if (rightArea >= bottomArea) {
      // UI on right - game at left edge, UI fills remaining space
      const gameX = padding;
      const gameY = padding + (availHeight - rightGameActualHeight) / 2;

      // UI starts right after game and extends to window edge
      const uiX = padding + rightGameActualWidth;
      const uiWidth = windowWidth - uiX - padding;

      return {
        gameRect: {
          x: gameX,
          y: gameY,
          width: rightGameActualWidth,
          height: rightGameActualHeight,
        },
        uiRect: {
          x: uiX,
          y: padding,
          width: uiWidth,
          height: availHeight,
        },
        uiPosition: 'right',
        scale: rightScale,
      };
    } else {
      // UI on bottom - game at top, UI fills remaining space
      const gameX = padding + (availWidth - bottomGameActualWidth) / 2;
      const gameY = padding;

      // UI starts right after game and extends to window edge
      const uiY = padding + bottomGameActualHeight;
      const uiHeight = windowHeight - uiY - padding;

      return {
        gameRect: {
          x: gameX,
          y: gameY,
          width: bottomGameActualWidth,
          height: bottomGameActualHeight,
        },
        uiRect: {
          x: padding,
          y: uiY,
          width: availWidth,
          height: uiHeight,
        },
        uiPosition: 'bottom',
        scale: bottomScale,
      };
    }
  }

  /**
   * Apply layout to DOM elements
   */
  applyToElements(canvas: HTMLCanvasElement, uiArea: HTMLElement): void {
    const layout = this.currentLayout;

    // Keep canvas at native game resolution (for coordinate system)
    // Only set these once - don't change on resize
    if (canvas.width !== this.config.gameWidth || canvas.height !== this.config.gameHeight) {
      canvas.width = this.config.gameWidth;
      canvas.height = this.config.gameHeight;
    }

    // Use CSS to scale and position the canvas for display
    canvas.style.position = 'absolute';
    canvas.style.left = `${layout.gameRect.x}px`;
    canvas.style.top = `${layout.gameRect.y}px`;
    canvas.style.width = `${layout.gameRect.width}px`;
    canvas.style.height = `${layout.gameRect.height}px`;

    // Position and size the UI area
    uiArea.style.position = 'absolute';
    uiArea.style.left = `${layout.uiRect.x}px`;
    uiArea.style.top = `${layout.uiRect.y}px`;
    uiArea.style.width = `${layout.uiRect.width}px`;
    uiArea.style.height = `${layout.uiRect.height}px`;

    // Add orientation class
    uiArea.classList.remove('ui-bottom', 'ui-right');
    uiArea.classList.add(layout.uiPosition === 'bottom' ? 'ui-bottom' : 'ui-right');
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}
