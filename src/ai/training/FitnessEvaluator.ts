// FitnessEvaluator - Evaluate model fitness through multi-player matches

import * as tf from '@tensorflow/tfjs';
import { GameSimulator } from '../../core/GameSimulator';
import type { SimulatorConfig, AIAction } from '../../core/AIInterface';
import { NeuralAI } from '../NeuralAI';
import type { EncoderConfig } from '../ObservationEncoder';

/**
 * Configuration for fitness evaluation
 */
export interface EvaluatorConfig {
  /** Number of matches to play per evaluation */
  matchesPerEvaluation: number;

  /** Maximum steps per match */
  maxStepsPerMatch: number;

  /** Steps per second (for calculating time bonus) */
  stepsPerSecond: number;

  /** Simulator configuration */
  simulatorConfig: Partial<SimulatorConfig>;

  /** Encoder configuration */
  encoderConfig: Partial<EncoderConfig>;
}

/**
 * Default evaluator configuration
 */
export const DEFAULT_EVALUATOR_CONFIG: EvaluatorConfig = {
  matchesPerEvaluation: 3,
  maxStepsPerMatch: 1800, // 30 seconds at 60 FPS
  stepsPerSecond: 60,
  simulatorConfig: {
    playerCount: 4,
    particlesPerPlayer: 100,
    maxSteps: 1800,
  },
  encoderConfig: {},
};

/**
 * Result of a single match
 */
export interface MatchResult {
  winner: number; // -1 for draw/timeout, or player ID
  steps: number;
  finalParticleCounts: number[];
  conversionsPerPlayer: number[]; // Total particles converted by each player
  scores: number[]; // Score for each player
  // Diagnostic data
  avgCursorTargets: [number, number][]; // Average cursor target per player
  cursorVariance: number[]; // How much each player's cursor moved (variance)
}

/**
 * Aggregate stats from all matches in a generation
 */
export interface GenerationMatchStats {
  totalMatches: number;
  winsByPlayer: number[]; // wins[i] = how many times player position i won
  timeouts: number;
  avgConversions: number[]; // Average conversions per player position
  avgCursorTargets: [number, number][]; // Average cursor targets per player position
  avgVariance: number[]; // Average variance per player position
}

/**
 * Detailed evaluation result for a genome
 */
export interface GenomeEvalResult {
  fitness: number;
  avgTarget: [number, number];
  avgVariance: number;
  totalConversions: number;
  wins: number;
  matches: number;
}

/**
 * Fitness evaluator for CNN models
 * Runs multi-player matches between models and computes fitness scores
 */
export class FitnessEvaluator {
  private config: EvaluatorConfig;
  private playerCount: number;
  private matchResults: MatchResult[] = []; // Collect all match results

  constructor(config: Partial<EvaluatorConfig> = {}) {
    this.config = { ...DEFAULT_EVALUATOR_CONFIG, ...config };
    this.playerCount = this.config.simulatorConfig.playerCount || 4;
  }

  /**
   * Clear collected match results (call before evaluating a new generation)
   */
  clearMatchResults(): void {
    this.matchResults = [];
  }

  /**
   * Get aggregate stats from all collected matches
   */
  getGenerationStats(): GenerationMatchStats {
    const n = this.matchResults.length;
    if (n === 0) {
      return {
        totalMatches: 0,
        winsByPlayer: new Array(this.playerCount).fill(0),
        timeouts: 0,
        avgConversions: new Array(this.playerCount).fill(0),
        avgCursorTargets: new Array(this.playerCount).fill([0, 0]) as [number, number][],
        avgVariance: new Array(this.playerCount).fill(0),
      };
    }

    const winsByPlayer = new Array(this.playerCount).fill(0);
    let timeouts = 0;
    const totalConversions = new Array(this.playerCount).fill(0);
    const totalTargetsX = new Array(this.playerCount).fill(0);
    const totalTargetsY = new Array(this.playerCount).fill(0);
    const totalVariance = new Array(this.playerCount).fill(0);

    for (const result of this.matchResults) {
      if (result.winner === -1) {
        timeouts++;
      } else if (result.winner >= 0 && result.winner < this.playerCount) {
        winsByPlayer[result.winner]++;
      }

      for (let i = 0; i < this.playerCount; i++) {
        totalConversions[i] += result.conversionsPerPlayer[i] || 0;
        totalTargetsX[i] += result.avgCursorTargets[i]?.[0] || 0;
        totalTargetsY[i] += result.avgCursorTargets[i]?.[1] || 0;
        totalVariance[i] += result.cursorVariance[i] || 0;
      }
    }

    return {
      totalMatches: n,
      winsByPlayer,
      timeouts,
      avgConversions: totalConversions.map(c => c / n),
      avgCursorTargets: totalTargetsX.map((x, i) => [x / n, totalTargetsY[i] / n] as [number, number]),
      avgVariance: totalVariance.map(v => v / n),
    };
  }

  /**
   * Evaluate a model's fitness by playing matches
   * The model plays as player 0 against randomly selected opponents
   *
   * @param model The model to evaluate
   * @param population Full population of models to sample opponents from
   * @returns Detailed evaluation result
   */
  async evaluateModel(model: tf.Sequential, population: tf.Sequential[]): Promise<GenomeEvalResult> {
    let totalScore = 0;
    let totalTargetX = 0;
    let totalTargetY = 0;
    let totalVariance = 0;
    let totalConversions = 0;
    let wins = 0;
    let matchCount = 0;

    // Get opponents (everyone except self)
    const availableOpponents = population.filter(m => m !== model);

    for (let i = 0; i < this.config.matchesPerEvaluation; i++) {
      // Sample N-1 opponents for this match
      const opponents = this.sampleOpponents(availableOpponents, this.playerCount - 1);

      // Build player list: model being evaluated is always player 0
      const players = [model, ...opponents];

      // Play the match
      const result = await this.playMatch(players);

      // Store result for aggregate stats
      this.matchResults.push(result);

      // Collect player 0 stats (the genome being evaluated)
      totalScore += result.scores[0];
      totalTargetX += result.avgCursorTargets[0][0];
      totalTargetY += result.avgCursorTargets[0][1];
      totalVariance += result.cursorVariance[0];
      totalConversions += result.conversionsPerPlayer[0];
      if (result.winner === 0) wins++;
      matchCount++;
    }

    return {
      fitness: matchCount > 0 ? totalScore / matchCount : 0,
      avgTarget: [totalTargetX / matchCount, totalTargetY / matchCount],
      avgVariance: totalVariance / matchCount,
      totalConversions,
      wins,
      matches: matchCount,
    };
  }

  /**
   * Play a single match between multiple models
   *
   * @param models Array of models, one per player
   * @returns Match result with scores for all players
   */
  async playMatch(models: tf.Sequential[]): Promise<MatchResult> {
    // Create simulator
    const simulator = new GameSimulator({
      ...this.config.simulatorConfig,
      playerCount: models.length,
    });

    // Create AI controllers for each player
    const ais = models.map((model, i) =>
      new NeuralAI(i, model, this.config.encoderConfig)
    );

    // Reset simulator
    simulator.reset();

    // Track conversions per player
    const conversions = new Array(models.length).fill(0);
    let previousCounts = simulator.getGame().getPlayers().map(p => p.particleCount);
    const startingParticles = previousCounts[0]; // All players start equal

    // Track cursor targets for diagnostics
    const allTargets: [number, number][][] = models.map(() => []);

    // Run the match
    let steps = 0;
    while (!simulator.isTerminal() && steps < this.config.maxStepsPerMatch) {
      const game = simulator.getGame();

      // Get actions from all AIs
      const actions = new Map<number, AIAction>();
      for (let i = 0; i < ais.length; i++) {
        const action = ais[i].getAction(game);
        actions.set(i, action);
        // Track cursor targets for diagnostics
        allTargets[i].push([action.targetX, action.targetY]);
      }

      // Step the simulation
      simulator.step(actions);
      steps++;

      // Track conversions (particles gained = conversions made)
      const currentCounts = simulator.getGame().getPlayers().map(p => p.particleCount);
      for (let i = 0; i < currentCounts.length; i++) {
        const gained = currentCounts[i] - previousCounts[i];
        if (gained > 0) {
          conversions[i] += gained;
        }
      }
      previousCounts = [...currentCounts];
    }

    // Compute cursor analytics
    const avgCursorTargets: [number, number][] = allTargets.map(targets => {
      if (targets.length === 0) return [0, 0] as [number, number];
      const avgX = targets.reduce((s, t) => s + t[0], 0) / targets.length;
      const avgY = targets.reduce((s, t) => s + t[1], 0) / targets.length;
      return [avgX, avgY] as [number, number];
    });

    const cursorVariance: number[] = allTargets.map((targets, i) => {
      if (targets.length === 0) return 0;
      const [avgX, avgY] = avgCursorTargets[i];
      return targets.reduce((s, t) =>
        s + (t[0] - avgX) ** 2 + (t[1] - avgY) ** 2, 0) / targets.length;
    });

    // Get final state
    const game = simulator.getGame();
    const players = game.getPlayers();
    const winner = simulator.getWinner();

    const finalParticleCounts = players.map(p => p.particleCount);

    // Calculate scores for all players
    const scores = players.map((_, i) =>
      this.calculateScore(i, winner, steps, finalParticleCounts, conversions, startingParticles)
    );

    // Cleanup
    simulator.destroy();

    return {
      winner,
      steps,
      finalParticleCounts,
      conversionsPerPlayer: conversions,
      scores,
      avgCursorTargets,
      cursorVariance,
    };
  }

  /**
   * Calculate the score for a player based on match outcome
   *
   * Relative reward function (prevents clustering exploits):
   * 1. Base: particle share (0-100 points based on % of total)
   * 2. Conversion advantage: reward for out-converting opponents (not raw count)
   * 3. Dominance bonus: up to +50 for gaining particles overall
   * 4. Win/timeout bonus: +100-200 for winning, +25 for leading at timeout
   */
  private calculateScore(
    playerId: number,
    winner: number,
    steps: number,
    particleCounts: number[],
    conversions: number[],
    startingParticles: number
  ): number {
    const myParticles = particleCounts[playerId];
    const myConversions = conversions[playerId];
    const totalParticles = particleCounts.reduce((a, b) => a + b, 0);
    const totalConversions = conversions.reduce((a, b) => a + b, 0);
    const playerCount = particleCounts.length;

    // 1. Base score: particle share (0-100 points)
    // In a 4-player game, equal share = 25 points
    const particleShare = totalParticles > 0 ? myParticles / totalParticles : 0;
    let score = particleShare * 100;

    // 2. Conversion advantage: reward for out-converting opponents
    // If everyone clusters and gets similar conversions, no bonus
    // Only rewarded for converting MORE than average opponent
    const avgOpponentConversions = playerCount > 1
      ? (totalConversions - myConversions) / (playerCount - 1)
      : 0;
    const conversionAdvantage = myConversions - avgOpponentConversions;
    score += conversionAdvantage * 2;

    // 3. Dominance bonus: up to +50 for gaining particles
    const netGain = myParticles - startingParticles;
    if (netGain > 0) {
      // Scale bonus based on how much they gained relative to starting amount
      const gainRatio = Math.min(1, netGain / startingParticles);
      score += 50 * gainRatio;
    }

    // 4. Win/Loss/Timeout bonus
    if (winner !== -1) {
      // Game ended with a winner
      const remainingRatio = (this.config.maxStepsPerMatch - steps) / this.config.maxStepsPerMatch;
      if (winner === playerId) {
        // Winner: +100 base, up to +100 more for winning quickly
        score += 100 + (remainingRatio * 100);
      } else {
        // Loser: -50 penalty
        score -= 50;
      }
    } else {
      // Timeout: bonus for being in the lead
      const maxParticles = Math.max(...particleCounts);
      if (myParticles === maxParticles && myParticles > startingParticles) {
        score += 25;
      }
    }

    return score;
  }

  /**
   * Sample opponents from available models
   */
  private sampleOpponents(opponents: tf.Sequential[], count: number): tf.Sequential[] {
    if (opponents.length <= count) {
      return opponents;
    }

    // Random sampling without replacement
    const shuffled = [...opponents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Get the evaluator configuration
   */
  getConfig(): EvaluatorConfig {
    return { ...this.config };
  }

  /**
   * Play a diagnostic match with full logging
   * Used for debugging training behavior
   */
  async playDiagnosticMatch(models: tf.Sequential[]): Promise<MatchResult> {
    return this.playMatch(models);
  }
}
