// NeuralAI - Neural network-based AI controller

import neataptic from 'neataptic';
import type { Network as NetworkType, NetworkJSON } from 'neataptic';
const { Network } = neataptic;
import type { Game } from '../game';
import type { AIAction } from '../core/AIInterface';
import type { AIController } from './AIController';
import { ObservationEncoder, EncoderConfig } from './ObservationEncoder';

/**
 * Neural network-based AI controller
 *
 * Uses a NEAT-evolved neural network to make decisions.
 * The network takes encoded game state as input and outputs
 * a target cursor position.
 */
export class NeuralAI implements AIController {
  readonly playerId: number;
  private network: NetworkType;
  private encoder: ObservationEncoder;
  private name: string;

  /**
   * Create a NeuralAI controller
   *
   * @param playerId The player ID this AI controls
   * @param network The neural network to use for decisions
   * @param encoderConfig Configuration for the observation encoder
   * @param name Optional name for this AI instance
   */
  constructor(
    playerId: number,
    network: NetworkType,
    encoderConfig?: Partial<EncoderConfig>,
    name?: string
  ) {
    this.playerId = playerId;
    this.network = network;
    this.encoder = new ObservationEncoder(encoderConfig);
    this.name = name || 'NeuralAI';
  }

  getName(): string {
    return this.name;
  }

  /**
   * Get the AI's action for the current game state
   *
   * @param game The current game instance
   * @returns Action with normalized target position
   */
  getAction(game: Game): AIAction {
    // Encode the game state from this player's perspective
    const observation = this.encoder.encode(game, this.playerId);

    // Activate the neural network
    const outputs = this.network.activate(observation);

    // Network outputs are expected to be in [0, 1] range
    // but may be outside due to activation functions, so clamp
    const targetX = clamp(outputs[0], 0, 1);
    const targetY = clamp(outputs[1], 0, 1);

    return {
      targetX,
      targetY,
    };
  }

  /**
   * Reset the network's internal state
   */
  reset(): void {
    this.network.clear();
  }

  /**
   * Get the underlying neural network
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Set a new neural network
   */
  setNetwork(network: NetworkType): void {
    this.network = network;
  }

  /**
   * Export the network to JSON for saving
   */
  exportNetwork(): NetworkJSON {
    return this.network.toJSON();
  }

  /**
   * Create a NeuralAI from a saved network JSON
   */
  static fromJSON(
    playerId: number,
    json: NetworkJSON,
    encoderConfig?: Partial<EncoderConfig>,
    name?: string
  ): NeuralAI {
    const network = Network.fromJSON(json);
    return new NeuralAI(playerId, network, encoderConfig, name);
  }

  /**
   * Get the expected input size for the neural network
   */
  static getInputSize(encoderConfig?: Partial<EncoderConfig>): number {
    const encoder = new ObservationEncoder(encoderConfig);
    return encoder.getObservationSize();
  }

  /**
   * Get the expected output size for the neural network
   */
  static getOutputSize(): number {
    return 2; // targetX, targetY
  }
}

/**
 * Clamp a value to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
