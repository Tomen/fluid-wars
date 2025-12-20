// Renderer class for canvas drawing
import { RENDER_CONFIG } from './config';
// Height of the power distribution bar at the top
export const POWER_BAR_HEIGHT = 40;
export class Renderer {
    ctx;
    width;
    height;
    /** The playable game area height (excludes power bar) */
    gameHeight;
    constructor(canvas) {
        this.width = canvas.width;
        this.height = canvas.height;
        this.gameHeight = canvas.height - POWER_BAR_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context');
        }
        this.ctx = ctx;
    }
    clear() {
        this.ctx.fillStyle = RENDER_CONFIG.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    drawBackground() {
        this.clear();
    }
    drawObstacles(obstacles) {
        this.ctx.save();
        this.ctx.translate(0, POWER_BAR_HEIGHT);
        for (const obstacle of obstacles) {
            obstacle.draw(this.ctx);
        }
        this.ctx.restore();
    }
    drawParticles(particles, conversionProgressMap, convertingColorMap) {
        this.ctx.save();
        this.ctx.translate(0, POWER_BAR_HEIGHT);
        for (const particle of particles) {
            const progress = conversionProgressMap?.get(particle);
            const convertingColor = convertingColorMap?.get(particle);
            particle.draw(this.ctx, progress, convertingColor);
        }
        this.ctx.restore();
    }
    drawPlayers(players) {
        this.ctx.save();
        this.ctx.translate(0, POWER_BAR_HEIGHT);
        for (const player of players) {
            player.draw(this.ctx);
        }
        this.ctx.restore();
    }
}
//# sourceMappingURL=renderer.js.map