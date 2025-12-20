// Obstacle class for static collision shapes
import { clamp } from './utils';
import { OBSTACLE_CONFIG } from './config';
export class Obstacle {
    type;
    data;
    constructor(data) {
        this.type = data.type;
        this.data = data;
    }
    /**
     * Get the raw obstacle data for serialization
     */
    getData() {
        return this.data;
    }
    contains(x, y) {
        if (this.type === 'rect') {
            const rect = this.data;
            return (x >= rect.x &&
                x <= rect.x + rect.width &&
                y >= rect.y &&
                y <= rect.y + rect.height);
        }
        else {
            const circle = this.data;
            const dx = x - circle.x;
            const dy = y - circle.y;
            return dx * dx + dy * dy <= circle.radius * circle.radius;
        }
    }
    getNearestPoint(x, y) {
        if (this.type === 'rect') {
            const rect = this.data;
            return {
                x: clamp(x, rect.x, rect.x + rect.width),
                y: clamp(y, rect.y, rect.y + rect.height)
            };
        }
        else {
            const circle = this.data;
            const dx = x - circle.x;
            const dy = y - circle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) {
                // Point is at circle center, return point on edge
                return { x: circle.x + circle.radius, y: circle.y };
            }
            // Return point on circle edge closest to (x, y)
            return {
                x: circle.x + (dx / dist) * circle.radius,
                y: circle.y + (dy / dist) * circle.radius
            };
        }
    }
    resolveParticleCollision(particle) {
        // Get nearest point on obstacle surface to particle center
        const nearest = this.getNearestPoint(particle.x, particle.y);
        // Calculate distance from particle center to nearest point on obstacle
        const dx = particle.x - nearest.x;
        const dy = particle.y - nearest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Check if particle is colliding (distance less than particle radius)
        if (dist < particle.radius) {
            // There is a collision - push particle out
            const overlap = particle.radius - dist;
            if (dist > 0.01) {
                // Normal vector points away from obstacle
                const normalX = dx / dist;
                const normalY = dy / dist;
                // Push particle out by the overlap distance
                particle.x += normalX * overlap;
                particle.y += normalY * overlap;
                // Reflect velocity component that points into obstacle
                const velDotNormal = particle.vx * normalX + particle.vy * normalY;
                // Only reflect if moving toward the obstacle
                if (velDotNormal < 0) {
                    // Wall sliding: preserve tangential velocity, only reduce normal component
                    // This lets particles slide along walls instead of bouncing back and forth
                    const tangentX = -normalY;
                    const tangentY = normalX;
                    const velDotTangent = particle.vx * tangentX + particle.vy * tangentY;
                    // Reconstruct velocity: full tangent + reflected normal with energy loss
                    // Normal component is reversed and reduced by energy loss factor
                    const reducedNormal = -velDotNormal * OBSTACLE_CONFIG.bounceEnergyLoss;
                    particle.vx = velDotTangent * tangentX + reducedNormal * normalX;
                    particle.vy = velDotTangent * tangentY + reducedNormal * normalY;
                }
            }
            else {
                // Particle center is exactly on obstacle surface - push away slightly
                // Use a default push direction (could happen at edges/corners)
                particle.x += 1;
                particle.y += 1;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#222244';
        ctx.strokeStyle = '#444466';
        ctx.lineWidth = 2;
        if (this.type === 'rect') {
            const rect = this.data;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
        else {
            const circle = this.data;
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}
//# sourceMappingURL=obstacle.js.map