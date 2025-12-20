// NeuralAI - CNN-based AI controller using TensorFlow.js
import { ObservationEncoder } from './ObservationEncoder';
import { predict } from './CNNModel';
import { profiler } from '../profiler';
/**
 * Neural network-based AI controller using CNN
 *
 * Uses a TensorFlow.js CNN to make decisions.
 * The network takes a 3D grid observation as input and outputs
 * a target cursor position.
 */
export class NeuralAI {
    playerId;
    model;
    encoder;
    name;
    /**
     * Create a NeuralAI controller
     *
     * @param playerId The player ID this AI controls
     * @param model The TensorFlow.js CNN model to use for decisions
     * @param encoderConfig Configuration for the observation encoder
     * @param name Optional name for this AI instance
     */
    constructor(playerId, model, encoderConfig, name) {
        this.playerId = playerId;
        this.model = model;
        this.encoder = new ObservationEncoder(encoderConfig);
        this.name = name || 'NeuralAI';
    }
    getName() {
        return this.name;
    }
    /**
     * Get the AI's action for the current game state
     *
     * @param game The current game instance
     * @returns Action with normalized target position
     */
    getAction(game) {
        // Encode the game state as 3D grid from this player's perspective
        profiler.start('update.ai.encode');
        const observation = this.encoder.encode3D(game, this.playerId);
        profiler.end('update.ai.encode');
        // Run CNN prediction
        profiler.start('update.ai.predict');
        const [targetX, targetY] = predict(this.model, observation);
        profiler.end('update.ai.predict');
        // Output is already in [0, 1] range due to sigmoid activation
        return {
            targetX,
            targetY,
        };
    }
    /**
     * Reset - no-op for CNN (no internal state)
     */
    reset() {
        // CNN has no recurrent state to reset
    }
    /**
     * Get the underlying TensorFlow model
     */
    getModel() {
        return this.model;
    }
    /**
     * Set a new TensorFlow model
     */
    setModel(model) {
        this.model = model;
    }
    /**
     * Get the expected output size for the neural network
     */
    static getOutputSize() {
        return 2; // targetX, targetY
    }
}
//# sourceMappingURL=NeuralAI.js.map