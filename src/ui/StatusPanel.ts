// StatusPanel - Context-aware status display

export interface PlayerStatus {
  id: number;
  color: string;
  colorName: string;
  particleCount: number;
  isAI: boolean;
}

export interface GameStatus {
  mode: 'playing' | 'gameover' | 'observing';
  players: PlayerStatus[];
  totalParticles: number;
  winner?: PlayerStatus;
  fps?: number;
}

export interface ObserverStatus {
  scenarioName: string;
  scenarioDescription?: string;
  currentStep: number;
  maxSteps: number;
  gameOver: boolean;
  winner?: number;
}

export class StatusPanel {
  private element: HTMLElement;

  constructor() {
    this.element = document.getElementById('status-panel')!;
    if (!this.element) {
      throw new Error('Status panel element not found in DOM');
    }
  }

  /**
   * Update status for normal game mode
   */
  updateGame(status: GameStatus): void {
    let html = '';

    if (status.mode === 'gameover' && status.winner) {
      html += `<div class="status-title">Game Over</div>`;
      html += `<div class="status-row">
        <span class="status-label">Winner:</span>
        <span class="status-value" style="color: ${status.winner.color}">${status.winner.colorName}</span>
      </div>`;
    } else {
      html += `<div class="status-title">Game Status</div>`;
    }

    // Player stats
    for (const player of status.players) {
      const percent = status.totalParticles > 0
        ? Math.round((player.particleCount / status.totalParticles) * 100)
        : 0;
      const type = player.isAI ? 'AI' : (player.id === 0 ? 'You' : 'P' + (player.id + 1));

      html += `<div class="status-row">
        <span class="status-label">
          <span style="color: ${player.color}">\u25CF</span> ${type}
        </span>
        <span class="status-value">${player.particleCount} (${percent}%)</span>
      </div>`;
    }

    // FPS if available
    if (status.fps !== undefined) {
      html += `<div class="status-row" style="margin-top: 8px; border-top: 1px solid #333; padding-top: 4px;">
        <span class="status-label">FPS:</span>
        <span class="status-value">${Math.round(status.fps)}</span>
      </div>`;
    }

    this.element.innerHTML = html;
  }

  /**
   * Update status for observer mode
   */
  updateObserver(status: ObserverStatus, players: PlayerStatus[], totalParticles: number): void {
    let html = '';

    html += `<div class="status-title">${status.scenarioName}</div>`;

    if (status.scenarioDescription) {
      html += `<div style="color: #666; font-size: 10px; margin-bottom: 8px;">${status.scenarioDescription}</div>`;
    }

    // Progress bar
    const progress = (status.currentStep / status.maxSteps) * 100;
    const barColor = status.gameOver ? '#4a4' : '#48f';
    html += `<div style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
        <span>Step ${status.currentStep}</span>
        <span>${status.maxSteps}</span>
      </div>
      <div style="background: #222; border-radius: 2px; height: 4px; overflow: hidden;">
        <div style="background: ${barColor}; height: 100%; width: ${progress}%; transition: width 0.1s;"></div>
      </div>
    </div>`;

    // Player stats
    for (const player of players) {
      const percent = totalParticles > 0
        ? Math.round((player.particleCount / totalParticles) * 100)
        : 0;
      const isWinner = status.gameOver && status.winner === player.id;

      html += `<div class="status-row">
        <span class="status-label">
          <span style="color: ${player.color}">\u25CF</span> AI ${player.id + 1}
          ${isWinner ? ' \u2605' : ''}
        </span>
        <span class="status-value">${player.particleCount} (${percent}%)</span>
      </div>`;
    }

    // Controls hint
    html += `<div style="margin-top: 8px; border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #666;">
      R: Restart | Esc: Exit
    </div>`;

    this.element.innerHTML = html;
  }

  /**
   * Clear the status panel
   */
  clear(): void {
    this.element.innerHTML = '';
  }
}
