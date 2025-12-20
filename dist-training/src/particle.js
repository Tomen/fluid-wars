// Particle class with physics
import { distance, normalize, length, clamp } from './utils';
import { PARTICLE_CONFIG } from './config';
export class Particle {
    x;
    y;
    vx = 0;
    vy = 0;
    radius = PARTICLE_CONFIG.radius;
    color = '#4488ff'; // Default blue
    owner = 0; // Player ID who owns this particle
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    update(dt, cursorPos, canvasWidth, canvasHeight, nearbyParticles, obstacles) {
        // Apply acceleration toward cursor
        this.applyAcceleration(cursorPos, dt);
        // Apply soft repulsion from nearby particles
        this.applySoftRepulsion(nearbyParticles, dt);
        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Resolve obstacle collisions
        for (const obstacle of obstacles) {
            obstacle.resolveParticleCollision(this);
        }
        // Apply friction AFTER collision resolution (prevents compound energy loss)
        this.applyFriction();
        // Keep particles within bounds
        this.x = clamp(this.x, this.radius, canvasWidth - this.radius);
        this.y = clamp(this.y, this.radius, canvasHeight - this.radius);
        // Bounce off edges
        if (this.x <= this.radius || this.x >= canvasWidth - this.radius) {
            this.vx *= -0.5;
        }
        if (this.y <= this.radius || this.y >= canvasHeight - this.radius) {
            this.vy *= -0.5;
        }
    }
    applyAcceleration(cursor, dt) {
        // Calculate direction to cursor
        const dx = cursor.x - this.x;
        const dy = cursor.y - this.y;
        const dir = normalize(dx, dy);
        // Apply acceleration in that direction
        this.vx += dir.x * PARTICLE_CONFIG.acceleration * dt;
        this.vy += dir.y * PARTICLE_CONFIG.acceleration * dt;
        // Cap velocity to max
        const speed = length(this.vx, this.vy);
        if (speed > PARTICLE_CONFIG.maxVelocity) {
            const scale = PARTICLE_CONFIG.maxVelocity / speed;
            this.vx *= scale;
            this.vy *= scale;
        }
    }
    applyFriction() {
        this.vx *= PARTICLE_CONFIG.friction;
        this.vy *= PARTICLE_CONFIG.friction;
    }
    applySoftRepulsion(nearbyParticles, dt) {
        // Check nearby particles for repulsion (provided by spatial hash)
        for (const other of nearbyParticles) {
            // Skip self
            if (other === this)
                continue;
            // Calculate distance to other particle
            const dist = distance(this.x, this.y, other.x, other.y);
            // If within repulsion radius, apply repulsion force
            if (dist < PARTICLE_CONFIG.repulsionRadius && dist > 0.1) {
                // Calculate repulsion direction (away from other particle)
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dir = normalize(dx, dy);
                // Calculate relative velocity along separation axis
                const relVelX = this.vx - other.vx;
                const relVelY = this.vy - other.vy;
                const approachSpeed = -(relVelX * dir.x + relVelY * dir.y);
                // Stronger repulsion when closer
                let strength = PARTICLE_CONFIG.repulsionStrength * (1 - dist / PARTICLE_CONFIG.repulsionRadius);
                // Scale repulsion based on approach speed:
                // - Approaching (positive): full repulsion (capped at 1)
                // - Separating (negative): reduced repulsion (minimum 0.2 to prevent overlap)
                const approachFactor = approachSpeed > 0
                    ? Math.min(approachSpeed / 100, 1) // Approaching: scale up to 1
                    : 0.2; // Separating: minimal repulsion
                strength *= approachFactor;
                // Apply extra repulsion between enemy particles to create clash effect
                if (other.owner !== this.owner) {
                    strength *= PARTICLE_CONFIG.enemyRepulsionMultiplier;
                }
                // Apply repulsion force
                this.vx += dir.x * strength * dt;
                this.vy += dir.y * strength * dt;
            }
        }
    }
    draw(ctx, conversionProgress, convertingPlayerColor) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        // Draw conversion progress indicator if being converted
        if (conversionProgress !== undefined && conversionProgress > 0 && convertingPlayerColor) {
            const progressRadius = this.radius + 2;
            const progressAngle = conversionProgress * Math.PI * 2;
            ctx.strokeStyle = convertingPlayerColor; // Color of the player doing the converting
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, progressRadius, -Math.PI / 2, -Math.PI / 2 + progressAngle);
            ctx.stroke();
        }
    }
}
//# sourceMappingURL=particle.js.map