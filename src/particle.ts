// Particle class with physics

import type { Vec2 } from './types';
import type { Obstacle } from './obstacle';
import { distance, normalize, length, clamp } from './utils';

// Physics constants
const ACCELERATION = 200; // units/sec²
const MAX_VELOCITY = 150; // units/sec
const FRICTION = 0.98; // per frame
const PARTICLE_RADIUS = 4;
const REPULSION_RADIUS = 12; // Distance at which particles repel each other
const REPULSION_STRENGTH = 100; // Force of repulsion

export class Particle {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  readonly radius: number = PARTICLE_RADIUS;
  color: string = '#4488ff'; // Default blue

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, cursorPos: Vec2, canvasWidth: number, canvasHeight: number, allParticles: Particle[], obstacles: Obstacle[]): void {
    // Apply acceleration toward cursor
    this.applyAcceleration(cursorPos, dt);

    // Apply soft repulsion from nearby particles
    this.applySoftRepulsion(allParticles, dt);

    // Apply friction
    this.applyFriction();

    // Update position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Resolve obstacle collisions
    for (const obstacle of obstacles) {
      obstacle.resolveParticleCollision(this);
    }

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

  private applyAcceleration(cursor: Vec2, dt: number): void {
    // Calculate direction to cursor
    const dx = cursor.x - this.x;
    const dy = cursor.y - this.y;
    const dir = normalize(dx, dy);

    // Apply acceleration in that direction
    this.vx += dir.x * ACCELERATION * dt;
    this.vy += dir.y * ACCELERATION * dt;

    // Cap velocity to max
    const speed = length(this.vx, this.vy);
    if (speed > MAX_VELOCITY) {
      const scale = MAX_VELOCITY / speed;
      this.vx *= scale;
      this.vy *= scale;
    }
  }

  private applyFriction(): void {
    this.vx *= FRICTION;
    this.vy *= FRICTION;
  }

  private applySoftRepulsion(allParticles: Particle[], dt: number): void {
    // Check all other particles for repulsion
    for (const other of allParticles) {
      // Skip self
      if (other === this) continue;

      // Calculate distance to other particle
      const dist = distance(this.x, this.y, other.x, other.y);

      // If within repulsion radius, apply repulsion force
      if (dist < REPULSION_RADIUS && dist > 0.1) {
        // Calculate repulsion direction (away from other particle)
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dir = normalize(dx, dy);

        // Stronger repulsion when closer
        const strength = REPULSION_STRENGTH * (1 - dist / REPULSION_RADIUS);

        // Apply repulsion force
        this.vx += dir.x * strength * dt;
        this.vy += dir.y * strength * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
