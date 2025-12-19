# Fluid Wars - Game Specification

## Overview

A real-time particle-based territory control game where 2-8 players (human or AI) compete to convert all particles to their color. Players control a cursor that attracts their particles, using strategic positioning and obstacle navigation to surround and overwhelm opponents.

## Core Concepts

### Particles
- Small circular entities, each belonging to one player (identified by color)
- Total particle count: ~500-1000 (configurable per map)
- All particles exist from game start; none are created or destroyed, only converted
- Each particle has: position (x, y), velocity (vx, vy), color/owner

### Cursors
- Each player has one cursor they control
- The cursor acts as an attractor - particles owned by that player accelerate toward it
- Cursors can move freely, including through obstacles and other particles

### Obstacles
- Static shapes (rectangles, circles) placed on the map
- Particles cannot pass through obstacles; they slide along edges
- Cursors CAN pass through obstacles
- Create choke points and strategic terrain

---

## Particle Physics

### Movement Toward Cursor
```
Each frame, for each particle:
1. Calculate direction vector from particle to its owner's cursor
2. Apply acceleration in that direction (acceleration = constant, e.g., 200 units/sec²)
3. Apply velocity to position
4. Apply friction/drag (velocity *= 0.98 per frame)
5. Cap maximum velocity (e.g., 150 units/sec)
```

Particles do NOT pathfind. They accelerate directly toward the cursor. If an obstacle is in the way, they collide and slide along it.

### Collision with Obstacles
- Particles bounce/slide off obstacles
- Simple collision response: push particle out of obstacle, reflect velocity component that points into obstacle
- Some energy loss on collision (velocity *= 0.8 on bounce)

### Particle-Particle Interaction
- Particles have a small radius (e.g., 4px)
- Particles softly repel each other to prevent stacking (soft-body, not rigid)
- Repulsion force: gentle push away when overlapping, proportional to overlap distance

---

## Conversion Mechanic

When particles of different colors are near each other:

```
For each particle A:
  For each nearby particle B (within conversion_radius, e.g., 20px):
    If A.owner != B.owner:
      Calculate conversion_chance based on:
        - Distance: closer = higher chance
        - Direction: if A is moving TOWARD B, higher chance for A to convert B
        - Relative velocity: if A is moving faster toward B than B toward A, A has advantage
      
      conversion_score_A = dot(A.velocity, normalize(B.position - A.position))
      conversion_score_B = dot(B.velocity, normalize(A.position - B.position))
      
      If conversion_score_A > conversion_score_B:
        # A has advantage, chance to convert B
        advantage = conversion_score_A - conversion_score_B
        chance = base_chance * (advantage / max_velocity) * (1 - distance/conversion_radius)
        if random() < chance * dt:
          B.owner = A.owner
          B.color = A.color
      # (and vice versa for B converting A)
```

**Key behaviors this creates:**
- Head-to-head collisions: roughly equal forces, low conversion (stalemate)
- Flanking: attacking from the side where enemy isn't pushing back = high conversion
- Surrounding: multiple particles pushing from different angles overwhelm defense
- Momentum matters: fast-moving particles convert better than stationary ones

---

## Players and Controls

### Human Controls
| Player | Movement | Color |
|--------|----------|-------|
| 1 | WASD | Blue |
| 2 | Arrow Keys | Red |
| 3 | IJKL | Green |
| 4 | Numpad 8456 | Yellow |
| 5-8 | AI only or gamepad | Purple, Orange, Cyan, Pink |

Cursor movement speed: 300 units/sec (configurable)

### AI Players
Simple but effective AI behavior:

```
AI Decision Loop (every 0.5 seconds):
1. Find the nearest cluster of enemy particles
2. Find own nearest cluster of particles
3. Calculate strategic position:
   - Generally: position cursor BEHIND enemy cluster (relative to their cursor)
   - This naturally creates flanking/surrounding behavior
4. Occasionally (20% chance): target weakly defended areas
5. Move cursor toward target position
```

AI difficulty levels:
- Easy: Slow reaction, sometimes moves randomly
- Medium: Standard behavior above
- Hard: Faster updates, better target selection, predicts enemy movement

---

## Game Flow

### Main Menu
```
FLUID WARS

[Quick Play - 2 Players]
[Custom Game]
[Level Editor]
[How to Play]
```

### Custom Game Setup
```
Number of Players: [2] [3] [4] [5] [6] [7] [8]

Player 1: [Human v] Color: Blue
Player 2: [Human v] Color: Red  
Player 3: [AI Medium v] Color: Green
...

Map: [Default] [Maze] [Arena] [Channels] [Custom...]

Particle Count: [500] [750] [1000]

[Start Game]
```

### In-Game UI
- Top bar: percentage control for each player (colored bars)
- Player cursors: visible as a ring/crosshair in player color
- Particle count per player (optional, small text)
- Pause menu: Resume, Restart, Quit to Menu

### Win Condition
- A player wins when they control ≥99% of all particles
- Display "PLAYER X WINS!" with celebration effect
- Options: Play Again, Back to Menu

---

## Maps

### Default Maps

**1. Open Arena**
- Simple rectangular map with no obstacles
- Good for learning mechanics

**2. Four Corners**
- Large obstacle in center
- Players start in corners
- Forces flanking around center

**3. Maze**
- Multiple corridor-like paths
- Rewards strategic cursor placement

**4. Channels**
- Horizontal channels separated by walls with gaps
- Creates lanes of combat

**5. Pillars**
- Scattered circular obstacles
- Open but with cover options

### Map Data Structure
```javascript
{
  name: "Four Corners",
  width: 1200,
  height: 800,
  obstacles: [
    { type: "rect", x: 500, y: 300, width: 200, height: 200 },
    { type: "circle", x: 600, y: 400, radius: 100 }
  ],
  spawnPoints: [
    { x: 100, y: 100 },   // Player 1
    { x: 1100, y: 100 },  // Player 2
    { x: 100, y: 700 },   // Player 3
    { x: 1100, y: 700 },  // Player 4
    // ... up to 8
  ],
  particlesPerPlayer: 100  // Override default if specified
}
```

---

## Level Editor

### Features
- Click and drag to place rectangular obstacles
- Hold Shift + drag for circular obstacles
- Click obstacle to select, Delete to remove
- Drag spawn point markers (P1, P2, etc.) to reposition
- Save/Load maps to localStorage
- Test Play button

### UI
```
[File: New | Save | Load]  [Obstacle: Rect | Circle]  [Test Play]

+--------------------------------------------------+
|                                                  |
|   P1                                       P2    |
|       +-------+                                  |
|       |       |                                  |
|       +-------+                                  |
|                           O                      |
|   P3                                       P4    |
|                                                  |
+--------------------------------------------------+

Map Name: [________________]
```

---

## Technical Implementation

### Recommended Stack
- Vanilla JavaScript + HTML5 Canvas
- Single HTML file (or simple module structure)
- 60 FPS game loop using requestAnimationFrame

### Performance Considerations
- Use spatial hashing for particle-particle collision detection
- Grid cells ~50px, only check particles in same/adjacent cells
- Conversion checks only between nearby particles (same optimization)

### Code Structure
```
/fluid-wars
  index.html
  /js
    game.js        - Main game loop, state management
    particle.js    - Particle class and physics
    player.js      - Player/cursor management, AI
    collision.js   - Spatial hashing, collision detection
    map.js         - Obstacle and map management
    renderer.js    - Canvas drawing
    ui.js          - Menus, HUD
    editor.js      - Level editor
  /css
    style.css
  /maps
    default-maps.json
```

### Key Classes

```javascript
class Particle {
  constructor(x, y, owner)
  update(dt, cursor, obstacles, spatialHash)
  draw(ctx)
}

class Player {
  constructor(id, color, isAI, aiDifficulty)
  updateCursor(input, dt)  // or AI decision
  getCursorPosition()
}

class Game {
  constructor(config)
  start()
  update(dt)
  render()
  checkWinCondition()
}

class SpatialHash {
  constructor(cellSize)
  clear()
  insert(particle)
  getNearby(x, y, radius)
}
```

---

## Visual Style

### Aesthetic
- Dark background (near-black or dark blue)
- Particles as soft glowing circles with slight bloom
- Trails optional (short fade behind particles)
- Cursors as pulsing rings
- Obstacles as solid dark shapes with subtle border

### Colors (Distinct and Visible)
```javascript
const PLAYER_COLORS = [
  '#4488ff', // Blue
  '#ff4444', // Red
  '#44ff44', // Green
  '#ffff44', // Yellow
  '#ff44ff', // Purple
  '#ff8844', // Orange
  '#44ffff', // Cyan
  '#ff88aa', // Pink
];
```

---

## Stretch Goals (If Time Permits)

1. **Power-ups**: Spawn occasionally, grant temporary buffs (speed boost, conversion resistance, etc.)
2. **Team Mode**: 2v2, 3v3, 4v4
3. **King of the Hill**: Control a central zone instead of all particles
4. **Online Multiplayer**: WebSocket-based (significant scope increase)
5. **Sound Effects**: Ambient particle hum, conversion sounds, victory fanfare
6. **Particle Effects**: Explosions on mass conversions, cursor trails

---

## Summary

Build order recommendation:
1. Basic canvas with particles moving toward mouse cursor
2. Add obstacles with collision
3. Add second player with keyboard controls
4. Implement conversion mechanic
5. Add win condition and basic UI
6. Add AI players
7. Add menus and game flow
8. Add map selection
9. Add level editor
10. Polish and balance
