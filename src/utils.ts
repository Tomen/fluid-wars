// Utility functions for Fluid Wars

import type { Vec2 } from './types';

// Vector operations

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function length(vx: number, vy: number): number {
  return Math.sqrt(vx * vx + vy * vy);
}

export function normalize(vx: number, vy: number): Vec2 {
  const len = length(vx, vy);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: vx / len,
    y: vy / len
  };
}

export function dot(v1: Vec2, v2: Vec2): number {
  return v1.x * v2.x + v1.y * v2.y;
}

// Utility functions

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}
