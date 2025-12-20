// GeneticTrainer - Genetic algorithm for CNN weight evolution

import * as tf from '@tensorflow/tfjs';
import { TRAINING_CONFIG } from '../config';
import { createModel, setWeights, getWeightCount, weightsToJSON, weightsFromJSON } from '../ai/CNNModel';
import { FitnessEvaluator, EvaluatorConfig, MatchResult, GenerationMatchStats } from './FitnessEvaluator';

/**
 * Individual genome (weight vector) with fitness and lineage
 */
export interface Genome {
  id: string; // Unique ID like "G5.3" (generation 5, index 3)
  weights: Float32Array;
  fitness: number;
  parentIds: string[]; // Parent genome IDs (1 for mutation, 2 for crossover)
  // Per-genome stats from evaluation
  avgTarget: [number, number];
  avgVariance: number;
  totalConversions: number;
  wins: number;
  matches: number;
}

/**
 * Checkpoint data for saving/loading training state
 */
export interface Checkpoint {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  population: number[][];  // Array of weight arrays
  timestamp: string;
}

/**
 * Generation statistics
 */
export interface GenerationStats {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  elapsedTime: number;
  matchStats: GenerationMatchStats; // Aggregate stats from all matches
  topGenomes: Genome[]; // Top N genomes from this generation (before evolution)
}

/**
 * Progress callback type
 */
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * GeneticTrainer evolves CNN weights using a genetic algorithm
 */
export class GeneticTrainer {
  private population: Genome[] = [];
  private generation: number = 0;
  private weightCount: number = 0;
  private templateModel: tf.Sequential;
  private evaluator: FitnessEvaluator;
  private progressCallback: ProgressCallback | null = null;

  // Store last generation's stats for checkpointing (since evolve() resets fitness)
  private lastBestFitness: number = 0;
  private lastAverageFitness: number = 0;

  constructor(evaluatorConfig?: Partial<EvaluatorConfig>) {
    // Create template model to determine weight count
    this.templateModel = createModel();
    this.weightCount = getWeightCount(this.templateModel);
    console.log(`[GeneticTrainer] Model has ${this.weightCount} weights`);

    // Create fitness evaluator
    this.evaluator = new FitnessEvaluator(evaluatorConfig);
  }

  /**
   * Set callback for progress updates during evaluation
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Initialize population with random weights
   */
  initialize(): void {
    console.log(`[GeneticTrainer] Initializing population of ${TRAINING_CONFIG.populationSize}...`);

    this.population = [];
    for (let i = 0; i < TRAINING_CONFIG.populationSize; i++) {
      const weights = this.randomWeights();
      this.population.push(this.createGenome(`G0.${i}`, weights, []));
    }

    this.generation = 0;
    console.log(`[GeneticTrainer] Population initialized`);
  }

  /**
   * Create a new genome with default stats
   */
  private createGenome(id: string, weights: Float32Array, parentIds: string[]): Genome {
    return {
      id,
      weights,
      fitness: 0,
      parentIds,
      avgTarget: [0, 0],
      avgVariance: 0,
      totalConversions: 0,
      wins: 0,
      matches: 0,
    };
  }

  /**
   * Generate random weights using Xavier/Glorot initialization
   */
  private randomWeights(): Float32Array {
    const weights = new Float32Array(this.weightCount);
    const stddev = 0.1;
    for (let i = 0; i < this.weightCount; i++) {
      weights[i] = this.randomGaussian() * stddev;
    }
    return weights;
  }

  /**
   * Generate Gaussian random number using Box-Muller transform
   */
  private randomGaussian(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Run one generation of evolution
   */
  async runGeneration(): Promise<GenerationStats> {
    const startTime = Date.now();

    // Clear match results from previous generation
    this.evaluator.clearMatchResults();

    // Evaluate all genomes
    await this.evaluatePopulation();

    // Get aggregate match stats
    const matchStats = this.evaluator.getGenerationStats();

    // Sort by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Get top genomes before evolution (deep copy to preserve stats)
    const topGenomes = this.population.slice(0, 5).map(g => ({ ...g }));

    // Compute stats
    const stats: GenerationStats = {
      generation: this.generation,
      bestFitness: this.population[0].fitness,
      averageFitness: this.population.reduce((sum, g) => sum + g.fitness, 0) / this.population.length,
      worstFitness: this.population[this.population.length - 1].fitness,
      elapsedTime: Date.now() - startTime,
      matchStats,
      topGenomes,
    };

    // Store stats for checkpointing (evolve() will reset fitness values)
    this.lastBestFitness = stats.bestFitness;
    this.lastAverageFitness = stats.averageFitness;

    // Create next generation
    this.evolve();

    this.generation++;
    return stats;
  }

  /**
   * Evaluate all genomes in the population using FitnessEvaluator
   */
  private async evaluatePopulation(): Promise<void> {
    const total = this.population.length;
    let completed = 0;

    // Create models for all genomes
    const models: tf.Sequential[] = this.population.map(genome => {
      const model = createModel();
      setWeights(model, genome.weights);
      return model;
    });

    // Evaluate each model and store per-genome stats
    for (let i = 0; i < this.population.length; i++) {
      const result = await this.evaluator.evaluateModel(models[i], models);
      const genome = this.population[i];

      // Store evaluation results on genome
      genome.fitness = result.fitness;
      genome.avgTarget = result.avgTarget;
      genome.avgVariance = result.avgVariance;
      genome.totalConversions = result.totalConversions;
      genome.wins = result.wins;
      genome.matches = result.matches;

      completed++;
      if (this.progressCallback) {
        this.progressCallback(completed, total);
      }
    }

    // Dispose models after evaluation
    for (const model of models) {
      model.dispose();
    }
  }

  /**
   * Evolve the population to create the next generation
   */
  private evolve(): void {
    const newPopulation: Genome[] = [];
    const popSize = TRAINING_CONFIG.populationSize;
    const nextGen = this.generation + 1;
    let childIndex = 0;

    // Keep elites unchanged (but give them new IDs in next generation)
    for (let i = 0; i < TRAINING_CONFIG.eliteCount && i < popSize; i++) {
      const elite = this.population[i];
      const newId = `G${nextGen}.${childIndex++}`;
      newPopulation.push(this.createGenome(
        newId,
        new Float32Array(elite.weights),
        [elite.id] // Elite carries forward from itself
      ));
    }

    // Fill rest with offspring
    while (newPopulation.length < popSize) {
      const newId = `G${nextGen}.${childIndex++}`;

      if (Math.random() < TRAINING_CONFIG.crossoverRate) {
        // Crossover: blend two parents
        const parent1 = this.tournamentSelect();
        const parent2 = this.tournamentSelect();
        const childWeights = this.crossover(parent1.weights, parent2.weights);
        this.mutate(childWeights);
        newPopulation.push(this.createGenome(newId, childWeights, [parent1.id, parent2.id]));
      } else {
        // Mutation only: clone and mutate
        const parent = this.tournamentSelect();
        const childWeights = new Float32Array(parent.weights);
        this.mutate(childWeights);
        newPopulation.push(this.createGenome(newId, childWeights, [parent.id]));
      }
    }

    this.population = newPopulation;
  }

  /**
   * Tournament selection: pick best of 3 random individuals
   */
  private tournamentSelect(): Genome {
    const tournamentSize = 3;
    let best: Genome | null = null;

    for (let i = 0; i < tournamentSize; i++) {
      const candidate = this.population[Math.floor(Math.random() * this.population.length)];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best!;
  }

  /**
   * Crossover: blend two parent weight vectors
   */
  private crossover(parent1: Float32Array, parent2: Float32Array): Float32Array {
    const child = new Float32Array(this.weightCount);

    for (let i = 0; i < this.weightCount; i++) {
      const t = Math.random();
      child[i] = parent1[i] * t + parent2[i] * (1 - t);
    }

    return child;
  }

  /**
   * Mutate weights with Gaussian noise
   */
  private mutate(weights: Float32Array): void {
    for (let i = 0; i < weights.length; i++) {
      if (Math.random() < TRAINING_CONFIG.mutationRate) {
        weights[i] += this.randomGaussian() * TRAINING_CONFIG.mutationStrength;
      }
    }
  }

  /**
   * Get the best genome's weights as a model
   */
  getBestModel(): tf.Sequential {
    const model = createModel();
    setWeights(model, this.population[0].weights);
    return model;
  }

  /**
   * Get current generation number
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Get top N genomes sorted by fitness (for logging/debugging)
   */
  getTopGenomes(n: number = 5): Genome[] {
    return this.population
      .slice() // Don't mutate original
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, n);
  }

  /**
   * Create a checkpoint of current training state
   */
  createCheckpoint(): Checkpoint {
    return {
      generation: this.generation,
      bestFitness: this.lastBestFitness,
      averageFitness: this.lastAverageFitness,
      population: this.population.map(g => weightsToJSON(g.weights)),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Restore from a checkpoint
   */
  loadCheckpoint(checkpoint: Checkpoint): void {
    this.generation = checkpoint.generation;
    this.lastBestFitness = checkpoint.bestFitness;
    this.lastAverageFitness = checkpoint.averageFitness;
    this.population = checkpoint.population.map((weights, i) =>
      this.createGenome(`G${this.generation}.${i}`, weightsFromJSON(weights), [])
    );
    console.log(`[GeneticTrainer] Loaded checkpoint at generation ${this.generation}`);
  }

  /**
   * Run a diagnostic match with the best model against random opponents
   * Used for debugging/monitoring training progress
   */
  async runDiagnosticMatch(): Promise<MatchResult> {
    // Create models for best genome and random opponents
    const playerCount = this.evaluator.getConfig().simulatorConfig.playerCount || 4;

    // Best model is player 0
    const bestModel = createModel();
    setWeights(bestModel, this.population[0].weights);

    // Random opponents from population
    const models: tf.Sequential[] = [bestModel];
    for (let i = 1; i < playerCount; i++) {
      const opponentIdx = Math.floor(Math.random() * this.population.length);
      const model = createModel();
      setWeights(model, this.population[opponentIdx].weights);
      models.push(model);
    }

    // Play diagnostic match
    const result = await this.evaluator.playDiagnosticMatch(models);

    // Dispose models
    for (const model of models) {
      model.dispose();
    }

    return result;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.templateModel.dispose();
  }
}
