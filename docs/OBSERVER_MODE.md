# Observer Mode - Client-Server Architecture

Watch AI battles running in a Web Worker with zero-copy binary frame transfer.

## Quick Start

| Key | Action |
|-----|--------|
| **W** | Start observer mode (runs all 4 balance tests) |
| **R** | Restart the test queue from the beginning |
| **Escape** | Return to normal game |

## Balance Test Scenarios

When you press **W**, observer mode automatically loads and runs all balance test scenarios from `scenarios/balance/`:

1. **Corner 2:1** - Player 1 in corner with 50 particles vs Player 2 surrounding with 100
2. **Open 2:1** - Same matchup but in center of map (control test)
3. **Corner Even** - Both players with 100 particles in corner
4. **Open Even** - Both players with 100 particles centered

Each scenario runs to completion (95% domination or 3600 step timeout), then automatically advances to the next with a 2-second delay.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN THREAD                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ GameClient  │───>│  Network    │───>│   Canvas    │ │
│  │ (receives)  │    │  Renderer   │    │  (display)  │ │
│  └──────┬──────┘    └─────────────┘    └─────────────┘ │
│         │ postMessage                                   │
│         │ (binary frames)                               │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────┐
│                    WEB WORKER                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Scenario   │───>│    Game     │───>│   Frame     │ │
│  │  Config     │    │  Simulator  │    │  Encoder    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Game Runs in Worker
The game simulation runs entirely in a Web Worker, keeping the main thread free for rendering. This prevents frame drops even during complex physics calculations.

### 2. Binary Frame Format
Frame data is encoded as binary ArrayBuffer (~1.2KB per frame vs ~4KB for JSON):

```
Header (20 bytes):
  [0-3]   uint32  step number
  [4-5]   uint16  particle count
  [6]     uint8   player count
  [7]     uint8   flags (gameOver, winner)
  [8-15]  float32 canvasWidth, canvasHeight
  [16-19] reserved

Per-Player (12 bytes each):
  [0-3]   float32 cursorX
  [4-7]   float32 cursorY
  [8-9]   uint16  particleCount
  [10]    uint8   colorIndex

Per-Particle (9 bytes each):
  [0-3]   float32 x
  [4-7]   float32 y
  [8]     uint8   owner
```

### 3. Double-Buffer Pattern (Zero-Copy)
Two ArrayBuffers alternate ownership between worker and main thread:

```typescript
// Worker encodes frame into buffer A, transfers ownership
postMessage({ type: 'frame', buffer: bufferA }, [bufferA]);

// Main thread renders, returns buffer A
worker.postMessage({ type: 'buffer_return', buffer: bufferA }, [bufferA]);

// Worker now uses buffer A again, while B might still be in transit
```

This achieves zero-copy transfer - the buffer memory is moved, not copied.

## UI Panel

The Observer Info Panel displays in the top-left corner showing:

- **Queue progress** - "Test X of Y" indicator
- **Scenario name** and description
- **Progress bar** - current step / max steps
- **Game status** - winner announcement when game ends
- **Player stats** - each player's color, particle count, and percentage
- **Completed results** - summary of finished scenarios (winner + steps)
- **Queue complete** - notification when all tests finish

The panel is automatically shown when entering observer mode and hidden when exiting.

## File Structure

```
src/network/
├── protocol.ts       # Message types + binary encoder/decoder
├── GameWorker.ts     # Worker-side game simulation
├── game.worker.ts    # Vite worker entry point
└── GameClient.ts     # Main thread client

src/ui/
├── NetworkRenderer.ts    # Renders frames from binary data
└── panels/
    └── ObserverInfoPanel.ts  # Observer mode info panel
```

## Protocol Messages

### Worker → Main Thread

| Message | Description |
|---------|-------------|
| `ready` | Worker initialized |
| `load_scenario` | Scenario config + obstacles |
| `game_start` | Canvas size, player colors |
| `frame` | Binary frame data (transferable) |
| `game_over` | Winner + statistics |

### Main Thread → Worker

| Message | Description |
|---------|-------------|
| `start` | Start game with optional scenario |
| `buffer_return` | Return buffer for reuse |
| `input` | Player cursor input (future) |

## Performance

- **Frame rate:** 30 FPS (configurable)
- **Frame size:** ~1,244 bytes (150 particles, 2 players)
- **Bandwidth:** ~36 KB/s
- **Transfer:** Zero-copy via Transferable ArrayBuffer

## Current Limitations

- Observer-only (no player input yet)
- Fixed cursor positions for AI testing
- Single hardcoded scenario

## Future: Network Multiplayer

The same protocol can work over WebSocket for network play:

```
┌──────────┐     WebSocket      ┌──────────┐
│  Client  │◄──────────────────►│  Server  │
│ (render) │   binary frames    │  (game)  │
└──────────┘                    └──────────┘
```

This architecture is the foundation for:
- Spectator mode (multiple observers)
- Network multiplayer (players send input)
- Dedicated game servers
