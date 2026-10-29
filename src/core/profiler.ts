/**
 * Performance Profiler for HL Video Editor
 * Measures render/seek latency, waveform extraction times, thumbnail generation,
 * cache hit/miss rates, and memory utilization.
 */

export interface ProfileMetric {
  name: string;
  count: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  lastDurationMs: number;
}

export interface CacheMetric {
  name: string;
  hits: number;
  misses: number;
  evictions: number;
  hitRatio: number;
  currentEntries: number;
  maxEntries: number;
}

export interface PerformanceSnapshot {
  timestamp: string;
  metrics: Record<string, ProfileMetric>;
  caches: Record<string, CacheMetric>;
  memory?: {
    usedJsHeapSizeMb?: number;
    totalJsHeapSizeMb?: number;
    jsHeapSizeLimitMb?: number;
  };
}

class PerformanceProfiler {
  private metrics: Map<string, { count: number; totalMs: number; minMs: number; maxMs: number; lastMs: number }> = new Map();
  private cacheStats: Map<string, { hits: number; misses: number; evictions: number; currentEntries: number; maxEntries: number }> = new Map();

  /**
   * Measure execution time of a synchronous or asynchronous function
   */
  public async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordDuration(name, duration);
    }
  }

  /**
   * Record a completed timing duration
   */
  public recordDuration(name: string, durationMs: number): void {
    const existing = this.metrics.get(name);
    if (!existing) {
      this.metrics.set(name, {
        count: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs,
        lastMs: durationMs,
      });
    } else {
      existing.count += 1;
      existing.totalMs += durationMs;
      existing.minMs = Math.min(existing.minMs, durationMs);
      existing.maxMs = Math.max(existing.maxMs, durationMs);
      existing.lastMs = durationMs;
    }
  }

  /**
   * Record cache hit/miss/eviction events
   */
  public recordCacheEvent(name: string, event: 'hit' | 'miss' | 'evict', currentEntries = 0, maxEntries = 0): void {
    let stat = this.cacheStats.get(name);
    if (!stat) {
      stat = { hits: 0, misses: 0, evictions: 0, currentEntries, maxEntries };
      this.cacheStats.set(name, stat);
    }
    if (event === 'hit') stat.hits++;
    if (event === 'miss') stat.misses++;
    if (event === 'evict') stat.evictions++;
    stat.currentEntries = currentEntries;
    stat.maxEntries = maxEntries;
  }

  /**
   * Capture complete performance snapshot
   */
  public getSnapshot(): PerformanceSnapshot {
    const formattedMetrics: Record<string, ProfileMetric> = {};
    for (const [name, m] of this.metrics.entries()) {
      formattedMetrics[name] = {
        name,
        count: m.count,
        totalDurationMs: Number(m.totalMs.toFixed(2)),
        minDurationMs: Number(m.minMs.toFixed(2)),
        maxDurationMs: Number(m.maxMs.toFixed(2)),
        avgDurationMs: Number((m.totalMs / m.count).toFixed(2)),
        lastDurationMs: Number(m.lastMs.toFixed(2)),
      };
    }

    const formattedCaches: Record<string, CacheMetric> = {};
    for (const [name, c] of this.cacheStats.entries()) {
      const total = c.hits + c.misses;
      formattedCaches[name] = {
        name,
        hits: c.hits,
        misses: c.misses,
        evictions: c.evictions,
        hitRatio: total > 0 ? Number((c.hits / total).toFixed(3)) : 1.0,
        currentEntries: c.currentEntries,
        maxEntries: c.maxEntries,
      };
    }

    let memoryInfo: PerformanceSnapshot['memory'] = undefined;
    if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
      const mem = (window.performance as any).memory;
      memoryInfo = {
        usedJsHeapSizeMb: Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(2)),
        totalJsHeapSizeMb: Number((mem.totalJSHeapSize / (1024 * 1024)).toFixed(2)),
        jsHeapSizeLimitMb: Number((mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)),
      };
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: formattedMetrics,
      caches: formattedCaches,
      memory: memoryInfo,
    };
  }

  /**
   * Reset all collected metrics
   */
  public reset(): void {
    this.metrics.clear();
    this.cacheStats.clear();
  }
}

export const profiler = new PerformanceProfiler();
