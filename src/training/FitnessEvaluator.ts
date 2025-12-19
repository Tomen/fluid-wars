// FitnessEvaluator - Evaluate genome fitness through matches

import type { Network as NetworkType } from 'neataptic';
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

  /** Reward for winning a match */
  winReward: number;

  /** Penalty for losing a match */
  loseReward: number;

  /** Reward for a draw (timeout) */
  drawReward: number;

  /** Bonus per particle advantage at end of match */
  particleAdvantageBonus: number;

  /** Bonus for quick wins (scales with remaining time) */
  quickWinBonus: number;

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
  winReward: 100,
  loseReward: -50,
  drawReward: 0,
  particleAdvantageBonus: 0.5,
  quickWinBonus: 20,
  simulatorConfig: {
    particlesPerPlayer: 100, // Smaller for faster training
    maxSteps: 1800,
  },
  encoderConfig: {},
};

/**
 * Result of a single match
 */
export interface MatchResult {
  winner: number; // -1 for draw, 0 or 1 for player
  steps: number;
  finalParticleCounts: number[];
  player0Score: number;
  player1Score: number;
}

/**
 * Fitness evaluator for NEAT genomes
 * Runs matches between genomes and computes fitness scores
 */
export class FitnessEvaluator {
  private config: EvaluatorConfig;

  constructor(config: Partial<EvaluatorConfig> = {}) {
    this.config = { ...DEFAULT_EVALUATOR_CONFIG, ...config };
  }

  /**
   * Evaluate a genome's fitness by playing matches against opponents
   *
   * @param genome The genome to evaluate
   * @param opponents Array of opponent genomes to play against
   * @returns Fitness score
   */
  async evaluateGenome(genome: NetworkType, opponents: NetworkType[]): Promise<number> {
    let totalScore = 0;
    let matchCount = 0;

    // Play against a sample of opponents
    const opponentSample = this.sampleOpponents(opponents, this.config.matchesPerEvaluation);

    for (const opponent of opponentSample) {
      // Play as player 0
      const result0 = await this.playMatch(genome, opponent);
      totalScore += result0.player0Score;
      matchCount++;

      // Play as player 1 (swap positions for fairness)
      const result1 = await this.playMatch(opponent, genome);
      totalScore += result1.player1Score;
      matchCount++;
    }

    // Return average score
    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  /**
   * Play a single match between two genomes
   *
   * @param genome0 Player 0's genome
   * @param genome1 Player 1's genome
   * @returns Match result
   */
  async playMatch(genome0: NetworkType, genome1: NetworkType): Promise<MatchResult> {
    // Create simulator
    const simulator = new GameSimulator(this.config.simulatorConfig);

    // Create AI controllers
    const ai0 = new NeuralAI(0, genome0, this.config.encoderConfig);
    const ai1 = new NeuralAI(1, genome1, this.config.encoderConfig);

    // Reset simulator
    simulator.reset();

    // Run the match
    let steps = 0;
    while (!simulator.isTerminal() && steps < this.config.maxStepsPerMatch) {
      const game = simulator.getGame();

      // Get actions from both AIs
      const action0 = ai0.getAction(game);
      const action1 = ai1.getAction(game);

      // Create action map
      const actions = new Map<number, AIAction>();
      actions.set(0, action0);
      actions.set(1, action1);

      // Step the simulation
      simulator.step(actions);
      steps++;
    }

    // Get final state
    const game = simulator.getGame();
    const players = game.getPlayers();
    const winner = simulator.getWinner();

    const finalParticleCounts = players.map(p => p.particleCount);
    const totalParticles = finalParticleCounts.reduce((a, b) => a + b, 0);

    // Calculate scores
    const player0Score = this.calculateScore(0, winner, steps, finalParticleCounts, totalParticles);
    const player1Score = this.calculateScore(1, winner, steps, finalParticleCounts, totalParticles);

    // Cleanup
    simulator.destroy();

    return {
      winner,
      steps,
      finalParticleCounts,
      player0Score,
      player1Score,
    };
  }

  /**
   * Calculate the score for a player based on match outcome
   */
  private calculateScore(
    playerId: number,
    winner: number,
    steps: number,
    particleCounts: number[],
    totalParticles: number
  ): number {
    let score = 0;

    // Win/lose/draw reward
    if (winner === playerId) {
      score += this.config.winReward;

      // Quick win bonus (more bonus for faster wins)
      const timeRatio = 1 - (steps / this.config.maxStepsPerMatch);
      score += this.config.quickWinBonus * timeRatio;
    } else if (winner === -1) {
      // Draw
      score += this.config.drawReward;
    } else {
      // Loss
      score += this.config.loseReward;
    }

    // Particle advantage bonus
    if (totalParticles > 0) {
      const myParticles = particleCounts[playerId];
      const enemyParticles = particleCounts[1 - playerId];
      const advantage = (myParticles - enemyParticles) / totalParticles;
      score += advantage * this.config.particleAdvantageBonus * 100;
    }

    return score;
  }

  /**
   * Sample opponents from the population
   */
  private sampleOpponents(opponents: NetworkType[], count: number): NetworkType[] {
    if (opponents.length <= count) {
      return opponents;
    }

    // Random sampling without replacement
    const shuffled = [...opponents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Run a tournament between multiple genomes
   * Returns fitness scores for all participants
   */
  async runTournament(genomes: NetworkType[]): Promise<Map<NetworkType, number>> {
    const scores = new Map<NetworkType, number>();

    for (const genome of genomes) {
      // Evaluate against all other genomes
      const opponents = genomes.filter(g => g !== genome);
      const fitness = await this.evaluateGenome(genome, opponents);
      scores.set(genome, fitness);
    }

    return scores;
  }

  /**
   * Get the evaluator configuration
   */
  getConfig(): EvaluatorConfig {
    return { ...this.config };
  }
}

/**
 * Quick evaluation function for use with NEATTrainer
 * Creates an evaluator and returns a fitness function
 */
export function createFitnessFunction(
  config: Partial<EvaluatorConfig> = {}
): (genome: NetworkType, population: NetworkType[]) => Promise<number> {
  const evaluator = new FitnessEvaluator(config);

  return async (genome: NetworkType, population: NetworkType[]): Promise<number> => {
    // Filter out self from opponents
    const opponents = population.filter(g => g !== genome);
    return evaluator.evaluateGenome(genome, opponents);
  };
}
