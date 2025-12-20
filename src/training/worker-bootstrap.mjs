// Bootstrap file for worker threads
// This registers tsx loader then dynamically imports the TypeScript worker

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register tsx loader for ESM
register('tsx/esm', pathToFileURL('./'));

// Dynamically import the TypeScript worker after tsx is registered
const workerPath = join(__dirname, 'evaluator.worker.ts');
await import(pathToFileURL(workerPath).href);
