// Obstacle class for static collision shapes

import type { Vec2, ObstacleData, RectObstacle, CircleObstacle } from './types';
import { clamp } from './utils';
import { OBSTACLE_CONFIG } from './config';

export class Obstacle {
  readonly type: 'rect' | 'circle';
  private data: ObstacleData;

  constructor(data: ObstacleData) {
    this.type = data.type;
    this.data = data;
  }

  contains(x: number, y: number): boolean {
    if (this.type === 'rect') {
      const rect = this.data as RectObstacle;
      return (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      );
    } else {
      const circle = this.data as CircleObstacle;
      const dx = x - circle.x;
      const dy = y - circle.y;
      return dx * dx + dy * dy <= circle.radius * circle.radius;
    }
  }

  getNearestPoint(x: number, y: number): Vec2 {
    if (this.type === 'rect') {
      const rect = this.data as RectObstacle;
      return {
        x: clamp(x, rect.x, rect.x + rect.width),
        y: clamp(y, rect.y, rect.y + rect.height)
      };
    } else {
      const circle = this.data as CircleObstacle;
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

  resolveParticleCollision(particle: { x: number; y: number; vx: number; vy: number; radius: number }): void {
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
          // Reflect velocity
          particle.vx -= 2 * velDotNormal * normalX;
          particle.vy -= 2 * velDotNormal * normalY;

          // Apply energy loss
          particle.vx *= OBSTACLE_CONFIG.bounceEnergyLoss;
          particle.vy *= OBSTACLE_CONFIG.bounceEnergyLoss;
        }
      } else {
        // Particle center is exactly on obstacle surface - push away slightly
        // Use a default push direction (could happen at edges/corners)
        particle.x += 1;
        particle.y += 1;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#222244';
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 2;

    if (this.type === 'rect') {
      const rect = this.data as RectObstacle;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      const circle = this.data as CircleObstacle;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
