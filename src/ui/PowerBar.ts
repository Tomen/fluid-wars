// PowerBar - DOM-based power distribution bar

export interface PlayerPower {
  id: number;
  color: string;
  particleCount: number;
}

export class PowerBar {
  private element: HTMLElement;
  private segments: HTMLElement[] = [];
  private totalParticles: number = 0;

  constructor() {
    this.element = document.getElementById('power-bar')!;
    if (!this.element) {
      throw new Error('Power bar element not found in DOM');
    }
  }

  /**
   * Update the power bar with current player data
   */
  update(players: PlayerPower[]): void {
    // Calculate total
    this.totalParticles = players.reduce((sum, p) => sum + p.particleCount, 0);

    // Ensure we have the right number of segments
    while (this.segments.length < players.length) {
      const segment = document.createElement('div');
      segment.className = 'power-segment';
      segment.style.transition = 'flex 0.3s ease';
      this.element.appendChild(segment);
      this.segments.push(segment);
    }

    // Remove extra segments
    while (this.segments.length > players.length) {
      const segment = this.segments.pop()!;
      segment.remove();
    }

    // Update each segment
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const segment = this.segments[i];
      const percentage = this.totalParticles > 0
        ? (player.particleCount / this.totalParticles) * 100
        : 100 / players.length;

      segment.style.flex = `${percentage}`;
      segment.style.backgroundColor = player.color;
    }
  }

  /**
   * Clear the power bar
   */
  clear(): void {
    for (const segment of this.segments) {
      segment.remove();
    }
    this.segments = [];
    this.totalParticles = 0;
  }
}
