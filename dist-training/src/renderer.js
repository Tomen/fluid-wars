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
    drawDebugText(text, x = 10, y = 20) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(text, x, y);
    }
    drawFPS(fps) {
        this.drawDebugText(`FPS: ${fps.toFixed(1)}`, 10, 20);
    }
    /**
     * Draw a power distribution bar at the top of the screen
     * Each player's segment is proportional to their particle count
     */
    drawPowerBar(players, totalParticles) {
        if (totalParticles === 0)
            return;
        const barHeight = 40;
        const barY = 0;
        const barWidth = this.width;
        let xOffset = 0;
        for (const player of players) {
            const ratio = player.particleCount / totalParticles;
            const segmentWidth = ratio * barWidth;
            if (segmentWidth > 0) {
                this.ctx.fillStyle = player.color;
                this.ctx.fillRect(xOffset, barY, segmentWidth, barHeight);
                xOffset += segmentWidth;
            }
        }
        // Draw subtle border at bottom of bar
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, barHeight);
        this.ctx.lineTo(barWidth, barHeight);
        this.ctx.stroke();
    }
    /**
     * Draw the AI observation grid overlay
     * Green = friendly particles, Red = enemy particles, Blue = obstacles
     */
    drawObservationGrid(observation, x, y, cellSize = 10, playerColor) {
        const rows = observation.length;
        const cols = observation[0].length;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const friendly = observation[r][c][0];
                const enemy = observation[r][c][1];
                const obstacle = observation[r][c][2];
                const red = Math.floor(enemy * 255);
                const green = Math.floor(friendly * 255);
                const blue = Math.floor(obstacle * 255);
                this.ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                this.ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
            }
        }
        // Border with player color
        this.ctx.strokeStyle = playerColor || '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, cols * cellSize, rows * cellSize);
        // Label with player color
        this.ctx.fillStyle = playerColor || '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.fillText('AI View', x, y - 5);
    }
}
//# sourceMappingURL=renderer.js.map