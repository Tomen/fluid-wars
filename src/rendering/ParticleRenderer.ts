// ParticleRenderer - Particle rendering with different visual styles
// Supports solid, soft (gradient sprites), and glow effects

import type { Particle } from '../particle';
import { RENDER_CONFIG, PARTICLE_CONFIG } from '../config';

type ParticleStyle = 'solid' | 'soft' | 'glow';

export class ParticleRenderer {
  private style: ParticleStyle;
  private spriteCache: Map<string, OffscreenCanvas> = new Map();
  private spriteSize: number;

  constructor() {
    this.style = RENDER_CONFIG.particleStyle;
    // Sprite size is particle radius * multiplier * 2 (diameter)
    this.spriteSize = Math.ceil(PARTICLE_CONFIG.radius * RENDER_CONFIG.shadowBlur * 2);
  }

  private getSprite(color: string): OffscreenCanvas {
    let sprite = this.spriteCache.get(color);
    if (!sprite) {
      sprite = this.createGradientSprite(color);
      this.spriteCache.set(color, sprite);
    }
    return sprite;
  }

  private createGradientSprite(color: string): OffscreenCanvas {
    const size = this.spriteSize;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    // Parse color to RGB for gradient
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Radial gradient: solid center fading to transparent edge
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return canvas;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    conversionProgressMap?: Map<Particle, number>,
    convertingColorMap?: Map<Particle, string>
  ): void {
    if (this.style === 'solid') {
      this.drawSolid(ctx, particles, conversionProgressMap, convertingColorMap);
    } else if (this.style === 'soft') {
      this.drawGradientSprites(ctx, particles, conversionProgressMap, convertingColorMap);
    } else if (this.style === 'glow') {
      this.drawGradientSprites(ctx, particles, conversionProgressMap, convertingColorMap, true);
    }
  }

  private drawGradientSprites(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    conversionProgressMap?: Map<Particle, number>,
    convertingColorMap?: Map<Particle, string>,
    additive: boolean = false
  ): void {
    const halfSize = this.spriteSize / 2;

    if (additive) {
      ctx.globalCompositeOperation = 'lighter';
    }

    for (const particle of particles) {
      const sprite = this.getSprite(particle.color);
      ctx.drawImage(sprite, particle.x - halfSize, particle.y - halfSize);
    }

    if (additive) {
      ctx.globalCompositeOperation = 'source-over';
    }

    this.drawConversionIndicators(ctx, particles, conversionProgressMap, convertingColorMap);
  }

  private drawSolid(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    conversionProgressMap?: Map<Particle, number>,
    convertingColorMap?: Map<Particle, string>
  ): void {
    for (const particle of particles) {
      const progress = conversionProgressMap?.get(particle);
      const convertingColor = convertingColorMap?.get(particle);
      particle.draw(ctx, progress, convertingColor);
    }
  }

  private drawConversionIndicators(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    conversionProgressMap?: Map<Particle, number>,
    convertingColorMap?: Map<Particle, string>
  ): void {
    if (!conversionProgressMap || !convertingColorMap) return;

    for (const particle of particles) {
      const progress = conversionProgressMap.get(particle);
      const convertingColor = convertingColorMap.get(particle);

      if (progress !== undefined && progress > 0 && convertingColor) {
        const progressRadius = PARTICLE_CONFIG.radius + 2;
        const progressAngle = progress * Math.PI * 2;

        ctx.strokeStyle = convertingColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          particle.x, particle.y,
          progressRadius,
          -Math.PI / 2,
          -Math.PI / 2 + progressAngle
        );
        ctx.stroke();
      }
    }
  }
}
