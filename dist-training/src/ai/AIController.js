// AIController - Interface for AI players
/**
 * Random AI for baseline comparison
 * Moves cursor randomly around the canvas
 */
export class RandomAI {
    playerId;
    targetX = 0.5;
    targetY = 0.5;
    changeInterval = 30; // frames between target changes
    frameCount = 0;
    constructor(playerId) {
        this.playerId = playerId;
        this.randomizeTarget();
    }
    getName() {
        return 'RandomAI';
    }
    getAction(_game) {
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
    randomizeTarget() {
        // Keep some margin from edges
        this.targetX = 0.1 + Math.random() * 0.8;
        this.targetY = 0.1 + Math.random() * 0.8;
    }
    reset() {
        this.frameCount = 0;
        this.randomizeTarget();
    }
}
/**
 * Simple heuristic AI for testing
 * Moves cursor toward the center of mass of its own particles
 */
export class CenterOfMassAI {
    playerId;
    constructor(playerId) {
        this.playerId = playerId;
    }
    getName() {
        return 'CenterOfMassAI';
    }
    getAction(game) {
        const particles = game.getParticles();
        const players = game.getPlayers();
        const { width: canvasWidth, height: canvasHeight } = game.getCanvasSize();
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
                targetX: player.cursorX / canvasWidth,
                targetY: player.cursorY / canvasHeight,
            };
        }
        const centerX = sumX / count;
        const centerY = sumY / count;
        // Normalize to 0-1 range
        return {
            targetX: centerX / canvasWidth,
            targetY: centerY / canvasHeight,
        };
    }
    reset() {
        // No state to reset
    }
}
/**
 * Aggressive AI that chases enemy particles
 * Moves cursor toward the center of mass of enemy particles
 */
export class AggressiveAI {
    playerId;
    constructor(playerId) {
        this.playerId = playerId;
    }
    getName() {
        return 'AggressiveAI';
    }
    getAction(game) {
        const particles = game.getParticles();
        const players = game.getPlayers();
        const { width: canvasWidth, height: canvasHeight } = game.getCanvasSize();
        // Find center of mass of ALL enemy particles (any player that isn't us)
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (const particle of particles) {
            if (particle.owner !== this.playerId) {
                sumX += particle.x;
                sumY += particle.y;
                count++;
            }
        }
        if (count === 0) {
            // No enemy particles, stay at current position
            const player = players[this.playerId];
            return {
                targetX: player.cursorX / canvasWidth,
                targetY: player.cursorY / canvasHeight,
            };
        }
        const centerX = sumX / count;
        const centerY = sumY / count;
        // Normalize to 0-1 range
        return {
            targetX: centerX / canvasWidth,
            targetY: centerY / canvasHeight,
        };
    }
    reset() {
        // No state to reset
    }
}
//# sourceMappingURL=AIController.js.map