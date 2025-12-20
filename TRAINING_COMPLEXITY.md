# Training Complexity

This document explains the factors that determine computational cost of NEAT neuroevolution training runs.

## Per-Generation Cost

| Factor | Config Path | Default | Impact |
|--------|-------------|---------|--------|
| Population size | `training.trainer.populationSize` | 10 | Genomes to evaluate per generation |
| Matches per genome | `training.evaluator.matchesPerGenome` | 1 | Games each genome plays for fitness |
| Max game steps | `training.evaluator.maxGameSteps` | 3600 | Steps per game (~60 sec at 60 FPS) |

**Steps per generation** = `populationSize` × `matchesPerGenome` × `maxGameSteps`

Default: 10 × 1 × 3600 = **36,000 game steps/generation**

## Per-Step Cost

| Factor | Config Path | Default | Impact |
|--------|-------------|---------|--------|
| Particles per player | `training.simulator.particlesPerPlayer` | 250 | Physics calculations scale with particle count |
| Player count | `training.simulator.playerCount` | 4 | Total particles = players × particlesPerPlayer |
| Canvas size | `training.simulator.canvasWidth/Height` | 1200×800 | Minor impact (spatial hash mitigates) |

**Total particles** = `playerCount` × `particlesPerPlayer`

Default: 4 × 250 = **1,000 particles**

### Collision Complexity

Naive collision detection is O(n²), meaning 1,000 particles would require ~500,000 checks per step. The spatial hash grid reduces this significantly by only checking particles in nearby cells.

## Total Training Cost

| Factor | Config Path | Default | Impact |
|--------|-------------|---------|--------|
| Max generations | `training.trainer.maxGenerations` | 500 | Total generations to run |
| Worker count | `training.trainer.workerCount` | 0 (auto) | Parallelization across CPU cores |

**Total game steps** = `maxGenerations` × steps per generation

Default: 500 × 36,000 = **18,000,000 game steps**

## Biggest Cost Drivers

1. **Particle count** - Collision detection dominates step cost
2. **Steps per generation** - `population × matches × maxSteps`
3. **Total generations** - Linear scaling with training duration

## Optimization Strategies

### Faster Training (Lower Quality)

```yaml
training:
  trainer:
    populationSize: 10
    maxGenerations: 100
  evaluator:
    matchesPerGenome: 1
    maxGameSteps: 1800      # 30-second games
  simulator:
    particlesPerPlayer: 100  # Fewer particles
```

### Higher Quality (Slower)

```yaml
training:
  trainer:
    populationSize: 50
    maxGenerations: 1000
  evaluator:
    matchesPerGenome: 3      # More consistent fitness
    maxGameSteps: 3600
  simulator:
    particlesPerPlayer: 250
```

## Parallelization

Worker threads distribute genome evaluations across CPU cores. With `workerCount: 0`, the system auto-detects available cores.

**Speedup** = min(`workerCount`, `populationSize`)

A population of 10 with 8 CPU cores achieves ~8x speedup. Increasing population size beyond worker count improves parallelization efficiency.
