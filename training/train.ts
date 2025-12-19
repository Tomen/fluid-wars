// Training entry point for NEAT AI evolution
// Run with: npx ts-node training/train.ts

import * as fs from 'fs';
import * as path from 'path';
import { NEATTrainer, Checkpoint } from '../src/training/NEATTrainer';
import { createFitnessFunction } from '../src/training/FitnessEvaluator';
import {
  TRAINER_CONFIG,
  EVALUATOR_CONFIG,
  DIFFICULTY_TIERS,
  MODEL_OUTPUT_DIR,
  CHECKPOINT_DIR,
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

  // Check if this generation matches a difficulty tier
  for (const [tier, config] of Object.entries(DIFFICULTY_TIERS)) {
    if (checkpoint.generation === config.generation) {
      const modelPath = path.join(MODEL_OUTPUT_DIR, config.filename);
      fs.writeFileSync(modelPath, JSON.stringify(checkpoint.bestGenome, null, 2));
      console.log(`Saved ${tier} difficulty model: ${modelPath}`);
    }
  }
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
  console.log('Fluid Wars AI Training');
  console.log('='.repeat(60));
  console.log();

  // Ensure directories exist
  ensureDirectories();

  // Create trainer
  const trainer = new NEATTrainer(TRAINER_CONFIG);

  // Check for existing checkpoint
  const checkpoint = loadLatestCheckpoint();
  if (checkpoint) {
    console.log(`Resuming from generation ${checkpoint.generation}`);
    trainer.loadCheckpoint(checkpoint);
  } else {
    console.log('Starting fresh training');
    trainer.initialize();
  }

  // Set up fitness function
  const fitnessFunction = createFitnessFunction(EVALUATOR_CONFIG);
  trainer.setFitnessFunction(fitnessFunction);

  // Set up generation callback
  trainer.setGenerationCallback((stats, _best) => {
    // Log progress
    const progress = (stats.generation / (TRAINER_CONFIG.maxGenerations || 500) * 100).toFixed(1);
    console.log(
      `[${progress}%] Gen ${stats.generation}: ` +
      `Best=${stats.bestFitness.toFixed(1)}, ` +
      `Avg=${stats.averageFitness.toFixed(1)}, ` +
      `Time=${stats.elapsedTime}ms`
    );
  });

  // Set up checkpoint callback
  trainer.setCheckpointCallback(saveCheckpoint);

  // Handle graceful shutdown
  let shuttingDown = false;
  process.on('SIGINT', () => {
    if (shuttingDown) {
      console.log('\nForce quitting...');
      process.exit(1);
    }
    shuttingDown = true;
    console.log('\nGracefully shutting down (press Ctrl+C again to force)...');
    trainer.stop();
  });

  // Start training
  console.log();
  console.log('Training configuration:');
  console.log(`  Population size: ${TRAINER_CONFIG.populationSize}`);
  console.log(`  Max generations: ${TRAINER_CONFIG.maxGenerations}`);
  console.log(`  Input size: ${TRAINER_CONFIG.inputSize}`);
  console.log(`  Matches per evaluation: ${EVALUATOR_CONFIG.matchesPerEvaluation}`);
  console.log();

  const startTime = Date.now();

  try {
    const bestGenome = await trainer.train();

    // Save final best model
    const finalModelPath = path.join(MODEL_OUTPUT_DIR, 'ai_final.json');
    fs.writeFileSync(finalModelPath, JSON.stringify(bestGenome.toJSON(), null, 2));
    console.log(`Saved final model: ${finalModelPath}`);

  } catch (error) {
    console.error('Training error:', error);
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log();
  console.log('='.repeat(60));
  console.log(`Training complete! Total time: ${totalTime} minutes`);
  console.log('='.repeat(60));
}

// Run main
main().catch(console.error);
