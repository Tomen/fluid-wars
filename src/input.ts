// InputManager class for keyboard and mouse controls

import type { Vec2 } from './types';
import { normalize } from './utils';

interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
}

const PLAYER_KEYS: KeyBindings[] = [
  // Player 1 (Blue) - WASD
  { up: 'w', down: 's', left: 'a', right: 'd' },
  // Player 2 (Red) - Arrow Keys
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
];

/**
 * InputManager for keyboard and mouse controls
 * Supports both browser mode (keyboard/mouse events) and headless mode (for AI training)
 */
export class InputManager {
  private keysPressed: Set<string> = new Set();
  private readonly headless: boolean;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;

  // Mouse state for player 1
  private mouseX: number = 0;
  private mouseY: number = 0;
  private mouseActive: boolean = false;
  private canvas: HTMLCanvasElement | null = null;

  /**
   * Create an InputManager
   * @param headless If true, skip browser event listeners (for Node.js/AI training)
   * @param canvas Optional canvas element for mouse tracking
   */
  constructor(headless: boolean = false, canvas?: HTMLCanvasElement) {
    this.headless = headless;
    this.canvas = canvas || null;

    if (!headless) {
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    // Check if window exists (browser environment)
    if (typeof window === 'undefined') {
      return;
    }

    this.keydownHandler = (e: KeyboardEvent) => {
      this.keysPressed.add(e.key.toLowerCase());

      // Prevent arrow keys from scrolling the page
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    // Mouse tracking on canvas
    if (this.canvas) {
      this.mousemoveHandler = (e: MouseEvent) => {
        const rect = this.canvas!.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.mouseActive = true;
      };
      this.canvas.addEventListener('mousemove', this.mousemoveHandler);
    }
  }

  /**
   * Set or update the canvas for mouse tracking
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    // Remove old listener
    if (this.canvas && this.mousemoveHandler) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
    }

    this.canvas = canvas;

    if (!this.headless && this.canvas) {
      this.mousemoveHandler = (e: MouseEvent) => {
        const rect = this.canvas!.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.mouseActive = true;
      };
      this.canvas.addEventListener('mousemove', this.mousemoveHandler);
    }
  }

  /**
   * Get mouse position if mouse is active, null otherwise
   */
  getMousePosition(): Vec2 | null {
    if (this.headless || !this.mouseActive) {
      return null;
    }
    return { x: this.mouseX, y: this.mouseY };
  }

  getPlayerInput(playerId: number): Vec2 {
    // In headless mode, always return no input (AI will set cursor directly)
    if (this.headless) {
      return { x: 0, y: 0 };
    }

    const bindings = PLAYER_KEYS[playerId];
    if (!bindings) {
      return { x: 0, y: 0 };
    }

    let dx = 0;
    let dy = 0;

    // Check each direction
    if (this.keysPressed.has(bindings.left.toLowerCase())) {
      dx -= 1;
    }
    if (this.keysPressed.has(bindings.right.toLowerCase())) {
      dx += 1;
    }
    if (this.keysPressed.has(bindings.up.toLowerCase())) {
      dy -= 1;
    }
    if (this.keysPressed.has(bindings.down.toLowerCase())) {
      dy += 1;
    }

    // Normalize to ensure diagonal movement isn't faster
    if (dx !== 0 || dy !== 0) {
      return normalize(dx, dy);
    }

    return { x: 0, y: 0 };
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  /**
   * Check if running in headless mode
   */
  isHeadless(): boolean {
    return this.headless;
  }

  destroy(): void {
    // Remove event listeners if they were added
    if (typeof window !== 'undefined' && !this.headless) {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.keyupHandler) {
        window.removeEventListener('keyup', this.keyupHandler);
      }
      if (this.canvas && this.mousemoveHandler) {
        this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
      }
    }

    this.keysPressed.clear();
    this.mouseActive = false;
  }
}
