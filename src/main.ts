// Fluid Wars - Main Application Entry Point

import type { AppState, GameConfig } from './types';
import { Game } from './game';
import { Renderer } from './renderer';

// Constants
const FIXED_DT = 1 / 60; // 60 FPS physics
const MAX_ACCUMULATOR = 0.1; // Prevent spiral of death

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
  private game: Game | null = null;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }

    // Create renderer
    this.renderer = new Renderer(this.canvas);

    // Create game with 2 players
    const config: GameConfig = {
      playerCount: 2,
      particlesPerPlayer: 1250
    };

    this.game = new Game(config, this.renderer.width, this.renderer.height);

    console.log('Fluid Wars initialized');
    console.log(`Canvas size: ${this.renderer.width}x${this.renderer.height}`);
  }

  init(): void {
    // Start the game loop
    requestAnimationFrame((time) => this.loop(time));
  }

  setState(newState: AppState, _config?: GameConfig): void {
    console.log(`State transition: ${this.state} -> ${newState}`);
    this.state = newState;
  }

  update(dt: number): void {
    switch (this.state) {
      case 'playing':
        // Update game
        if (this.game) {
          this.game.update(dt);
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
        if (this.game) {
          // Draw obstacles first (behind particles)
          this.renderer.drawObstacles(this.game.getObstacles());
          // Draw particles with conversion progress
          const conversionProgress = this.game.getConversionProgressMap();
          const convertingColors = this.game.getConvertingPlayerColorMap();
          this.renderer.drawParticles(this.game.getParticles(), conversionProgress, convertingColors);
          // Draw player cursors on top
          this.renderer.drawPlayers(this.game.getPlayers());
        }
        break;
    }

    // Draw debug info
    if (this.game) {
      const players = this.game.getPlayers();
      const particleCount = this.game.getParticles().length;
      const obstacleCount = this.game.getObstacles().length;
      const spatialStats = this.game.getSpatialHashStats();

      this.renderer.drawDebugText(`FPS: ${this.fps.toFixed(1)} | Particles: ${particleCount} | Obstacles: ${obstacleCount} | Grid Cells: ${spatialStats.cellCount}`, 10, 20);

      // Show player info
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const keys = i === 0 ? 'WASD' : 'Arrows';
        this.renderer.drawDebugText(
          `P${i + 1} (${keys}): ${player.particleCount} particles | Cursor: (${Math.floor(player.cursorX)}, ${Math.floor(player.cursorY)})`,
          10,
          40 + i * 20
        );
      }
    }
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
