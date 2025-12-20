// FitnessEvaluator - Evaluate model fitness through multi-player matches

import * as tf from '@tensorflow/tfjs';
import { GameSimulator } from '../core/GameSimulator';
import type { SimulatorConfig, AIAction } from '../core/AIInterface';
import { NeuralAI } from '../ai/NeuralAI';
import type { EncoderConfig } from '../ai/ObservationEncoder';

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
}

/**
 * Fitness evaluator for CNN models
 * Runs multi-player matches between models and computes fitness scores
 */
export class FitnessEvaluator {
  private config: EvaluatorConfig;
  private playerCount: number;

  constructor(config: Partial<EvaluatorConfig> = {}) {
    this.config = { ...DEFAULT_EVALUATOR_CONFIG, ...config };
    this.playerCount = this.config.simulatorConfig.playerCount || 4;
  }

  /**
   * Evaluate a model's fitness by playing matches
   * The model plays as player 0 against randomly selected opponents
   *
   * @param model The model to evaluate
   * @param population Full population of models to sample opponents from
   * @returns Fitness score
   */
  async evaluateModel(model: tf.Sequential, population: tf.Sequential[]): Promise<number> {
    let totalScore = 0;
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

      // Get score for player 0 (the model being evaluated)
      totalScore += result.scores[0];
      matchCount++;
    }

    // Return average score
    return matchCount > 0 ? totalScore / matchCount : 0;
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

    // Run the match
    let steps = 0;
    while (!simulator.isTerminal() && steps < this.config.maxStepsPerMatch) {
      const game = simulator.getGame();

      // Get actions from all AIs
      const actions = new Map<number, AIAction>();
      for (let i = 0; i < ais.length; i++) {
        actions.set(i, ais[i].getAction(game));
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
    };
  }

  /**
   * Calculate the score for a player based on match outcome
   *
   * New aggression-focused reward function:
   * 1. Base: particle share (0-100 points based on % of total)
   * 2. Conversion bonus: +2 per particle converted (incentivizes attacking)
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

    // 1. Base score: particle share (0-100 points)
    // In a 4-player game, equal share = 25 points
    const particleShare = totalParticles > 0 ? myParticles / totalParticles : 0;
    let score = particleShare * 100;

    // 2. Conversion bonus: +2 per particle converted (BIG incentive to attack)
    score += myConversions * 2;

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
}
