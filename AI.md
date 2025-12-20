# Fluid Wars AI System

This document covers the AI opponent system, including built-in heuristic AIs and the NEAT neuroevolution training pipeline.

## Quick Reference

```bash
# Run with AI opponents (default)
npm run dev

# Train neural network AI
npm run train

# Verify training compiles
npm run train:check
```

## AI Types

| Type | Description | Use Case |
|------|-------------|----------|
| `random` | Moves cursor randomly | Baseline testing |
| `aggressive` | Targets center of all enemy particles | Default opponent |
| `neural` | Trained NEAT neural network | Competitive play |

## Configuration

AI settings in `config.yaml`:

```yaml
ai:
  enabled: true              # Enable AI opponents
  aiPlayers: [1, 2, 3]       # Player indices to control (0-indexed)
  defaultAIType: aggressive  # 'random', 'aggressive', or 'neural'
  neuralDifficulty: medium   # 'easy', 'medium', 'hard', 'expert'
  useWebWorker: true         # Run neural AI in Web Worker (non-blocking)
```

### Web Worker Mode

When `useWebWorker: true`, neural AI runs in a separate thread using TensorFlow.js WASM backend:

- **Non-blocking**: Main game loop never waits for AI computation
- **Async**: AI returns cached action immediately, computes new action in background
- **1-2 frame latency**: Imperceptible delay between game state and AI decision

Worker stats are shown in the Performance panel when enabled.

### Examples

**1v1 Human vs AI:**
```yaml
game:
  playerCount: 2

ai:
  enabled: true
  aiPlayers: [1]
  defaultAIType: aggressive
```

**Human vs 3 Neural AIs:**
```yaml
game:
  playerCount: 4

ai:
  enabled: true
  aiPlayers: [1, 2, 3]
  defaultAIType: neural
  neuralDifficulty: hard
```

**All Human (local multiplayer):**
```yaml
ai:
  enabled: false
```

---

## Neural Network Training

The training system uses NEAT (NeuroEvolution of Augmenting Topologies) to evolve neural networks through self-play.

### How It Works

1. **Population**: 100 neural networks (genomes) start with random weights
2. **Evaluation**: Each genome plays matches against other genomes
3. **Fitness**: Score based on wins, particle advantage, and survival time
4. **Evolution**: Top performers breed, mutate, and create next generation
5. **Checkpoints**: Models saved at generation milestones as difficulty tiers

### Running Training

```bash
npm run train
```

Training runs in Node.js with headless game simulation (no rendering). Progress is logged to console:

```
Gen 0: Best=42.50, Avg=12.30, Time=1523ms
Gen 1: Best=45.00, Avg=15.80, Time=1456ms
...
```

### Training Configuration

All training parameters are in `config.yaml`:

```yaml
training:
  trainer:
    populationSize: 100      # Genomes per generation
    maxGenerations: 500      # Total generations to train
    elitism: 10              # Top genomes kept unchanged
    mutationRate: 0.3        # Probability of mutation
    mutationAmount: 1        # Mutations per genome
    checkpointInterval: 25   # Generations between saves
    verbose: true            # Log progress

  evaluator:
    matchesPerGenome: 5      # Matches per fitness evaluation
    maxGameSteps: 3000       # Max steps per match (~50 seconds)
    winReward: 100           # Points for winning
    loseReward: -50          # Points for losing
    drawReward: 0            # Points for draw/timeout
    particleAdvantageMultiplier: 10  # Bonus per particle advantage

  simulator:
    playerCount: 2           # Players per training match
    particlesPerPlayer: 100  # Reduced for speed
    canvasWidth: 800
    canvasHeight: 600

  difficultyTiers:           # When to save difficulty models
    easy: 25
    medium: 100
    hard: 250
    expert: 500
```

### Output Files

Models are saved to `public/models/` for browser access:

| Difficulty | Generation | File |
|------------|------------|------|
| Easy | 25 | `ai_easy.json` |
| Medium | 100 | `ai_medium.json` |
| Hard | 250 | `ai_hard.json` |
| Expert | 500 | `ai_expert.json` |

Checkpoints are saved to `training/checkpoints/` for resuming training.

### Resuming Training

Training automatically resumes from the latest checkpoint. To start fresh, delete the `training/checkpoints/` directory.

### Using Trained Models

After training completes, update `config.yaml` to use neural AI:

```yaml
ai:
  defaultAIType: neural
  neuralDifficulty: medium  # or easy, hard, expert
```

---

## Architecture

### Observation Space

The neural network receives a 1606-dimensional input vector:

| Component | Size | Description |
|-----------|------|-------------|
| Grid | 1600 | 16x20 cells x 5 channels |
| Cursors | 4 | 2 players x 2 coordinates (normalized) |
| Counts | 2 | Particle counts per player (normalized) |

**Grid Channels:**
1. Friendly particle density (0-1)
2. Enemy particle density (0-1)
3. Obstacle presence (0 or 1)
4. Friendly particle velocity magnitude
5. Enemy particle velocity magnitude

### Action Space

The network outputs 2 values:
- `targetX`: Cursor X position (0-1, normalized)
- `targetY`: Cursor Y position (0-1, normalized)

### File Structure

```
src/
├── ai/
│   ├── AIController.ts      # Base interface + RandomAI, AggressiveAI
│   ├── NeuralAI.ts          # Neural network wrapper (blocking)
│   ├── AsyncNeuralAI.ts     # Web Worker wrapper (non-blocking)
│   ├── ai-worker.ts         # Web Worker with WASM TensorFlow.js
│   ├── ModelLoader.ts       # Browser model loading + caching
│   └── ObservationEncoder.ts # Game state -> neural input
├── core/
│   ├── AIInterface.ts       # Types: GameState, AIAction, etc.
│   └── GameSimulator.ts     # Headless game for training
└── training/
    ├── NEATTrainer.ts       # NEAT evolution loop
    └── FitnessEvaluator.ts  # Match-based fitness scoring

training/
├── train.ts                 # Node.js entry point
├── config.ts                # Reads config.yaml
└── checkpoints/             # Saved training state

public/
├── models/                  # Exported models for browser
└── tfjs-wasm/               # TensorFlow.js WASM binaries
```

---

## Creating Custom AI

Implement the `AIController` interface:

```typescript
import type { AIController } from './ai/AIController';
import type { AIAction } from './core/AIInterface';
import type { Game } from './game';

export class MyCustomAI implements AIController {
  readonly playerId: number;

  constructor(playerId: number) {
    this.playerId = playerId;
  }

  getName(): string {
    return 'MyCustomAI';
  }

  getAction(game: Game): AIAction {
    const particles = game.getParticles();
    const { width, height } = game.getCanvasSize();

    // Your logic here...

    return {
      targetX: 0.5,  // Normalized 0-1
      targetY: 0.5,
    };
  }

  reset(): void {
    // Reset any internal state
  }
}
```

Register in `main.ts`:

```typescript
import { MyCustomAI } from './ai/MyCustomAI';

// In setupAIControllers():
controller = new MyCustomAI(playerId);
```

---

## Performance Tips

### Training Speed

- Reduce `particlesPerPlayer` in training simulator config
- Reduce `maxGameSteps` for faster matches
- Increase `populationSize` for better exploration (but slower)

### Browser Performance

- Neural AI is lightweight (~1ms per decision)
- Model files are small (~50-100KB JSON)
- Models are cached after first load

### Debugging

Check browser console for AI initialization:
```
Player 2: Aggressive AI
Player 3: Aggressive AI
Player 4: Aggressive AI
```

For neural AI:
```
Loaded AI model: medium
Player 2: Neural AI (medium)
```
