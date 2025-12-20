// Performance profiler for measuring game loop bottlenecks
// Uses frame-based accumulation so components add up correctly

export interface ProfilerStats {
  name: string;
  lastMs: number;
  avgMs: number;
  maxMs: number;
  samples: number;
}

export interface HierarchicalStat {
  name: string;        // Short name (e.g., "encode")
  fullName: string;    // Full path (e.g., "update.ai.encode")
  avgMs: number;
  maxMs: number;
  children: HierarchicalStat[];
  depth: number;
}

export class Profiler {
  private timings: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private maxSamples: number = 60; // Keep last 60 frames

  // Frame-based accumulation
  private frameAccumulators: Map<string, number> = new Map();
  private frameStartTime: number = 0;

  /**
   * Start a new frame - resets all accumulators
   */
  startFrame(): void {
    this.frameAccumulators.clear();
    this.frameStartTime = performance.now();
  }

  /**
   * End the current frame - commits all accumulated values as samples
   */
  endFrame(): void {
    // Record frame time
    const frameTime = performance.now() - this.frameStartTime;
    this.recordSample('frame', frameTime);

    // Record all accumulated values
    for (const [name, total] of this.frameAccumulators) {
      this.recordSample(name, total);
    }
  }

  /**
   * Record a sample for a stat
   */
  private recordSample(name: string, value: number): void {
    let samples = this.timings.get(name);
    if (!samples) {
      samples = [];
      this.timings.set(name, samples);
    }

    samples.push(value);
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  /**
   * Start timing a named section
   */
  start(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End timing a named section - accumulates within the current frame
   */
  end(name: string): number {
    const startTime = this.startTimes.get(name);
    if (startTime === undefined) {
      console.warn(`Profiler: No start time for "${name}"`);
      return 0;
    }

    const elapsed = performance.now() - startTime;

    // Accumulate within frame (supports multiple calls per frame)
    const current = this.frameAccumulators.get(name) || 0;
    this.frameAccumulators.set(name, current + elapsed);

    return elapsed;
  }

  /**
   * Measure a function and return its result
   */
  measure<T>(name: string, fn: () => T): T {
    this.start(name);
    const result = fn();
    this.end(name);
    return result;
  }

  getStats(name: string): ProfilerStats | null {
    const samples = this.timings.get(name);
    if (!samples || samples.length === 0) {
      return null;
    }

    const lastMs = samples[samples.length - 1];
    const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
    const maxMs = Math.max(...samples);

    return {
      name,
      lastMs,
      avgMs,
      maxMs,
      samples: samples.length
    };
  }

  getAllStats(): ProfilerStats[] {
    const stats: ProfilerStats[] = [];
    for (const name of this.timings.keys()) {
      const s = this.getStats(name);
      if (s) stats.push(s);
    }
    // Sort by average time descending
    return stats.sort((a, b) => b.avgMs - a.avgMs);
  }

  /**
   * Get formatted string for display
   */
  getFormattedStats(): string {
    const stats = this.getAllStats();
    if (stats.length === 0) return 'No profiling data';

    return stats
      .map(s => `${s.name}: ${s.avgMs.toFixed(2)}ms (max: ${s.maxMs.toFixed(2)}ms)`)
      .join(' | ');
  }

  /**
   * Get total frame time
   */
  getTotalMs(): number {
    const frameStats = this.getStats('frame');
    if (frameStats) {
      return frameStats.avgMs;
    }
    return 0;
  }

  /**
   * Get hierarchical stats grouped by parent category
   * Supports multi-level nesting (e.g., "update.ai.encode" -> update > ai > encode)
   * Creates synthetic parents by summing children if no direct stat exists
   * Excludes 'frame' from display (it's shown as Total)
   */
  getHierarchicalStats(): HierarchicalStat[] {
    const allStats = this.getAllStats();

    // Build a map of all stats by their full name
    const statsByName: Map<string, { avgMs: number; maxMs: number }> = new Map();
    for (const stat of allStats) {
      statsByName.set(stat.name, { avgMs: stat.avgMs, maxMs: stat.maxMs });
    }

    // Build tree structure recursively
    const buildChildren = (prefix: string, depth: number): HierarchicalStat[] => {
      const children: HierarchicalStat[] = [];
      const seen = new Set<string>();

      for (const stat of allStats) {
        // Skip 'frame' at root level (it's used for total)
        if (depth === 0 && stat.name === 'frame') continue;

        if (prefix === '') {
          // Root level: look for first segment of all names
          const parts = stat.name.split('.');
          const firstPart = parts[0];
          if (!seen.has(firstPart)) {
            seen.add(firstPart);
            const childStats = buildChildren(firstPart, depth + 1);

            // Use direct stat if exists, otherwise sum children
            let avgMs: number, maxMs: number;
            const directStat = statsByName.get(firstPart);
            if (directStat) {
              avgMs = directStat.avgMs;
              maxMs = directStat.maxMs;
            } else if (childStats.length > 0) {
              // Synthetic parent: sum children
              avgMs = childStats.reduce((sum, c) => sum + c.avgMs, 0);
              maxMs = childStats.reduce((max, c) => Math.max(max, c.maxMs), 0);
            } else {
              continue;
            }

            children.push({
              name: firstPart,
              fullName: firstPart,
              avgMs,
              maxMs,
              children: childStats,
              depth,
            });
          }
        } else {
          // Non-root: look for stats that start with prefix + '.'
          if (stat.name.startsWith(prefix + '.')) {
            const remainder = stat.name.slice(prefix.length + 1);
            const parts = remainder.split('.');
            const nextPart = parts[0];
            const childFullName = prefix + '.' + nextPart;

            if (!seen.has(childFullName)) {
              seen.add(childFullName);
              const childStats = buildChildren(childFullName, depth + 1);

              let avgMs: number, maxMs: number;
              const directStat = statsByName.get(childFullName);
              if (directStat) {
                avgMs = directStat.avgMs;
                maxMs = directStat.maxMs;
              } else if (childStats.length > 0) {
                avgMs = childStats.reduce((sum, c) => sum + c.avgMs, 0);
                maxMs = childStats.reduce((max, c) => Math.max(max, c.maxMs), 0);
              } else {
                continue;
              }

              children.push({
                name: nextPart,
                fullName: childFullName,
                avgMs,
                maxMs,
                children: childStats,
                depth,
              });
            }
          }
        }
      }

      return children.sort((a, b) => b.avgMs - a.avgMs);
    };

    return buildChildren('', 0);
  }

  clear(): void {
    this.timings.clear();
    this.startTimes.clear();
    this.frameAccumulators.clear();
  }
}

// Global profiler instance
export const profiler = new Profiler();
