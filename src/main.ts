// Fluid Wars - Main Application Entry Point

import type { AppState, GameConfig } from './types';
import { Game } from './game';
import { Renderer } from './renderer';
import { GAME_CONFIG, GAME_LOOP_CONFIG } from './config';

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

    // Create game with config
    const config: GameConfig = {
      playerCount: GAME_CONFIG.playerCount,
      particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
    };

    this.game = new Game(config, this.renderer.width, this.renderer.height);

    // Setup restart key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.state === 'gameover') {
          this.restartGame();
        }
      }
    });

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

          // Check for game over
          if (this.game.isGameOver()) {
            this.setState('gameover');
          }
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
      case 'gameover':
        if (this.game) {
          // Draw obstacles first (behind particles)
          this.renderer.drawObstacles(this.game.getObstacles());
          // Draw particles with conversion progress
          const conversionProgress = this.game.getConversionProgressMap();
          const convertingColors = this.game.getConvertingPlayerColorMap();
          this.renderer.drawParticles(this.game.getParticles(), conversionProgress, convertingColors);
          // Draw player cursors on top
          this.renderer.drawPlayers(this.game.getPlayers());

          // Draw victory screen overlay if game over
          if (this.state === 'gameover') {
            this.renderVictoryScreen();
          }
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

  renderVictoryScreen(): void {
    if (!this.game) return;

    const winner = this.game.getWinnerPlayer();
    if (!winner) return;

    const ctx = this.renderer.ctx;
    const centerX = this.renderer.width / 2;
    const centerY = this.renderer.height / 2;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

    // Draw victory message
    ctx.fillStyle = winner.color;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VICTORY!', centerX, centerY - 80);

    // Draw player info
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px sans-serif';
    const playerKeys = winner.id === 0 ? 'WASD' : 'Arrows';
    ctx.fillText(`Player ${winner.id + 1} (${playerKeys}) Wins!`, centerX, centerY);

    // Draw particle count
    ctx.font = '24px sans-serif';
    ctx.fillText(`${winner.particleCount} particles remaining`, centerX, centerY + 50);

    // Draw restart instruction
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px sans-serif';
    ctx.fillText('Press R to restart', centerX, centerY + 120);
  }

  restartGame(): void {
    console.log('Restarting game...');

    // Destroy old game
    if (this.game) {
      this.game.destroy();
    }

    // Create new game with same config
    const config: GameConfig = {
      playerCount: GAME_CONFIG.playerCount,
      particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
    };

    this.game = new Game(config, this.renderer.width, this.renderer.height);

    // Reset state
    this.setState('playing');

    console.log('Game restarted');
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
    this.accumulator += Math.min(frameTime, GAME_LOOP_CONFIG.maxAccumulator);

    // Fixed timestep updates
    while (this.accumulator >= GAME_LOOP_CONFIG.fixedDt) {
      this.update(GAME_LOOP_CONFIG.fixedDt);
      this.accumulator -= GAME_LOOP_CONFIG.fixedDt;
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
