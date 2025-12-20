// Player class with cursor management
import { clamp } from './utils';
import { PLAYER_CONFIG } from './config';
export class Player {
    id;
    color;
    cursorX;
    cursorY;
    isAI;
    particleCount = 0;
    constructor(id, color, isAI, startX, startY) {
        this.id = id;
        this.color = color;
        this.isAI = isAI;
        this.cursorX = startX;
        this.cursorY = startY;
    }
    updateCursor(input, dt, canvasWidth, canvasHeight) {
        // Move cursor based on input direction (normalized vector expected)
        this.cursorX += input.x * PLAYER_CONFIG.cursorSpeed * dt;
        this.cursorY += input.y * PLAYER_CONFIG.cursorSpeed * dt;
        // Keep cursor within bounds
        this.cursorX = clamp(this.cursorX, PLAYER_CONFIG.cursorRadius, canvasWidth - PLAYER_CONFIG.cursorRadius);
        this.cursorY = clamp(this.cursorY, PLAYER_CONFIG.cursorRadius, canvasHeight - PLAYER_CONFIG.cursorRadius);
    }
    /**
     * Move cursor towards a target position at the same speed as human players
     * Used by AI controllers to have fair movement speed
     */
    moveCursorTowards(targetX, targetY, dt, canvasWidth, canvasHeight) {
        // Calculate direction to target
        const dx = targetX - this.cursorX;
        const dy = targetY - this.cursorY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // If we're close enough, just snap to target
        const maxMove = PLAYER_CONFIG.cursorSpeed * dt;
        if (distance <= maxMove) {
            this.cursorX = targetX;
            this.cursorY = targetY;
        }
        else {
            // Move towards target at cursor speed
            const nx = dx / distance;
            const ny = dy / distance;
            this.cursorX += nx * maxMove;
            this.cursorY += ny * maxMove;
        }
        // Keep cursor within bounds
        this.cursorX = clamp(this.cursorX, PLAYER_CONFIG.cursorRadius, canvasWidth - PLAYER_CONFIG.cursorRadius);
        this.cursorY = clamp(this.cursorY, PLAYER_CONFIG.cursorRadius, canvasHeight - PLAYER_CONFIG.cursorRadius);
    }
    draw(ctx) {
        const r = PLAYER_CONFIG.cursorRadius;
        // Draw cursor as a circle with color
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.cursorX, this.cursorY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Draw crosshair
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.cursorX - r - 4, this.cursorY);
        ctx.lineTo(this.cursorX + r + 4, this.cursorY);
        ctx.moveTo(this.cursorX, this.cursorY - r - 4);
        ctx.lineTo(this.cursorX, this.cursorY + r + 4);
        ctx.stroke();
    }
}
//# sourceMappingURL=player.js.map