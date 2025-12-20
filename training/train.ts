// Training entry point for CNN AI evolution
// Run with: npm run train

// Setup environment (adds TensorFlow DLL to PATH on Windows)
import './setup-env.js';

// Import TensorFlow.js with native Node.js backend
import * as tf from '@tensorflow/tfjs-node';
console.log('Using TensorFlow.js backend:', tf.getBackend());

import * as fs from 'fs';
import * as path from 'path';
import { GeneticTrainer, Checkpoint } from '../src/training/GeneticTrainer';
import { getWeights, weightsToJSON } from '../src/ai/CNNModel';
import {
  TRAINING_CONFIG,
  DIFFICULTY_TIERS,
  MODEL_OUTPUT_DIR,
  CHECKPOINT_DIR,
  CNN_CONFIG,
} from './config';

// Ensure output directories exist
function ensureDirectories(): void {
  const dirs = [MODEL_OUTPUT_DIR, CHECKPOINT_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

// Save a checkpoint to disk
function saveCheckpoint(checkpoint: Checkpoint): void {
  const filename = path.join(CHECKPOINT_DIR, `checkpoint_gen_${checkpoint.generation}.json`);
  fs.writeFileSync(filename, JSON.stringify(checkpoint, null, 2));
  console.log(`Saved checkpoint: ${filename}`);
}

// Save the best model weights
function saveBestModel(trainer: GeneticTrainer, generation: number, fitness: number, avgFitness: number): void {
  const model = trainer.getBestModel();
  const weights = getWeights(model);

  // Save to ai_easy.json (always updated with latest best)
  const modelData = {
    generation,
    bestFitness: fitness,
    averageFitness: avgFitness,
    weights: weightsToJSON(weights),
  };

  const latestPath = path.join(MODEL_OUTPUT_DIR, 'ai_easy.json');
  fs.writeFileSync(latestPath, JSON.stringify(modelData, null, 2));
  console.log(`Updated latest model: ${latestPath} (gen ${generation})`);

  // Check difficulty tier saves
  for (const [tier, config] of Object.entries(DIFFICULTY_TIERS)) {
    if (tier !== 'easy' && generation === config.generation) {
      const tierPath = path.join(MODEL_OUTPUT_DIR, config.filename);
      fs.writeFileSync(tierPath, JSON.stringify(modelData, null, 2));
      console.log(`Saved ${tier} difficulty model: ${tierPath}`);
    }
  }

  model.dispose();
}

// Load the latest checkpoint if available
function loadLatestCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    return null;
  }

  const files = fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.startsWith('checkpoint_gen_') && f.endsWith('.json'))
    .sort((a, b) => {
      const genA = parseInt(a.match(/gen_(\d+)/)?.[1] || '0');
      const genB = parseInt(b.match(/gen_(\d+)/)?.[1] || '0');
      return genB - genA; // Descending order
    });

  if (files.length === 0) {
    return null;
  }

  const latestFile = path.join(CHECKPOINT_DIR, files[0]);
  console.log(`Loading checkpoint: ${latestFile}`);

  const data = fs.readFileSync(latestFile, 'utf-8');
  return JSON.parse(data) as Checkpoint;
}

// Main training function
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Fluid Wars AI Training (CNN + Genetic Algorithm)');
  console.log('='.repeat(60));
  console.log();

  // Ensure directories exist
  ensureDirectories();

  // Create trainer with evaluator config
  const trainer = new GeneticTrainer({
    matchesPerEvaluation: TRAINING_CONFIG.matchesPerGenome,
    maxStepsPerMatch: TRAINING_CONFIG.maxGameSteps,
    stepsPerSecond: TRAINING_CONFIG.stepsPerSecond,
    simulatorConfig: {
      ...TRAINING_CONFIG.simulator,
      // Use CNN grid dimensions to ensure model input shape matches
      gridRows: CNN_CONFIG.gridRows,
      gridCols: CNN_CONFIG.gridCols,
    },
    encoderConfig: {
      gridRows: CNN_CONFIG.gridRows,
      gridCols: CNN_CONFIG.gridCols,
      // Must match simulator canvas dimensions
      canvasWidth: TRAINING_CONFIG.simulator.canvasWidth,
      canvasHeight: TRAINING_CONFIG.simulator.canvasHeight,
    },
  });

  // Check for existing checkpoint
  const checkpoint = loadLatestCheckpoint();
  if (checkpoint) {
    console.log(`Found checkpoint at generation ${checkpoint.generation}`);
    trainer.loadCheckpoint(checkpoint);
  } else {
    console.log('Starting fresh training');
    trainer.initialize();
  }

  // Display configuration
  console.log();
  console.log('Training configuration:');
  console.log(`  Population size: ${TRAINING_CONFIG.populationSize}`);
  console.log(`  Max generations: ${TRAINING_CONFIG.maxGenerations}`);
  console.log(`  Matches per genome: ${TRAINING_CONFIG.matchesPerGenome}`);
  console.log(`  Mutation rate: ${TRAINING_CONFIG.mutationRate}`);
  console.log(`  Crossover rate: ${TRAINING_CONFIG.crossoverRate}`);
  console.log();

  const startTime = Date.now();
  let running = true;

  // Handle graceful shutdown via Ctrl+C
  let ctrlCCount = 0;
  process.on('SIGINT', () => {
    ctrlCCount++;
    if (ctrlCCount >= 2) {
      console.log('\nForce quitting...');
      process.exit(1);
    }
    running = false;
    console.log('\nStopping... Press Ctrl+C again to force quit immediately.');

    // Force exit after 5 seconds if still running
    setTimeout(() => {
      console.log('\nTimeout - force exiting...');
      process.exit(1);
    }, 5000);
  });

  // Stop file path - create this file to stop training
  const stopFilePath = path.join(CHECKPOINT_DIR, 'STOP');

  // Clean up any existing stop file
  if (fs.existsSync(stopFilePath)) {
    fs.unlinkSync(stopFilePath);
  }

  // Function to check for stop signal
  const checkStopSignal = (): boolean => {
    if (fs.existsSync(stopFilePath)) {
      fs.unlinkSync(stopFilePath); // Clean up
      return true;
    }
    return false;
  };

  console.log(`To stop training: create file "${stopFilePath}" or press Ctrl+C\n`);

  // Training loop
  const startGen = trainer.getGeneration();
  while (running && trainer.getGeneration() < TRAINING_CONFIG.maxGenerations) {
    // Check for stop signal before each generation
    if (checkStopSignal()) {
      console.log('\nStop file detected. Stopping after current generation...');
      running = false;
      break;
    }

    const gen = trainer.getGeneration();
    const progress = ((gen / TRAINING_CONFIG.maxGenerations) * 100).toFixed(1);

    // Run one generation
    const stats = await trainer.runGeneration();

    // Log progress
    console.log(
      `[${progress}%] Gen ${stats.generation}: ` +
      `Best=${stats.bestFitness.toFixed(1)}, ` +
      `Avg=${stats.averageFitness.toFixed(1)}, ` +
      `Time=${(stats.elapsedTime / 1000).toFixed(1)}s`
    );

    // Save checkpoint at interval
    if ((stats.generation + 1) % TRAINING_CONFIG.checkpointInterval === 0) {
      const cp = trainer.createCheckpoint();
      saveCheckpoint(cp);
      saveBestModel(trainer, cp.generation, cp.bestFitness, cp.averageFitness);
    }
  }

  // Save final checkpoint
  const finalCheckpoint = trainer.createCheckpoint();
  saveCheckpoint(finalCheckpoint);
  saveBestModel(trainer, finalCheckpoint.generation, finalCheckpoint.bestFitness, finalCheckpoint.averageFitness);

  // Cleanup
  trainer.destroy();

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log();
  console.log('='.repeat(60));
  console.log(`Training complete! Total time: ${totalTime} minutes`);
  console.log(`Trained ${trainer.getGeneration() - startGen} generations`);
  console.log('='.repeat(60));
}

// Run main
main().catch(console.error);
