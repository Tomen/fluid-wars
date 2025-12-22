// Shared TypeScript types and interfaces for Fluid Wars

// Basic vector type
export interface Vec2 {
  x: number;
  y: number;
}

// Application states
export type AppState = 'menu' | 'setup' | 'playing' | 'paused' | 'gameover' | 'editor' | 'observing';

// Game configuration
export interface GameConfig {
  playerCount: number;
  mapName?: string;
  particlesPerPlayer: number;
}

// Win condition configuration
export interface WinConfig {
  mode: 'elimination' | 'percentage';
  eliminationThreshold: number;
  percentageThreshold: number;
}

// Obstacle types
export type ObstacleType = 'rect' | 'circle';

export interface RectObstacle {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleObstacle {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
}

export type ObstacleData = RectObstacle | CircleObstacle;

// Input key bindings
export interface KeyBinding {
  up: string;
  down: string;
  left: string;
  right: string;
}

// Player colors (readonly array)
export const PLAYER_COLORS: readonly string[] = [
  '#4488ff', // Blue
  '#ff4444', // Red
  '#44ff44', // Green
  '#ffff44', // Yellow
  '#ff44ff', // Purple
  '#ff8844', // Orange
  '#44ffff', // Cyan
  '#ff88aa', // Pink
] as const;

// Player color names (for display)
export const PLAYER_COLOR_NAMES: readonly string[] = [
  'Blue',
  'Red',
  'Green',
  'Yellow',
  'Purple',
  'Orange',
  'Cyan',
  'Pink',
] as const;
