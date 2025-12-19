// NEATTrainer - NEAT evolution orchestration

import neataptic from 'neataptic';
import type { NeatOptions, NetworkJSON, Network as NetworkType, Neat as NeatType } from 'neataptic';
const { Neat, Network, methods, architect } = neataptic;

/**
 * Configuration for the NEAT trainer
 */
export interface TrainerConfig {
  /** Number of genomes in the population */
  populationSize: number;

  /** Number of input nodes (observation size) */
  inputSize: number;

  /** Number of output nodes (action size) */
  outputSize: number;

  /** Number of top genomes to keep unchanged */
  elitism: number;

  /** Probability of mutation per genome */
  mutationRate: number;

  /** Number of mutations to apply when mutating */
  mutationAmount: number;

  /** Maximum number of generations to train */
  maxGenerations: number;

  /** Target fitness to stop training early */
  targetFitness?: number;

  /** Generations between checkpoint saves */
  checkpointInterval: number;

  /** Whether to log progress */
  verbose: boolean;
}

/**
 * Default trainer configuration
 */
export const DEFAULT_TRAINER_CONFIG: TrainerConfig = {
  populationSize: 100,
  inputSize: 1606, // 16*20*5 grid + 4 cursor + 2 counts
  outputSize: 2,   // targetX, targetY
  elitism: 10,
  mutationRate: 0.3,
  mutationAmount: 1,
  maxGenerations: 1000,
  targetFitness: undefined,
  checkpointInterval: 50,
  verbose: true,
};

/**
 * Checkpoint data for saving/loading training state
 */
export interface Checkpoint {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  bestGenome: NetworkJSON;
  population: NetworkJSON[];
  config: TrainerConfig;
  timestamp: string;
}

/**
 * Training statistics for a generation
 */
export interface GenerationStats {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  elapsedTime: number;
}

/**
 * Callback for fitness evaluation
 * Should evaluate a genome and return its fitness score
 */
export type FitnessFunction = (genome: NetworkType, population: NetworkType[]) => Promise<number>;

/**
 * Callback for generation completion
 */
export type GenerationCallback = (stats: GenerationStats, best: NetworkType) => void;

/**
 * Callback for checkpoint saving
 */
export type CheckpointCallback = (checkpoint: Checkpoint) => void;

/**
 * NEAT Trainer for evolving neural network game AI
 */
export class NEATTrainer {
  private config: TrainerConfig;
  private neat: NeatType | null = null;
  private generation: number = 0;
  private isTraining: boolean = false;
  private shouldStop: boolean = false;
  private resumedFromCheckpoint: boolean = false;

  // Callbacks
  private fitnessFunction: FitnessFunction | null = null;
  private onGeneration: GenerationCallback | null = null;
  private onCheckpoint: CheckpointCallback | null = null;

  constructor(config: Partial<TrainerConfig> = {}) {
    this.config = { ...DEFAULT_TRAINER_CONFIG, ...config };
  }

  /**
   * Initialize a new population
   */
  initialize(): void {
    const { inputSize, outputSize, populationSize, elitism, mutationRate, mutationAmount } = this.config;

    // Create initial population with random networks
    const initialPopulation: NetworkType[] = [];
    for (let i = 0; i < populationSize; i++) {
      // Create a simple perceptron with one hidden layer
      const network = architect.Perceptron(inputSize, Math.floor(inputSize / 10), outputSize);
      initialPopulation.push(network);
    }

    // Create NEAT instance
    this.neat = new Neat(inputSize, outputSize, null, {
      population: initialPopulation,
      popsize: populationSize,
      elitism: elitism,
      mutationRate: mutationRate,
      mutationAmount: mutationAmount,
      selection: methods.selection.TOURNAMENT,
      crossover: [
        methods.crossover.SINGLE_POINT,
        methods.crossover.TWO_POINT,
        methods.crossover.UNIFORM,
      ],
      mutation: methods.mutation.FFW,
    } as NeatOptions);

    this.generation = 0;
    this.log('Initialized NEAT trainer with population size:', populationSize);
  }

  /**
   * Set the fitness evaluation function
   */
  setFitnessFunction(fn: FitnessFunction): void {
    this.fitnessFunction = fn;
  }

  /**
   * Set the generation callback
   */
  setGenerationCallback(fn: GenerationCallback): void {
    this.onGeneration = fn;
  }

  /**
   * Set the checkpoint callback
   */
  setCheckpointCallback(fn: CheckpointCallback): void {
    this.onCheckpoint = fn;
  }

  /**
   * Run the training loop
   */
  async train(): Promise<NetworkType> {
    if (!this.neat) {
      throw new Error('Trainer not initialized. Call initialize() first.');
    }

    if (!this.fitnessFunction) {
      throw new Error('Fitness function not set. Call setFitnessFunction() first.');
    }

    this.isTraining = true;
    this.shouldStop = false;

    this.log('Starting training...');
    const startTime = Date.now();

    while (this.generation < this.config.maxGenerations && !this.shouldStop) {
      const genStartTime = Date.now();

      // Skip evaluation if we just resumed from a checkpoint (already evaluated)
      if (this.resumedFromCheckpoint) {
        this.resumedFromCheckpoint = false;
        this.log(`Skipping evaluation for gen ${this.generation} (resumed from checkpoint)`);
      } else {
        // Evaluate all genomes
        await this.evaluatePopulation();

        // Sort by fitness (descending)
        this.neat.sort();

        // Get statistics
        const stats = this.getGenerationStats(genStartTime);

        // Call generation callback
        if (this.onGeneration) {
          this.onGeneration(stats, this.neat.population[0]);
        }

        // Log progress
        if (this.config.verbose) {
          this.log(
            `Gen ${stats.generation}: Best=${stats.bestFitness.toFixed(2)}, ` +
            `Avg=${stats.averageFitness.toFixed(2)}, Time=${stats.elapsedTime}ms`
          );
        }

        // Check for target fitness
        if (this.config.targetFitness !== undefined && stats.bestFitness >= this.config.targetFitness) {
          this.log(`Target fitness ${this.config.targetFitness} reached!`);
          break;
        }

        // Save checkpoint
        if (this.generation % this.config.checkpointInterval === 0) {
          this.saveCheckpoint();
        }
      }

      // Evolve to next generation
      await this.neat.evolve();
      this.generation++;
    }

    this.isTraining = false;

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    this.log(`Training complete. Total time: ${totalTime}s`);

    // Return the best genome
    return this.neat.population[0];
  }

  /**
   * Evaluate all genomes in the population
   */
  private async evaluatePopulation(): Promise<void> {
    if (!this.neat || !this.fitnessFunction) return;

    const population = this.neat.population;

    // Evaluate each genome
    const fitnessPromises = population.map(async (genome) => {
      const fitness = await this.fitnessFunction!(genome, population);
      genome.score = fitness;
      return fitness;
    });

    await Promise.all(fitnessPromises);
  }

  /**
   * Get statistics for the current generation
   */
  private getGenerationStats(startTime: number): GenerationStats {
    if (!this.neat) {
      return {
        generation: 0,
        bestFitness: 0,
        averageFitness: 0,
        worstFitness: 0,
        elapsedTime: 0,
      };
    }

    const population = this.neat.population;
    const scores = population.map(g => g.score || 0);

    return {
      generation: this.generation,
      bestFitness: Math.max(...scores),
      averageFitness: scores.reduce((a, b) => a + b, 0) / scores.length,
      worstFitness: Math.min(...scores),
      elapsedTime: Date.now() - startTime,
    };
  }

  /**
   * Save a checkpoint
   */
  private saveCheckpoint(): void {
    if (!this.neat || !this.onCheckpoint) return;

    const population = this.neat.population;
    const scores = population.map(g => g.score || 0);

    const checkpoint: Checkpoint = {
      generation: this.generation,
      bestFitness: Math.max(...scores),
      averageFitness: scores.reduce((a, b) => a + b, 0) / scores.length,
      bestGenome: population[0].toJSON(),
      population: population.map(g => g.toJSON()),
      config: this.config,
      timestamp: new Date().toISOString(),
    };

    this.onCheckpoint(checkpoint);
  }

  /**
   * Load from a checkpoint and prepare for next generation
   */
  loadCheckpoint(checkpoint: Checkpoint): void {
    // Keep current config (from YAML) - don't overwrite with checkpoint's old config

    // Reconstruct population from checkpoint
    const population = checkpoint.population.map(json => Network.fromJSON(json));

    // Restore scores from checkpoint so evolution can use them
    const scores = population.map((_, i) => {
      const savedGenome = checkpoint.population[i];
      return (savedGenome as unknown as { score?: number }).score || 0;
    });
    population.forEach((genome, i) => {
      genome.score = scores[i];
    });

    // Provide a pass-through fitness function that returns existing scores
    // This is needed because neataptic's evolve() always calls fitness
    const passThroughFitness = (genome: NetworkType) => genome.score || 0;

    this.neat = new Neat(this.config.inputSize, this.config.outputSize, passThroughFitness, {
      population: population,
      popsize: population.length,
      elitism: this.config.elitism,
      mutationRate: this.config.mutationRate,
      mutationAmount: this.config.mutationAmount,
      selection: methods.selection.TOURNAMENT,
      crossover: [
        methods.crossover.SINGLE_POINT,
        methods.crossover.TWO_POINT,
        methods.crossover.UNIFORM,
      ],
      mutation: methods.mutation.FFW,
    } as NeatOptions);

    // Resume from checkpoint generation
    // Set flag to skip re-evaluation on first iteration (already evaluated)
    this.generation = checkpoint.generation;
    this.resumedFromCheckpoint = true;

    this.log(`Loaded checkpoint from generation ${checkpoint.generation}`);
  }

  /**
   * Stop training gracefully
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if currently training
   */
  isCurrentlyTraining(): boolean {
    return this.isTraining;
  }

  /**
   * Get the current generation number
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Get the current population
   */
  getPopulation(): NetworkType[] {
    return this.neat?.population || [];
  }

  /**
   * Get the best genome
   */
  getBestGenome(): NetworkType | null {
    if (!this.neat || this.neat.population.length === 0) return null;
    return this.neat.population[0];
  }

  /**
   * Get the trainer configuration
   */
  getConfig(): TrainerConfig {
    return { ...this.config };
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(...args: any[]): void {
    if (this.config.verbose) {
      console.log('[NEATTrainer]', ...args);
    }
  }
}
