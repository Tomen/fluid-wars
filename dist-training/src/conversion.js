// Conversion system for particle ownership changes
import { distance } from './utils';
import { CONVERSION_CONFIG } from './config';
export class ConversionSystem {
    conversionProgress = new Map();
    /**
     * Updates conversion progress for a particle based on nearby enemies
     * Returns true if the particle was converted
     */
    updateConversion(particle, nearbyParticles, dt) {
        // Count friendly and enemy particles within conversion radius
        let friendlyCount = 0;
        let enemyCount = 0;
        for (const other of nearbyParticles) {
            if (other === particle)
                continue;
            const dist = distance(particle.x, particle.y, other.x, other.y);
            if (dist < CONVERSION_CONFIG.radius) {
                if (other.owner === particle.owner) {
                    friendlyCount++;
                }
                else {
                    enemyCount++;
                }
            }
        }
        // If no enemies nearby, decay conversion progress
        if (enemyCount === 0) {
            this.decayProgress(particle, dt);
            return false;
        }
        // If outnumbered (with friendlySupportFactor reducing defender effectiveness), build up conversion progress
        if (enemyCount > friendlyCount * CONVERSION_CONFIG.friendlySupportFactor) {
            const currentProgress = this.conversionProgress.get(particle) || 0;
            const newProgress = currentProgress + CONVERSION_CONFIG.rate * dt;
            this.conversionProgress.set(particle, newProgress);
            // Check if particle should be converted
            if (newProgress >= CONVERSION_CONFIG.threshold) {
                this.conversionProgress.delete(particle);
                return true; // Signal that conversion happened
            }
        }
        else {
            // If not outnumbered, decay conversion progress
            this.decayProgress(particle, dt);
        }
        return false;
    }
    /**
     * Gets the dominant enemy player ID near a particle
     * Returns the player ID that should take ownership, or -1 if none
     */
    getDominantEnemyPlayer(particle, nearbyParticles) {
        const enemyCounts = new Map();
        for (const other of nearbyParticles) {
            if (other === particle || other.owner === particle.owner)
                continue;
            const dist = distance(particle.x, particle.y, other.x, other.y);
            if (dist < CONVERSION_CONFIG.radius) {
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
    decayProgress(particle, dt) {
        const currentProgress = this.conversionProgress.get(particle);
        if (currentProgress !== undefined) {
            const newProgress = Math.max(0, currentProgress - CONVERSION_CONFIG.rate * CONVERSION_CONFIG.decayMultiplier * dt);
            if (newProgress <= 0) {
                this.conversionProgress.delete(particle);
            }
            else {
                this.conversionProgress.set(particle, newProgress);
            }
        }
    }
    /**
     * Gets the conversion progress for a particle (0-1)
     */
    getProgress(particle) {
        return this.conversionProgress.get(particle) || 0;
    }
    /**
     * Clears all conversion progress
     */
    reset() {
        this.conversionProgress.clear();
    }
}
//# sourceMappingURL=conversion.js.map