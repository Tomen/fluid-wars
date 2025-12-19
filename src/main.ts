// Fluid Wars - Main Application Entry Point

import type { AppState, GameConfig, Vec2 } from './types';
import { Particle } from './particle';
import { Obstacle } from './obstacle';
import { Renderer } from './renderer';
import { randomRange } from './utils';

// Constants
const FIXED_DT = 1 / 60; // 60 FPS physics
const MAX_ACCUMULATOR = 0.1; // Prevent spiral of death
const PARTICLE_COUNT = 100;

class App {
  private state: AppState = 'playing'; // Start in playing state for now
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsTime: number = 0;

  // Game state
  private particles: Particle[] = [];
  private obstacles: Obstacle[] = [];
  private mousePos: Vec2 = { x: 600, y: 400 }; // Center of canvas

  constructor() {
    // Get canvas element
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    this.canvas = canvas;

    // Create renderer
    this.renderer = new Renderer(canvas);

    // Create obstacles
    this.initObstacles();

    // Create particles
    this.initParticles();

    // Setup mouse tracking
    this.setupMouseTracking();

    console.log('Fluid Wars initialized');
    console.log(`Canvas size: ${this.renderer.width}x${this.renderer.height}`);
    console.log(`Particles: ${this.particles.length}`);
    console.log(`Obstacles: ${this.obstacles.length}`);
  }

  private initObstacles(): void {
    // Create a few test obstacles
    // Center rectangle
    this.obstacles.push(new Obstacle({
      type: 'rect',
      x: 500,
      y: 300,
      width: 200,
      height: 200
    }));

    // Top-left circle
    this.obstacles.push(new Obstacle({
      type: 'circle',
      x: 200,
      y: 150,
      radius: 60
    }));

    // Bottom-right circle
    this.obstacles.push(new Obstacle({
      type: 'circle',
      x: 1000,
      y: 650,
      radius: 60
    }));
  }

  private initParticles(): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = randomRange(50, this.renderer.width - 50);
      const y = randomRange(50, this.renderer.height - 50);
      this.particles.push(new Particle(x, y));
    }
  }

  private setupMouseTracking(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
    });
  }

  init(): void {
    // Start the game loop
    requestAnimationFrame((time) => this.loop(time));
  }

  setState(newState: AppState, config?: GameConfig): void {
    console.log(`State transition: ${this.state} -> ${newState}`);
    this.state = newState;
  }

  update(dt: number): void {
    switch (this.state) {
      case 'playing':
        // Update all particles
        for (const particle of this.particles) {
          particle.update(dt, this.mousePos, this.renderer.width, this.renderer.height, this.particles, this.obstacles);
        }
        break;
    }
  }

  render(): void {
    // Clear and draw background
    this.renderer.drawBackground();

    // Render based on state
    switch (this.state) {
      case 'playing':
        // Draw obstacles first (behind particles)
        this.renderer.drawObstacles(this.obstacles);
        // Draw particles
        this.renderer.drawParticles(this.particles);
        break;
    }

    // Draw debug info
    this.renderer.drawDebugText(`FPS: ${this.fps.toFixed(1)} | Particles: ${this.particles.length} | Obstacles: ${this.obstacles.length}`, 10, 20);
    this.renderer.drawDebugText(`Mouse: (${Math.floor(this.mousePos.x)}, ${Math.floor(this.mousePos.y)})`, 10, 40);
  }

  loop(timestamp: number): void {
    // Calculate frame time
    const frameTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Calculate FPS
    this.frameCount++;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 1.0) {
      this.fps = this.frameCount / this.fpsTime;
      this.frameCount = 0;
      this.fpsTime = 0;
    }

    // Add to accumulator (clamped to prevent spiral of death)
    this.accumulator += Math.min(frameTime, MAX_ACCUMULATOR);

    // Fixed timestep updates
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    // Render
    this.render();

    // Continue loop
    requestAnimationFrame((time) => this.loop(time));
  }
}

// Initialize and start the application
const app = new App();
app.init();
