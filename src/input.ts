// InputManager class for keyboard controls

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
 * InputManager for keyboard controls
 * Supports both browser mode (keyboard events) and headless mode (for AI training)
 */
export class InputManager {
  private keysPressed: Set<string> = new Set();
  private readonly headless: boolean;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Create an InputManager
   * @param headless If true, skip browser event listeners (for Node.js/AI training)
   */
  constructor(headless: boolean = false) {
    this.headless = headless;

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
    }

    this.keysPressed.clear();
  }
}
