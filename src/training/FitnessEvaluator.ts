// FitnessEvaluator - Evaluate genome fitness through multi-player matches

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
    playerCount: 3,
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
  scores: number[]; // Score for each player
}

/**
 * Fitness evaluator for NEAT genomes
 * Runs multi-player matches between genomes and computes fitness scores
 */
export class FitnessEvaluator {
  private config: EvaluatorConfig;
  private playerCount: number;

  constructor(config: Partial<EvaluatorConfig> = {}) {
    this.config = { ...DEFAULT_EVALUATOR_CONFIG, ...config };
    this.playerCount = this.config.simulatorConfig.playerCount || 3;
  }

  /**
   * Evaluate a genome's fitness by playing matches
   * The genome plays as player 0 against randomly selected opponents
   *
   * @param genome The genome to evaluate
   * @param population Full population to sample opponents from
   * @returns Fitness score
   */
  async evaluateGenome(genome: NetworkType, population: NetworkType[]): Promise<number> {
    let totalScore = 0;
    let matchCount = 0;

    // Get opponents (everyone except self)
    const availableOpponents = population.filter(g => g !== genome);

    for (let i = 0; i < this.config.matchesPerEvaluation; i++) {
      // Sample N-1 opponents for this match
      const opponents = this.sampleOpponents(availableOpponents, this.playerCount - 1);

      // Build player list: genome being evaluated is always player 0
      const players = [genome, ...opponents];

      // Play the match
      const result = await this.playMatch(players);

      // Get score for player 0 (the genome being evaluated)
      totalScore += result.scores[0];
      matchCount++;
    }

    // Return average score
    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  /**
   * Play a single match between multiple genomes
   *
   * @param genomes Array of genomes, one per player
   * @returns Match result with scores for all players
   */
  async playMatch(genomes: NetworkType[]): Promise<MatchResult> {
    // Create simulator
    const simulator = new GameSimulator({
      ...this.config.simulatorConfig,
      playerCount: genomes.length,
    });

    // Create AI controllers for each player
    const ais = genomes.map((genome, i) =>
      new NeuralAI(i, genome, this.config.encoderConfig)
    );

    // Reset simulator
    simulator.reset();

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
    }

    // Get final state
    const game = simulator.getGame();
    const players = game.getPlayers();
    const winner = simulator.getWinner();

    const finalParticleCounts = players.map(p => p.particleCount);

    // Calculate scores for all players
    const scores = players.map((_, i) =>
      this.calculateScore(i, winner, steps, finalParticleCounts)
    );

    // Cleanup
    simulator.destroy();

    return {
      winner,
      steps,
      finalParticleCounts,
      scores,
    };
  }

  /**
   * Calculate the score for a player based on match outcome
   *
   * Reward function:
   * - Timeout: score = particle count
   * - Early win: winner gets particles + remaining seconds
   * - Early win: losers get particles - remaining seconds
   */
  private calculateScore(
    playerId: number,
    winner: number,
    steps: number,
    particleCounts: number[]
  ): number {
    const myParticles = particleCounts[playerId];

    // Base score: particle count
    let score = myParticles;

    // If game ended early (someone won before timeout)
    if (winner !== -1 && steps < this.config.maxStepsPerMatch) {
      const remainingSteps = this.config.maxStepsPerMatch - steps;
      const remainingSeconds = remainingSteps / this.config.stepsPerSecond;

      if (winner === playerId) {
        // Winner bonus: add remaining seconds
        score += remainingSeconds;
      } else {
        // Loser malus: subtract remaining seconds
        score -= remainingSeconds;
      }
    }

    return score;
  }

  /**
   * Sample opponents from available genomes
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
    return evaluator.evaluateGenome(genome, population);
  };
}
