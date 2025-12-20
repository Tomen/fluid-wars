# Fluid Wars Game Balance Guide

This document describes all tunable parameters, how they interact, and how to adjust them for different gameplay experiences.

---

## Design Goals

### Match Feel
- **Duration:** 1-3 minutes (medium pace)
- **Battle dynamics:** Back-and-forth, positioning determines strengths/weaknesses
- **Skill expression:** Small mistakes shouldn't cost everything; sustained pressure wins

### Winning Strategies
- **Surround and conquer:** Flanking and dividing enemy forces should be rewarded
- **Break and isolate:** Breaking through to separate enemy clusters → surround the fragment
- **Positional play:** Obstacles and territory create tactical opportunities

### Anti-Patterns (should NOT work)
- **Corner camping:** Sitting in a corner should NOT be viable
- **Pure defense:** Waiting out the enemy should lose to active play
- **Frontal assault only:** Direct opposition should grind to halt (incentivizes flanking)

---

## Parameter Reference

### Particle Movement

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `acceleration` | particle.acceleration | 200 | Units/sec² - how fast particles accelerate toward cursor |
| `maxVelocity` | particle.maxVelocity | 300 | Units/sec - maximum particle speed |
| `friction` | particle.friction | 0.98 | Per-frame multiplier - velocity decay (0.98 = 2% loss/frame) |
| `radius` | particle.radius | 8 | Pixels - visual and collision size |
| `spawnRadius` | particle.spawnRadius | 150 | Pixels - area around cursor where particles spawn |

### Particle Repulsion

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `repulsionRadius` | particle.repulsionRadius | 24 | Pixels - distance at which particles repel |
| `repulsionStrength` | particle.repulsionStrength | 2000 | Force units - base repulsion force |
| `enemyRepulsionMultiplier` | particle.enemyRepulsionMultiplier | 8.0 | Multiplier for enemy-to-enemy repulsion |

### Conversion System

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `radius` | conversion.radius | 45 | Pixels - distance at which particles count for conversion |
| `rate` | conversion.rate | 2.0 | Progress/sec when outnumbered |
| `threshold` | conversion.threshold | 1.0 | Progress required to convert |
| `decayMultiplier` | conversion.decayMultiplier | 2.0 | Decay speed multiplier when not outnumbered |
| `friendlySupportFactor` | conversion.friendlySupportFactor | 0.7 | How much friends help defend (1.0=full, 0.5=half) |

### Obstacles

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `bounceEnergyLoss` | obstacle.bounceEnergyLoss | 0.7 | Energy retained after wall bounce (higher = less stuck) |
| `playerMargin` | obstacle.playerMargin | 150 | Pixels - keep obstacles away from spawn points |

---

## Key Interactions

### 1. Enemy Repulsion vs Conversion Radius

The `enemyRepulsionMultiplier` and `conversion.radius` create a tension:
- High enemy repulsion (8x) spreads attackers apart
- Conversion requires enemies within the radius to outnumber defenders
- **Result:** Attackers spread out before they can effectively outnumber

```
repulsionRadius / conversionRadius = 24 / 45 = 0.53
```
✅ Good: Conversion zone (45px) is larger than repulsion zone (24px)

### 2. Defender Advantage Stack

Multiple parameters compound to favor defenders:

| Parameter | Defender Bonus |
|-----------|----------------|
| `friendlySupportFactor` = 0.7 | 30% numerical advantage |
| `decayMultiplier` = 2.0 | 2x faster recovery |
| Wall compression | Density advantage in corners |
| Enemy repulsion | Spreads attackers |

**Problem:** These compound, making defended positions (especially corners) hard to break.

### 3. Conversion Time vs Movement

```
Conversion time = threshold / rate = 1.0 / 2.0 = 0.5 seconds
Escape distance = maxVelocity × time = 300 × 0.5 = 150 pixels
```

A particle can move 150px during the time it takes to convert. Since conversion radius is only 45px, particles can escape if they move away.

---

## Dimensionless Balance Ratios

These ratios determine gameplay dynamics independent of absolute values:

### Ratio 1: Repulsion Reach
```
repulsionRadius / conversionRadius = 24 / 45 = 0.53
```
- If > 1: Particles repel before conversion can happen (bad)
- If < 1: Conversion zone extends beyond repulsion (good) ✅

### Ratio 2: Enemy Cluster Density
```
enemyRepulsionMultiplier × repulsionStrength / acceleration = 8 × 2000 / 200 = 80
```
- Higher = enemies spread more, harder to cluster for attack
- Lower = enemies cluster tighter, easier mass attacks

### Ratio 3: Defender Effectiveness
```
1 / friendlySupportFactor = 1 / 0.7 = 1.43
```
- Attackers need 43% more particles to overcome defenders
- Combined with wall compression: even stronger in corners

### Ratio 4: Conversion vs Escape
```
(threshold / rate) × maxVelocity / conversionRadius = 0.5 × 300 / 45 = 3.33
```
- If > 1: Escape is easy
- If < 1: Once caught, conversion is likely

### Ratio 5: Recovery Speed
```
decayMultiplier = 2.0
```
- Defenders recover 2x faster than attackers build progress

---

## Tuning Guide

### Making Attacks Stronger

To break through defensive positions more easily:

| Change | Effect |
|--------|--------|
| Reduce `friendlySupportFactor` (0.7 → 0.5) | Defenders need more allies to resist |
| Increase `conversion.rate` (2.0 → 3.0) | Faster conversion when outnumbering |
| Reduce `enemyRepulsionMultiplier` (8.0 → 4.0) | Attackers cluster tighter |
| Reduce `decayMultiplier` (2.0 → 1.0) | Slower defender recovery |

### Making Defense Stronger

To make holding positions more viable:

| Change | Effect |
|--------|--------|
| Increase `friendlySupportFactor` (0.7 → 0.9) | Fewer allies needed to defend |
| Increase `decayMultiplier` (2.0 → 3.0) | Faster recovery when not outnumbered |
| Reduce `conversion.radius` (45 → 35) | Smaller threat zone |
| Increase `enemyRepulsionMultiplier` (8.0 → 10.0) | Push attackers apart more |

### Faster Gameplay

For quicker, more decisive matches:

| Change | Effect |
|--------|--------|
| Increase `maxVelocity` and `acceleration` | Faster movement |
| Increase `conversion.rate` | Quicker captures |
| Reduce `conversion.threshold` | Less time to convert |

### Slower, Strategic Gameplay

For longer, more tactical matches:

| Change | Effect |
|--------|--------|
| Reduce velocities | Slower movement, more planning |
| Increase `conversion.threshold` | Takes longer to capture |
| Increase `conversion.radius` | More group coordination required |

---

## Known Balance Issues

### Corner Camping

**Problem:** Particles camping in corners are too hard to convert.

**Why it happens:**
1. Walls provide natural flank protection (attacked from 2 sides instead of 4)
2. Wall compression makes defender particles denser
3. Enemy repulsion (8x) spreads attackers, preventing outnumbering
4. `friendlySupportFactor` (0.7) compounds the defender advantage

**Potential fixes to test:**

| Approach | Mechanism | Trade-offs |
|----------|-----------|------------|
| Lower enemy repulsion (8x→4x) | Attackers cluster tighter | May make battles chaotic |
| Wall proximity penalty | Easier to convert near walls | Adds complexity |
| Encirclement bonus | Faster conversion from multiple angles | Complex to implement |
| Movement requirement | Static particles easier to convert | May cause jittery behavior |
| Larger conversion radius | More particles count | Changes battle feel |
| Lower friendlySupportFactor (0.7→0.5) | Defenders weaker | May swing too far |

---

## Runtime Debugging

The `BALANCE_RATIOS` export in `src/config.ts` provides computed ratios for runtime inspection:

```typescript
import { BALANCE_RATIOS } from './config';

console.log(BALANCE_RATIOS);
// {
//   repulsionReach: 0.53,
//   defenderAdvantage: 1.43,
//   conversionTime: 0.5,
//   escapeRatio: 3.33,
//   recoverySpeed: 2.0
// }
```

Use these to verify balance after parameter changes.
