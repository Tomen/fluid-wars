// Sync the latest checkpoint to the public model file
// Run before dev server to ensure latest AI model is loaded

import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_DIR = './training/checkpoints';
const MODEL_OUTPUT = './public/models/ai_easy.json';

function findLatestCheckpoint(): string | null {
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

  return path.join(CHECKPOINT_DIR, files[0]);
}

function syncModel(): void {
  const latestCheckpointPath = findLatestCheckpoint();

  if (!latestCheckpointPath) {
    console.log('[sync-model] No checkpoints found, skipping sync');
    return;
  }

  try {
    const checkpoint = JSON.parse(fs.readFileSync(latestCheckpointPath, 'utf8'));

    // Create model file with metadata
    const modelFile = {
      generation: checkpoint.generation,
      bestFitness: checkpoint.bestFitness,
      averageFitness: checkpoint.averageFitness,
      network: checkpoint.bestGenome,
    };

    // Ensure output directory exists
    const outputDir = path.dirname(MODEL_OUTPUT);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(MODEL_OUTPUT, JSON.stringify(modelFile, null, 2));

    console.log(`[sync-model] Synced model from generation ${checkpoint.generation}`);
    console.log(`  Best: ${checkpoint.bestFitness?.toFixed(1) ?? '?'} | Avg: ${checkpoint.averageFitness?.toFixed(1) ?? '?'}`);
  } catch (error) {
    console.error('[sync-model] Error syncing model:', error);
  }
}

syncModel();
