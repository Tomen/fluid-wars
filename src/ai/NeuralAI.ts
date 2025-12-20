// NeuralAI - CNN-based AI controller using TensorFlow.js

import * as tf from '@tensorflow/tfjs';
import type { Game } from '../game';
import type { AIAction } from '../core/AIInterface';
import type { AIController } from './AIController';
import { ObservationEncoder, EncoderConfig } from './ObservationEncoder';
import { predict } from './CNNModel';

/**
 * Neural network-based AI controller using CNN
 *
 * Uses a TensorFlow.js CNN to make decisions.
 * The network takes a 3D grid observation as input and outputs
 * a target cursor position.
 */
export class NeuralAI implements AIController {
  readonly playerId: number;
  private model: tf.Sequential;
  private encoder: ObservationEncoder;
  private name: string;

  /**
   * Create a NeuralAI controller
   *
   * @param playerId The player ID this AI controls
   * @param model The TensorFlow.js CNN model to use for decisions
   * @param encoderConfig Configuration for the observation encoder
   * @param name Optional name for this AI instance
   */
  constructor(
    playerId: number,
    model: tf.Sequential,
    encoderConfig?: Partial<EncoderConfig>,
    name?: string
  ) {
    this.playerId = playerId;
    this.model = model;
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
    // Encode the game state as 3D grid from this player's perspective
    const observation = this.encoder.encode3D(game, this.playerId);

    // Run CNN prediction
    const [targetX, targetY] = predict(this.model, observation);

    // Output is already in [0, 1] range due to sigmoid activation
    return {
      targetX,
      targetY,
    };
  }

  /**
   * Reset - no-op for CNN (no internal state)
   */
  reset(): void {
    // CNN has no recurrent state to reset
  }

  /**
   * Get the underlying TensorFlow model
   */
  getModel(): tf.Sequential {
    return this.model;
  }

  /**
   * Set a new TensorFlow model
   */
  setModel(model: tf.Sequential): void {
    this.model = model;
  }

  /**
   * Get the expected output size for the neural network
   */
  static getOutputSize(): number {
    return 2; // targetX, targetY
  }
}
