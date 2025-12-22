// Network protocol types and binary encoding/decoding
// Uses Transferable ArrayBuffer for zero-copy transfer between worker and main thread

import type { ScenarioConfig } from '../scenario';
import type { ObstacleData } from '../types';

// ============================================================================
// Message Types (JSON for control messages, binary for frame data)
// ============================================================================

// Server → Client messages
export interface WelcomeMessage {
  type: 'welcome';
  role: 'player' | 'observer';
  playerId?: number;
}

export interface LoadScenarioMessage {
  type: 'load_scenario';
  scenario: ScenarioConfig;
  obstacles: ObstacleData[];
}

export interface GameStartMessage {
  type: 'game_start';
  canvasWidth: number;
  canvasHeight: number;
  playerCount: number;
  playerColors: string[];
}

export interface FrameMessage {
  type: 'frame';
  buffer: ArrayBuffer;
}

export interface GameOverMessage {
  type: 'game_over';
  winner: number;
  stats: {
    steps: number;
    duration: number;
    finalCounts: number[];
  };
}

// Sent when a scenario in a queue completes
export interface ScenarioCompleteMessage {
  type: 'scenario_complete';
  scenarioIndex: number;
  totalScenarios: number;
  scenarioName: string;
  winner: number;
  stats: {
    steps: number;
    duration: number;
    finalCounts: number[];
  };
}

// Sent when all scenarios in queue are done
export interface QueueCompleteMessage {
  type: 'queue_complete';
  results: Array<{
    scenarioName: string;
    winner: number;
    steps: number;
    duration: number;
    finalCounts: number[];
  }>;
}

export interface BufferReturnMessage {
  type: 'buffer_return';
  buffer: ArrayBuffer;
}

export type ServerMessage =
  | WelcomeMessage
  | LoadScenarioMessage
  | GameStartMessage
  | FrameMessage
  | GameOverMessage
  | ScenarioCompleteMessage
  | QueueCompleteMessage;

// Client → Server messages
export interface JoinMessage {
  type: 'join';
  name?: string;
}

export interface ReadyMessage {
  type: 'ready';
}

export interface InputMessage {
  type: 'input';
  cursorX: number;
  cursorY: number;
}

export interface StartGameMessage {
  type: 'start';
  scenario?: ScenarioConfig;
}

export interface StartQueueMessage {
  type: 'start_queue';
  scenarios: ScenarioConfig[];
  delayBetweenMs?: number; // Delay between scenarios (default: 2000ms)
}

export type ClientMessage =
  | JoinMessage
  | ReadyMessage
  | InputMessage
  | StartGameMessage
  | StartQueueMessage
  | BufferReturnMessage;

// ============================================================================
// Binary Frame Format
// ============================================================================

// Layout:
// Header (20 bytes):
//   [0-3]   uint32  step number
//   [4-5]   uint16  particle count
//   [6]     uint8   player count
//   [7]     uint8   flags (bit 0: gameOver, bits 1-3: winner+1, so 0=no winner)
//   [8-11]  float32 canvasWidth
//   [12-15] float32 canvasHeight
//   [16-19] reserved
//
// Per-Player (12 bytes each, up to 4 players = 48 bytes):
//   [0-3]   float32 cursorX (absolute pixels)
//   [4-7]   float32 cursorY (absolute pixels)
//   [8-9]   uint16  particleCount
//   [10]    uint8   colorIndex
//   [11]    reserved
//
// Per-Particle (9 bytes each):
//   [0-3]   float32 x
//   [4-7]   float32 y
//   [8]     uint8   owner

export const HEADER_SIZE = 20;
export const PLAYER_SIZE = 12;
export const PARTICLE_SIZE = 9;
export const MAX_PLAYERS = 4;

// Flags bit layout
const FLAG_GAME_OVER = 0x01;
const WINNER_SHIFT = 1;
const WINNER_MASK = 0x0E; // bits 1-3

export interface FrameData {
  step: number;
  canvasWidth: number;
  canvasHeight: number;
  gameOver: boolean;
  winner: number; // -1 if no winner
  players: Array<{
    cursorX: number;
    cursorY: number;
    particleCount: number;
    colorIndex: number;
  }>;
  particles: Array<{
    x: number;
    y: number;
    owner: number;
  }>;
}

/**
 * Calculate buffer size needed for a frame
 */
export function calculateBufferSize(particleCount: number, playerCount: number): number {
  return HEADER_SIZE + (playerCount * PLAYER_SIZE) + (particleCount * PARTICLE_SIZE);
}

/**
 * Encode game state into a binary buffer
 * Reuses the provided buffer if large enough, otherwise allocates new one
 */
export function encodeFrame(
  data: FrameData,
  existingBuffer?: ArrayBuffer
): ArrayBuffer {
  const particleCount = data.particles.length;
  const playerCount = data.players.length;
  const requiredSize = calculateBufferSize(particleCount, playerCount);

  // Reuse buffer or allocate new one
  const buffer = (existingBuffer && existingBuffer.byteLength >= requiredSize)
    ? existingBuffer
    : new ArrayBuffer(requiredSize);

  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Write header
  view.setUint32(0, data.step, true);
  view.setUint16(4, particleCount, true);
  uint8[6] = playerCount;

  // Pack flags
  let flags = 0;
  if (data.gameOver) flags |= FLAG_GAME_OVER;
  if (data.winner >= 0) {
    flags |= ((data.winner + 1) << WINNER_SHIFT) & WINNER_MASK;
  }
  uint8[7] = flags;

  view.setFloat32(8, data.canvasWidth, true);
  view.setFloat32(12, data.canvasHeight, true);
  // bytes 16-19 reserved

  // Write players
  let offset = HEADER_SIZE;
  for (let i = 0; i < playerCount; i++) {
    const player = data.players[i];
    view.setFloat32(offset, player.cursorX, true);
    view.setFloat32(offset + 4, player.cursorY, true);
    view.setUint16(offset + 8, player.particleCount, true);
    uint8[offset + 10] = player.colorIndex;
    // byte 11 reserved
    offset += PLAYER_SIZE;
  }

  // Write particles
  for (let i = 0; i < particleCount; i++) {
    const particle = data.particles[i];
    view.setFloat32(offset, particle.x, true);
    view.setFloat32(offset + 4, particle.y, true);
    uint8[offset + 8] = particle.owner;
    offset += PARTICLE_SIZE;
  }

  return buffer;
}

/**
 * Decode a binary buffer into frame data
 */
export function decodeFrame(buffer: ArrayBuffer): FrameData {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Read header
  const step = view.getUint32(0, true);
  const particleCount = view.getUint16(4, true);
  const playerCount = uint8[6];
  const flags = uint8[7];

  const gameOver = (flags & FLAG_GAME_OVER) !== 0;
  const winnerPacked = (flags & WINNER_MASK) >> WINNER_SHIFT;
  const winner = winnerPacked > 0 ? winnerPacked - 1 : -1;

  const canvasWidth = view.getFloat32(8, true);
  const canvasHeight = view.getFloat32(12, true);

  // Read players
  const players: FrameData['players'] = [];
  let offset = HEADER_SIZE;
  for (let i = 0; i < playerCount; i++) {
    players.push({
      cursorX: view.getFloat32(offset, true),
      cursorY: view.getFloat32(offset + 4, true),
      particleCount: view.getUint16(offset + 8, true),
      colorIndex: uint8[offset + 10],
    });
    offset += PLAYER_SIZE;
  }

  // Read particles
  const particles: FrameData['particles'] = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true),
      owner: uint8[offset + 8],
    });
    offset += PARTICLE_SIZE;
  }

  return {
    step,
    canvasWidth,
    canvasHeight,
    gameOver,
    winner,
    players,
    particles,
  };
}

/**
 * Create initial double buffers for a game
 */
export function createDoubleBuffers(particleCount: number, playerCount: number): [ArrayBuffer, ArrayBuffer] {
  const size = calculateBufferSize(particleCount, playerCount);
  return [new ArrayBuffer(size), new ArrayBuffer(size)];
}
