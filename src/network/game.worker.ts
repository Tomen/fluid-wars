// Web Worker entry point for game simulation
// Vite automatically handles this as a worker module

/// <reference lib="webworker" />

import { GameWorker } from './GameWorker';
import type { ClientMessage } from './protocol';

// Create game worker instance
const gameWorker = new GameWorker({
  frameRate: 30,
});

// Handle incoming messages
self.onmessage = (e: MessageEvent<ClientMessage>) => {
  gameWorker.handleMessage(e.data);
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
