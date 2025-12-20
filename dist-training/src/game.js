// Game class to coordinate all game systems
import { Particle } from './particle';
import { Player } from './player';
import { InputManager } from './input';
import { SpatialHash } from './collision';
import { ConversionSystem } from './conversion';
import { PLAYER_COLORS } from './types';
import { PARTICLE_CONFIG, OBSTACLE_CONFIG, WIN_CONFIG } from './config';
import { RandomGenerator } from './maze/RandomGenerator';
import { GridMazeGenerator } from './maze/GridMazeGenerator';
import { profiler } from './profiler';
export class Game {
    players = [];
    particles = [];
    obstacles = [];
    input;
    spatialHash;
    conversionSystem;
    canvasWidth;
    canvasHeight;
    // Cache conversion data to avoid recalculating every frame
    conversionProgressCache = new Map();
    convertingPlayerColorCache = new Map();
    // Game state
    winner = -1; // -1 = no winner, 0+ = player ID
    headless;
    // AI controllers (one per AI player)
    aiControllers = new Map();
    constructor(config, canvasWidth, canvasHeight, headless = false) {
        this.headless = headless;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.input = new InputManager(headless);
        this.spatialHash = new SpatialHash();
        this.conversionSystem = new ConversionSystem();
        // Create players
        this.initPlayers(config);
        // Create particles and assign to players
        this.initParticles(config);
        // Create obstacles
        this.initObstacles();
        // Only log in non-headless mode
        if (!this.headless) {
            console.log(`Game initialized with ${this.players.length} players`);
            console.log(`Total particles: ${this.particles.length}`);
            console.log(`Obstacles: ${this.obstacles.length}`);
        }
    }
    initPlayers(config) {
        const { playerCount } = config;
        // Spawn positions in an ellipse around the center for equidistant spacing
        const margin = 150;
        const centerX = this.canvasWidth / 2;
        const centerY = this.canvasHeight / 2;
        // Ellipse radii (fit within canvas with margin)
        const radiusX = (this.canvasWidth / 2) - margin;
        const radiusY = (this.canvasHeight / 2) - margin;
        // Generate equidistant spawn positions around the ellipse
        // Start at top (angle = -PI/2) so player 0 is at top
        const spawnPositions = [];
        for (let i = 0; i < playerCount; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / playerCount;
            spawnPositions.push({
                x: centerX + Math.cos(angle) * radiusX,
                y: centerY + Math.sin(angle) * radiusY,
            });
        }
        for (let i = 0; i < playerCount; i++) {
            const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
            const pos = spawnPositions[i];
            this.players.push(new Player(i, color, false, pos.x, pos.y));
        }
    }
    initParticles(config) {
        const { playerCount, particlesPerPlayer } = config;
        // Spawn particles near each player's cursor
        for (let playerId = 0; playerId < playerCount; playerId++) {
            const player = this.players[playerId];
            const spawnRadius = PARTICLE_CONFIG.spawnRadius;
            for (let i = 0; i < particlesPerPlayer; i++) {
                // Random angle and distance from cursor
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * spawnRadius;
                const x = player.cursorX + Math.cos(angle) * distance;
                const y = player.cursorY + Math.sin(angle) * distance;
                const particle = new Particle(x, y);
                particle.owner = player.id;
                particle.color = player.color;
                this.particles.push(particle);
            }
            player.particleCount = particlesPerPlayer;
        }
    }
    initObstacles() {
        // Select generator based on config
        const generator = OBSTACLE_CONFIG.generator === 'grid'
            ? new GridMazeGenerator()
            : new RandomGenerator();
        // Get player spawn positions
        const playerSpawns = this.getPlayerSpawns();
        // Generate obstacles using the selected generator
        this.obstacles = generator.generate(this.canvasWidth, this.canvasHeight, playerSpawns, OBSTACLE_CONFIG);
    }
    /**
     * Get player spawn positions for maze generation
     */
    getPlayerSpawns() {
        return this.players.map(player => ({
            x: player.cursorX,
            y: player.cursorY
        }));
    }
    update(dt) {
        // Update players based on input (human) or AI controllers
        // Track AI actions to profile - only wrap getAction(), not cursor movement
        const aiActions = [];
        profiler.start('update.ai');
        for (let i = 0; i < this.players.length; i++) {
            if (this.aiControllers.has(i)) {
                const ai = this.aiControllers.get(i);
                const action = ai.getAction(this);
                aiActions.push({ player: this.players[i], action });
            }
        }
        profiler.end('update.ai');
        // Apply AI actions and handle human input (outside AI profiling)
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (this.aiControllers.has(i)) {
                // Find the action for this AI player
                const aiAction = aiActions.find(a => a.player === player);
                if (aiAction) {
                    const targetX = aiAction.action.targetX * this.canvasWidth;
                    const targetY = aiAction.action.targetY * this.canvasHeight;
                    player.moveCursorTowards(targetX, targetY, dt, this.canvasWidth, this.canvasHeight);
                }
            }
            else {
                // Human player - use keyboard input
                const input = this.input.getPlayerInput(i);
                player.updateCursor(input, dt, this.canvasWidth, this.canvasHeight);
            }
        }
        // Build spatial hash for efficient collision detection
        profiler.start('update.spatial');
        this.spatialHash.clear();
        for (const particle of this.particles) {
            this.spatialHash.insert(particle);
        }
        profiler.end('update.spatial');
        // Clear conversion caches
        this.conversionProgressCache.clear();
        this.convertingPlayerColorCache.clear();
        // Update particles - each particle follows its owner's cursor
        profiler.start('update.physics');
        for (const particle of this.particles) {
            const owner = this.players[particle.owner];
            if (!owner)
                continue;
            const cursorPos = { x: owner.cursorX, y: owner.cursorY };
            // Query nearby particles from spatial hash (much faster than checking all particles)
            const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);
            particle.update(dt, cursorPos, this.canvasWidth, this.canvasHeight, nearbyParticles, this.obstacles);
        }
        profiler.end('update.physics');
        // Handle conversion system
        profiler.start('update.convert');
        for (const particle of this.particles) {
            const nearbyParticles = this.spatialHash.queryNearby(particle.x, particle.y);
            // Check for conversion
            const shouldConvert = this.conversionSystem.updateConversion(particle, nearbyParticles, dt);
            if (shouldConvert) {
                // Find which player should take ownership
                const newOwner = this.conversionSystem.getDominantEnemyPlayer(particle, nearbyParticles);
                if (newOwner !== -1 && newOwner !== particle.owner) {
                    // Update particle counts
                    this.players[particle.owner].particleCount--;
                    this.players[newOwner].particleCount++;
                    // Transfer ownership
                    particle.owner = newOwner;
                    particle.color = this.players[newOwner].color;
                }
            }
            // Cache conversion data for rendering (avoid recalculating each frame)
            const progress = this.conversionSystem.getProgress(particle);
            if (progress > 0) {
                this.conversionProgressCache.set(particle, progress);
                // Find dominant enemy player for color
                const dominantPlayer = this.conversionSystem.getDominantEnemyPlayer(particle, nearbyParticles);
                if (dominantPlayer !== -1) {
                    this.convertingPlayerColorCache.set(particle, this.players[dominantPlayer].color);
                }
            }
        }
        profiler.end('update.convert');
        // Check win condition
        if (this.winner === -1) {
            this.checkWinCondition();
        }
    }
    checkWinCondition() {
        const totalParticles = this.particles.length;
        if (WIN_CONFIG.mode === 'elimination') {
            // Elimination mode: player loses when they have <= threshold particles
            for (const player of this.players) {
                if (player.particleCount <= WIN_CONFIG.eliminationThreshold) {
                    // Find the winner (player with most particles remaining)
                    let maxParticles = -1;
                    for (const p of this.players) {
                        if (p.particleCount > maxParticles) {
                            maxParticles = p.particleCount;
                            this.winner = p.id;
                        }
                    }
                    if (!this.headless) {
                        console.log(`Player ${this.winner + 1} wins by elimination!`);
                    }
                    break;
                }
            }
        }
        else if (WIN_CONFIG.mode === 'percentage') {
            // Percentage mode: player wins when they control X% of all particles
            for (const player of this.players) {
                const percentage = player.particleCount / totalParticles;
                if (percentage >= WIN_CONFIG.percentageThreshold) {
                    this.winner = player.id;
                    if (!this.headless) {
                        console.log(`Player ${this.winner + 1} wins with ${(percentage * 100).toFixed(1)}% of particles!`);
                    }
                    break;
                }
            }
        }
    }
    getPlayers() {
        return this.players;
    }
    getParticles() {
        return this.particles;
    }
    getObstacles() {
        return this.obstacles;
    }
    getSpatialHashStats() {
        return {
            cellCount: this.spatialHash.getCellCount(),
            particleCount: this.spatialHash.getCount()
        };
    }
    getConversionProgress(particle) {
        return this.conversionSystem.getProgress(particle);
    }
    getConversionProgressMap() {
        return this.conversionProgressCache;
    }
    getConvertingPlayerColorMap() {
        return this.convertingPlayerColorCache;
    }
    isGameOver() {
        return this.winner !== -1;
    }
    getWinner() {
        return this.winner;
    }
    getWinnerPlayer() {
        if (this.winner === -1)
            return null;
        return this.players[this.winner];
    }
    destroy() {
        this.input.destroy();
    }
    /**
     * Set an AI controller for a player
     * @param playerId The player ID to control
     * @param controller The AI controller to use
     */
    setAIController(playerId, controller) {
        if (playerId < 0 || playerId >= this.players.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        this.aiControllers.set(playerId, controller);
        this.players[playerId].isAI = true;
        if (!this.headless) {
            console.log(`AI controller set for player ${playerId + 1}: ${controller.getName()}`);
        }
    }
    /**
     * Remove an AI controller from a player
     * @param playerId The player ID to remove AI from
     */
    removeAIController(playerId) {
        this.aiControllers.delete(playerId);
        if (playerId >= 0 && playerId < this.players.length) {
            this.players[playerId].isAI = false;
        }
    }
    /**
     * Check if a player has an AI controller
     */
    hasAIController(playerId) {
        return this.aiControllers.has(playerId);
    }
    /**
     * Get the canvas dimensions
     */
    getCanvasSize() {
        return { width: this.canvasWidth, height: this.canvasHeight };
    }
}
//# sourceMappingURL=game.js.map