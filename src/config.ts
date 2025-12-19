// Centralized game configuration

/**
 * GAME SETUP
 */
export const GAME_CONFIG = {
  playerCount: 2,
  particlesPerPlayer: 200,
  canvasWidth: 1200,
  canvasHeight: 800,
} as const;

/**
 * PARTICLE PHYSICS
 */
export const PARTICLE_CONFIG = {
  // Movement
  acceleration: 200, // units/sec² - how fast particles accelerate toward cursor
  maxVelocity: 150, // units/sec - maximum particle speed
  friction: 0.98, // per frame - velocity decay (0.98 = 2% loss per frame)

  // Size
  radius: 4, // pixels - visual size of particles

  // Collision and Repulsion
  repulsionRadius: 16, // pixels - distance at which particles repel each other
  repulsionStrength: 180, // force units - base repulsion force
  enemyRepulsionMultiplier: 3.0, // multiplier - extra repulsion between enemy particles

  // Spawn
  spawnRadius: 150, // pixels - radius around player cursor where particles spawn
} as const;

/**
 * CONVERSION SYSTEM
 */
export const CONVERSION_CONFIG = {
  radius: 20, // pixels - distance at which conversion can occur
  rate: 1.0, // progress/sec - how fast conversion builds up when outnumbered
  threshold: 1.0, // progress required to convert (1.0 = ~3.3 seconds at 0.3 rate)
  decayMultiplier: 2, // decay rate multiplier when not being converted
} as const;

/**
 * PLAYER CONTROLS
 */
export const PLAYER_CONFIG = {
  cursorSpeed: 300, // units/sec - how fast cursors move with keyboard
  cursorRadius: 8, // pixels - visual size of cursor
} as const;

/**
 * SPATIAL HASH (Performance)
 */
export const SPATIAL_CONFIG = {
  cellSize: 50, // pixels - size of spatial hash grid cells (should be >= max interaction distance)
} as const;

/**
 * OBSTACLES / MAZE
 */
export const OBSTACLE_CONFIG = {
  size: 40, // pixels - width/height of obstacle squares
  gridSpacing: 100, // pixels - distance between obstacle centers
  margin: 100, // pixels - margin from canvas edges
  bounceEnergyLoss: 0.5, // multiplier - energy retained after bouncing off obstacles
} as const;

/**
 * GAME LOOP
 */
export const GAME_LOOP_CONFIG = {
  fixedDt: 1 / 60, // seconds - physics timestep (60 FPS)
  maxAccumulator: 0.1, // seconds - prevent spiral of death
} as const;

/**
 * WIN CONDITION
 */
export const WIN_CONFIG = {
  mode: 'elimination' as 'elimination' | 'percentage', // 'elimination' = opponent loses all particles, 'percentage' = control X% of all particles
  eliminationThreshold: 0, // particles - opponent must have this many or fewer to lose (0 = complete elimination)
  percentageThreshold: 0.9, // ratio - control this percentage of all particles to win (only for 'percentage' mode)
} as const;

/**
 * RENDERING
 */
export const RENDER_CONFIG = {
  backgroundColor: '#0a0a0f',
} as const;
