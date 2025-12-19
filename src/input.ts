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

export class InputManager {
  private keysPressed: Set<string> = new Set();

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.key.toLowerCase());

      // Prevent arrow keys from scrolling the page
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });
  }

  getPlayerInput(playerId: number): Vec2 {
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

  destroy(): void {
    // Clear all listeners (for cleanup if needed)
    this.keysPressed.clear();
  }
}
