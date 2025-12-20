// GeneticTrainer - Genetic algorithm for CNN weight evolution

import * as tf from '@tensorflow/tfjs';
import { TRAINING_CONFIG } from '../config';
import { createModel, setWeights, getWeightCount, weightsToJSON, weightsFromJSON } from '../ai/CNNModel';
import { FitnessEvaluator, EvaluatorConfig } from './FitnessEvaluator';

/**
 * Individual genome (weight vector) with fitness
 */
interface Genome {
  weights: Float32Array;
  fitness: number;
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
      this.population.push({ weights, fitness: 0 });
    }

    this.generation = 0;
    console.log(`[GeneticTrainer] Population initialized`);
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

    // Evaluate all genomes
    await this.evaluatePopulation();

    // Sort by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Compute stats
    const stats: GenerationStats = {
      generation: this.generation,
      bestFitness: this.population[0].fitness,
      averageFitness: this.population.reduce((sum, g) => sum + g.fitness, 0) / this.population.length,
      worstFitness: this.population[this.population.length - 1].fitness,
      elapsedTime: Date.now() - startTime,
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

    // Evaluate each model
    for (let i = 0; i < this.population.length; i++) {
      this.population[i].fitness = await this.evaluator.evaluateModel(models[i], models);
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

    // Keep elites unchanged
    for (let i = 0; i < TRAINING_CONFIG.eliteCount && i < popSize; i++) {
      newPopulation.push({
        weights: new Float32Array(this.population[i].weights),
        fitness: 0,
      });
    }

    // Fill rest with offspring
    while (newPopulation.length < popSize) {
      if (Math.random() < TRAINING_CONFIG.crossoverRate) {
        // Crossover: blend two parents
        const parent1 = this.tournamentSelect();
        const parent2 = this.tournamentSelect();
        const childWeights = this.crossover(parent1.weights, parent2.weights);
        this.mutate(childWeights);
        newPopulation.push({ weights: childWeights, fitness: 0 });
      } else {
        // Mutation only: clone and mutate
        const parent = this.tournamentSelect();
        const childWeights = new Float32Array(parent.weights);
        this.mutate(childWeights);
        newPopulation.push({ weights: childWeights, fitness: 0 });
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
    this.population = checkpoint.population.map(weights => ({
      weights: weightsFromJSON(weights),
      fitness: 0,
    }));
    console.log(`[GeneticTrainer] Loaded checkpoint at generation ${this.generation}`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.templateModel.dispose();
  }
}
