# Fluid Wars

A particle-based territory control game where players compete to convert enemy particles using cursor-based attraction mechanics.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 to play.

## Game Rules

- Each player controls a cursor that attracts their particles
- Particles follow their owner's cursor while repelling enemy particles
- When a particle is surrounded by more enemies than allies, it begins converting
- Win by controlling 80% of all particles

## Controls

| Player | Controls |
|--------|----------|
| Player 1 | WASD |
| Player 2+ | AI (or Arrow keys if AI disabled) |

Press **R** to restart after game over.

## Configuration

All settings are in `config.yaml`:

```yaml
game:
  playerCount: 4
  particlesPerPlayer: 200

ai:
  enabled: true
  aiPlayers: [1, 2, 3]        # 0-indexed player IDs
  defaultAIType: aggressive   # random, aggressive, or neural

win:
  mode: percentage
  percentageThreshold: 0.8
```

See [AI.md](AI.md) for AI training and neural network documentation.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run train` | Train neural network AI |

## Project Structure

```
config.yaml           # Game and training settings
src/
├── game.ts           # Core game logic
├── particle.ts       # Particle physics
├── conversion.ts     # Conversion mechanics
├── ai/               # AI controllers
└── main.ts           # Browser entry point
training/
└── train.ts          # AI training script
```

## Tech Stack

- TypeScript
- Vite
- Canvas API
- neataptic (NEAT neuroevolution)
