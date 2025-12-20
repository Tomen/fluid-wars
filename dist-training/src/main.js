// Fluid Wars - Main Application Entry Point
import { PLAYER_COLOR_NAMES } from './types';
import { Game } from './game';
import { Renderer, POWER_BAR_HEIGHT } from './renderer';
import { GAME_CONFIG, GAME_LOOP_CONFIG, AI_CONFIG } from './config';
import { AggressiveAI, RandomAI } from './ai/AIController';
import { NeuralAI } from './ai/NeuralAI';
import { loadModelWithMetadata, isModelAvailable, clearModelCache } from './ai/ModelLoader';
import { ObservationEncoder } from './ai/ObservationEncoder';
import { profiler } from './profiler';
import { UIManager, PerformancePanel, GameInfoPanel, PowerBarPanel, AIInfoPanel, AIObservationPanel, VictoryPanel, } from './ui';
class App {
    state = 'playing'; // Start in playing state for now
    canvas;
    renderer;
    lastTime = 0;
    accumulator = 0;
    frameCount = 0;
    fps = 0;
    fpsTime = 0;
    // Game state
    game = null;
    // AI metadata (for displaying generation info)
    aiModelMetadata = null;
    // AI observation overlay
    showObservationOverlay = false;
    observationEncoder;
    // UI Manager
    ui;
    constructor() {
        // Get canvas element
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        // Resize canvas to fit window (with small padding)
        const padding = 20;
        this.canvas.width = window.innerWidth - padding * 2;
        this.canvas.height = window.innerHeight - padding * 2;
        // Create renderer
        this.renderer = new Renderer(this.canvas);
        // Create game with config
        const config = {
            playerCount: GAME_CONFIG.playerCount,
            particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
        };
        this.game = new Game(config, this.renderer.width, this.renderer.gameHeight);
        // Initialize observation encoder with actual canvas dimensions
        this.observationEncoder = new ObservationEncoder({
            canvasWidth: this.renderer.width,
            canvasHeight: this.renderer.gameHeight
        });
        // Initialize UI Manager
        this.ui = new UIManager();
        this.setupUI();
        // Setup keyboard listeners
        window.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                if (this.state === 'gameover') {
                    this.restartGame();
                }
            }
            // Toggle AI observation overlay
            if (e.key === 'v' || e.key === 'V') {
                this.showObservationOverlay = !this.showObservationOverlay;
                this.ui.setPanelVisible('aiObservation', this.showObservationOverlay);
            }
        });
        // Setup mouse click listener for UI panels
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.ui.handleClick(x, y);
        });
        console.log('Fluid Wars initialized');
        console.log(`Canvas size: ${this.renderer.width}x${this.renderer.height}`);
    }
    setupUI() {
        // Configure responsive column layout
        this.ui.setColumnLayout(POWER_BAR_HEIGHT + 10, 10);
        // Power bar at top (render first, behind everything)
        this.ui.addPanel('powerBar', new PowerBarPanel(this.renderer.width));
        // Left column panels (will stack dynamically)
        this.ui.addPanel('performance', new PerformancePanel(10, POWER_BAR_HEIGHT + 10));
        this.ui.addToLeftColumn('performance');
        this.ui.addPanel('gameInfo', new GameInfoPanel(10, 0)); // Y will be set by layout
        this.ui.addToLeftColumn('gameInfo');
        this.ui.addPanel('aiInfo', new AIInfoPanel(10, 0)); // Y will be set by layout
        this.ui.addToLeftColumn('aiInfo');
        // Right column panels
        const aiObsPanel = new AIObservationPanel(0, 0); // Position will be set by layout
        aiObsPanel.setVisible(false);
        this.ui.addPanel('aiObservation', aiObsPanel);
        this.ui.addToRightColumn('aiObservation');
        // Victory panel (overlay, hidden by default) - not in a column
        this.ui.addPanel('victory', new VictoryPanel(this.renderer.width, this.renderer.height));
    }
    async init() {
        // Setup AI controllers if enabled
        if (AI_CONFIG.enabled && this.game) {
            await this.setupAIControllers();
        }
        // Start the game loop
        requestAnimationFrame((time) => this.loop(time));
    }
    async setupAIControllers() {
        if (!this.game)
            return;
        // Clear previous AI metadata
        this.aiModelMetadata = null;
        for (const playerId of AI_CONFIG.aiPlayers) {
            if (playerId < 0 || playerId >= GAME_CONFIG.playerCount) {
                console.warn(`Invalid AI player ID: ${playerId}, skipping`);
                continue;
            }
            let controller;
            if (AI_CONFIG.defaultAIType === 'neural') {
                // Try to load neural AI model
                try {
                    const modelAvailable = await isModelAvailable(AI_CONFIG.neuralDifficulty);
                    if (modelAvailable) {
                        const { model, metadata } = await loadModelWithMetadata(AI_CONFIG.neuralDifficulty);
                        controller = new NeuralAI(playerId, model);
                        // Store metadata for UI display (only need to store once since all AI use same model)
                        this.aiModelMetadata = metadata;
                        const genInfo = metadata.generation !== null ? ` gen ${metadata.generation}` : '';
                        console.log(`Player ${playerId + 1}: Neural AI (${AI_CONFIG.neuralDifficulty}${genInfo})`);
                    }
                    else {
                        // Fall back to aggressive AI
                        console.warn(`Neural model not available for ${AI_CONFIG.neuralDifficulty}, falling back to AggressiveAI`);
                        controller = new AggressiveAI(playerId);
                    }
                }
                catch (error) {
                    console.error(`Failed to load neural AI:`, error);
                    controller = new AggressiveAI(playerId);
                }
            }
            else if (AI_CONFIG.defaultAIType === 'aggressive') {
                controller = new AggressiveAI(playerId);
                console.log(`Player ${playerId + 1}: Aggressive AI`);
            }
            else {
                controller = new RandomAI(playerId);
                console.log(`Player ${playerId + 1}: Random AI`);
            }
            this.game.setAIController(playerId, controller);
        }
    }
    setState(newState, _config) {
        console.log(`State transition: ${this.state} -> ${newState}`);
        this.state = newState;
    }
    update(dt) {
        switch (this.state) {
            case 'playing':
                // Update game
                if (this.game) {
                    this.game.update(dt);
                    // Check for game over
                    if (this.game.isGameOver()) {
                        this.setState('gameover');
                    }
                }
                break;
        }
    }
    render() {
        // Clear and draw background
        profiler.start('render');
        this.renderer.drawBackground();
        // Render based on state
        switch (this.state) {
            case 'playing':
            case 'gameover':
                if (this.game) {
                    // Draw obstacles first (behind particles)
                    this.renderer.drawObstacles(this.game.getObstacles());
                    // Draw particles with conversion progress
                    const conversionProgress = this.game.getConversionProgressMap();
                    const convertingColors = this.game.getConvertingPlayerColorMap();
                    this.renderer.drawParticles(this.game.getParticles(), conversionProgress, convertingColors);
                    // Draw player cursors on top
                    this.renderer.drawPlayers(this.game.getPlayers());
                }
                break;
        }
        profiler.end('render');
        // Update and render UI
        if (this.game) {
            const uiData = this.buildUIData();
            this.ui.update(uiData);
            this.ui.layoutColumns(this.renderer.width); // Reposition panels based on heights
            this.ui.render(this.renderer.ctx);
        }
    }
    buildUIData() {
        if (!this.game)
            return {};
        const particles = this.game.getParticles();
        const players = this.game.getPlayers();
        const spatialStats = this.game.getSpatialHashStats();
        const winner = this.game.getWinnerPlayer();
        // Build AI observations if overlay is visible
        let aiObservations = undefined;
        if (this.showObservationOverlay && AI_CONFIG.enabled) {
            aiObservations = AI_CONFIG.aiPlayers.map(playerId => ({
                playerId,
                playerColor: players[playerId]?.color || '#ffffff',
                observation: this.observationEncoder.encode3D(this.game, playerId),
            }));
        }
        return {
            fps: this.fps,
            particleCount: particles.length,
            obstacleCount: this.game.getObstacles().length,
            gridCells: spatialStats.cellCount,
            profilerStats: profiler.getAllStats(),
            hierarchicalStats: profiler.getHierarchicalStats(),
            totalFrameMs: profiler.getTotalMs(),
            aiModelInfo: this.aiModelMetadata ? {
                generation: this.aiModelMetadata.generation,
                bestFitness: this.aiModelMetadata.bestFitness,
                averageFitness: this.aiModelMetadata.averageFitness,
            } : undefined,
            players: players.map(p => ({
                id: p.id,
                color: p.color,
                particleCount: p.particleCount,
                isAI: p.isAI,
            })),
            totalParticles: particles.length,
            winner: winner ? {
                id: winner.id,
                color: winner.color,
                particleCount: winner.particleCount,
                isAI: winner.isAI,
                colorName: PLAYER_COLOR_NAMES[winner.id % PLAYER_COLOR_NAMES.length],
            } : null,
            aiObservations,
            canvasWidth: this.renderer.width,
            canvasHeight: this.renderer.height,
        };
    }
    async restartGame() {
        console.log('Restarting game...');
        // Destroy old game
        if (this.game) {
            this.game.destroy();
        }
        // Clear model cache to pick up any updated models
        clearModelCache();
        // Create new game with same config
        const config = {
            playerCount: GAME_CONFIG.playerCount,
            particlesPerPlayer: GAME_CONFIG.particlesPerPlayer
        };
        this.game = new Game(config, this.renderer.width, this.renderer.gameHeight);
        // Re-setup AI controllers
        if (AI_CONFIG.enabled) {
            await this.setupAIControllers();
        }
        // Reset state
        this.setState('playing');
        console.log('Game restarted');
    }
    loop(timestamp) {
        profiler.start('frame');
        // Calculate frame time
        const frameTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        // Calculate FPS
        this.frameCount++;
        this.fpsTime += frameTime;
        if (this.fpsTime >= 1.0) {
            this.fps = this.frameCount / this.fpsTime;
            this.frameCount = 0;
            this.fpsTime = 0;
        }
        // Add to accumulator (clamped to prevent spiral of death)
        this.accumulator += Math.min(frameTime, GAME_LOOP_CONFIG.maxAccumulator);
        // Fixed timestep updates (may run multiple times per visual frame)
        while (this.accumulator >= GAME_LOOP_CONFIG.fixedDt) {
            this.update(GAME_LOOP_CONFIG.fixedDt);
            this.accumulator -= GAME_LOOP_CONFIG.fixedDt;
        }
        // Render
        this.render();
        profiler.end('frame');
        // Continue loop
        requestAnimationFrame((time) => this.loop(time));
    }
}
// Initialize and start the application
const app = new App();
app.init();
//# sourceMappingURL=main.js.map