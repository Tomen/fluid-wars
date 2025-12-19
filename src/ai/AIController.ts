// AIController - Interface for AI players

import type { Game } from '../game';
import type { AIAction } from '../core/AIInterface';

/**
 * Base interface for AI controllers
 *
 * AI controllers observe the game state and produce cursor target positions.
 * The interface is designed to work with both training and inference.
 */
export interface AIController {
  /** The player ID this AI controls */
  readonly playerId: number;

  /**
   * Get the AI's name/identifier
   */
  getName(): string;

  /**
   * Compute the next action given the current game state
   *
   * @param game The current game instance
   * @returns Action with normalized target position (0-1 range)
   */
  getAction(game: Game): AIAction;

  /**
   * Reset the controller's internal state (if any)
   * Called at the start of each new episode
   */
  reset(): void;
}

/**
 * Random AI for baseline comparison
 * Moves cursor randomly around the canvas
 */
export class RandomAI implements AIController {
  readonly playerId: number;
  private targetX: number = 0.5;
  private targetY: number = 0.5;
  private changeInterval: number = 30; // frames between target changes
  private frameCount: number = 0;

  constructor(playerId: number) {
    this.playerId = playerId;
    this.randomizeTarget();
  }

  getName(): string {
    return 'RandomAI';
  }

  getAction(_game: Game): AIAction {
    this.frameCount++;

    // Occasionally change target
    if (this.frameCount >= this.changeInterval) {
      this.randomizeTarget();
      this.frameCount = 0;
    }

    return {
      targetX: this.targetX,
      targetY: this.targetY,
    };
  }

  private randomizeTarget(): void {
    // Keep some margin from edges
    this.targetX = 0.1 + Math.random() * 0.8;
    this.targetY = 0.1 + Math.random() * 0.8;
  }

  reset(): void {
    this.frameCount = 0;
    this.randomizeTarget();
  }
}

/**
 * Simple heuristic AI for testing
 * Moves cursor toward the center of mass of its own particles
 */
export class CenterOfMassAI implements AIController {
  readonly playerId: number;

  constructor(playerId: number) {
    this.playerId = playerId;
  }

  getName(): string {
    return 'CenterOfMassAI';
  }

  getAction(game: Game): AIAction {
    const particles = game.getParticles();
    const players = game.getPlayers();

    // Find center of mass of own particles
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const particle of particles) {
      if (particle.owner === this.playerId) {
        sumX += particle.x;
        sumY += particle.y;
        count++;
      }
    }

    if (count === 0) {
      // No particles left, stay at current position
      const player = players[this.playerId];
      return {
        targetX: player.cursorX / 1200, // Assuming default canvas width
        targetY: player.cursorY / 800,  // Assuming default canvas height
      };
    }

    const centerX = sumX / count;
    const centerY = sumY / count;

    // Normalize to 0-1 range
    return {
      targetX: centerX / 1200,
      targetY: centerY / 800,
    };
  }

  reset(): void {
    // No state to reset
  }
}

/**
 * Aggressive AI that chases enemy particles
 * Moves cursor toward the center of mass of enemy particles
 */
export class AggressiveAI implements AIController {
  readonly playerId: number;

  constructor(playerId: number) {
    this.playerId = playerId;
  }

  getName(): string {
    return 'AggressiveAI';
  }

  getAction(game: Game): AIAction {
    const particles = game.getParticles();
    const players = game.getPlayers();
    const enemyId = 1 - this.playerId;

    // Find center of mass of enemy particles
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const particle of particles) {
      if (particle.owner === enemyId) {
        sumX += particle.x;
        sumY += particle.y;
        count++;
      }
    }

    if (count === 0) {
      // No enemy particles, stay at current position
      const player = players[this.playerId];
      return {
        targetX: player.cursorX / 1200,
        targetY: player.cursorY / 800,
      };
    }

    const centerX = sumX / count;
    const centerY = sumY / count;

    // Normalize to 0-1 range
    return {
      targetX: centerX / 1200,
      targetY: centerY / 800,
    };
  }

  reset(): void {
    // No state to reset
  }
}
