// Conversion system for particle ownership changes

import type { Particle } from './particle';
import { distance } from './utils';

// Conversion constants
const CONVERSION_RADIUS = 20; // Distance at which conversion can occur (larger than repulsion)
const CONVERSION_RATE = 0.3; // Progress per second when outnumbered
const CONVERSION_THRESHOLD = 1.0; // Amount of progress needed to convert

export interface ConversionProgress {
  particleId: number;
  progress: number;
}

export class ConversionSystem {
  private conversionProgress: Map<Particle, number> = new Map();

  /**
   * Updates conversion progress for a particle based on nearby enemies
   * Returns true if the particle was converted
   */
  updateConversion(particle: Particle, nearbyParticles: Particle[], dt: number): boolean {
    // Count friendly and enemy particles within conversion radius
    let friendlyCount = 0;
    let enemyCount = 0;

    for (const other of nearbyParticles) {
      if (other === particle) continue;

      const dist = distance(particle.x, particle.y, other.x, other.y);

      if (dist < CONVERSION_RADIUS) {
        if (other.owner === particle.owner) {
          friendlyCount++;
        } else {
          enemyCount++;
        }
      }
    }

    // If no enemies nearby, decay conversion progress
    if (enemyCount === 0) {
      this.decayProgress(particle, dt);
      return false;
    }

    // If outnumbered, build up conversion progress
    if (enemyCount > friendlyCount) {
      const currentProgress = this.conversionProgress.get(particle) || 0;
      const newProgress = currentProgress + CONVERSION_RATE * dt;

      this.conversionProgress.set(particle, newProgress);

      // Check if particle should be converted
      if (newProgress >= CONVERSION_THRESHOLD) {
        this.conversionProgress.delete(particle);
        return true; // Signal that conversion happened
      }
    } else {
      // If not outnumbered, decay conversion progress
      this.decayProgress(particle, dt);
    }

    return false;
  }

  /**
   * Gets the dominant enemy player ID near a particle
   * Returns the player ID that should take ownership, or -1 if none
   */
  getDominantEnemyPlayer(particle: Particle, nearbyParticles: Particle[]): number {
    const enemyCounts = new Map<number, number>();

    for (const other of nearbyParticles) {
      if (other === particle || other.owner === particle.owner) continue;

      const dist = distance(particle.x, particle.y, other.x, other.y);

      if (dist < CONVERSION_RADIUS) {
        const count = enemyCounts.get(other.owner) || 0;
        enemyCounts.set(other.owner, count + 1);
      }
    }

    // Find the enemy player with the most particles nearby
    let dominantPlayer = -1;
    let maxCount = 0;

    for (const [playerId, count] of enemyCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantPlayer = playerId;
      }
    }

    return dominantPlayer;
  }

  /**
   * Decays conversion progress over time when not being converted
   */
  private decayProgress(particle: Particle, dt: number): void {
    const currentProgress = this.conversionProgress.get(particle);

    if (currentProgress !== undefined) {
      const newProgress = Math.max(0, currentProgress - CONVERSION_RATE * 2 * dt);

      if (newProgress <= 0) {
        this.conversionProgress.delete(particle);
      } else {
        this.conversionProgress.set(particle, newProgress);
      }
    }
  }

  /**
   * Gets the conversion progress for a particle (0-1)
   */
  getProgress(particle: Particle): number {
    return this.conversionProgress.get(particle) || 0;
  }

  /**
   * Clears all conversion progress
   */
  reset(): void {
    this.conversionProgress.clear();
  }
}
