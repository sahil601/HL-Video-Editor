/**
 * Bounded LRU Cache Manager for HL Video Editor
 * Provides memory-bounded caches for waveforms, thumbnails, and preview frames
 * with automatic LRU eviction and cache invalidation.
 */

import { profiler } from './profiler';

export interface CacheOptions<V> {
  maxEntries: number;
  maxSizeBytes?: number;
  sizeCalculator?: (val: V) => number;
  name?: string;
}

export interface CacheStats {
  name: string;
  entries: number;
  maxEntries: number;
  estimatedSizeBytes: number;
  maxSizeBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRatio: number;
}

export class MemoryLRUCache<K, V> {
  private cache = new Map<K, { value: V; sizeBytes: number }>();
  private maxEntries: number;
  private maxSizeBytes: number;
  private sizeCalculator?: (val: V) => number;
  private currentSizeBytes = 0;
  private name: string;

  constructor(options: CacheOptions<V>) {
    this.maxEntries = options.maxEntries;
    this.maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024; // Default 50MB
    this.sizeCalculator = options.sizeCalculator;
    this.name = options.name || 'unnamed_cache';
  }

  public get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) {
      profiler.recordCacheEvent(this.name, 'miss', this.cache.size, this.maxEntries);
      return undefined;
    }

    // Refresh LRU order by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, item);
    profiler.recordCacheEvent(this.name, 'hit', this.cache.size, this.maxEntries);
    return item.value;
  }

  public set(key: K, value: V, customSizeBytes?: number): void {
    const size = customSizeBytes !== undefined
      ? customSizeBytes
      : (this.sizeCalculator ? this.sizeCalculator(value) : 1024);

    // If key exists, subtract its current size
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSizeBytes -= existing.sizeBytes;
      this.cache.delete(key);
    }

    // Evict oldest items if limits exceeded
    while (
      (this.cache.size >= this.maxEntries || (this.currentSizeBytes + size > this.maxSizeBytes && this.cache.size > 0))
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      const evicted = this.cache.get(oldestKey);
      if (evicted) {
        this.currentSizeBytes -= evicted.sizeBytes;
      }
      this.cache.delete(oldestKey);
      profiler.recordCacheEvent(this.name, 'evict', this.cache.size, this.maxEntries);
    }

    this.cache.set(key, { value, sizeBytes: size });
    this.currentSizeBytes += size;
  }

  public has(key: K): boolean {
    return this.cache.has(key);
  }

  public delete(key: K): boolean {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSizeBytes -= existing.sizeBytes;
      return this.cache.delete(key);
    }
    return false;
  }

  public clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  public get size(): number {
    return this.cache.size;
  }

  public get estimatedSizeBytes(): number {
    return this.currentSizeBytes;
  }

  public getStats(): CacheStats {
    const snapshot = profiler.getSnapshot();
    const stat = snapshot.caches[this.name] || { hits: 0, misses: 0, evictions: 0, hitRatio: 1.0 };
    return {
      name: this.name,
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      estimatedSizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.maxSizeBytes,
      hits: stat.hits,
      misses: stat.misses,
      evictions: stat.evictions,
      hitRatio: stat.hitRatio,
    };
  }

  /**
   * Remove any entries whose key contains a prefix or matches a predicate
   */
  public deleteMatching(predicate: (key: K) => boolean): number {
    let deletedCount = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (predicate(key)) {
        this.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }
}

// Global bounded cache singletons
export const waveformCache = new MemoryLRUCache<string, number[]>({
  name: 'waveform_cache',
  maxEntries: 200,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  sizeCalculator: (peaks) => peaks.length * 4, // 4 bytes per Float32/number
});

export const thumbnailCache = new MemoryLRUCache<string, string>({
  name: 'thumbnail_cache',
  maxEntries: 300,
  maxSizeBytes: 25 * 1024 * 1024, // 25MB
  sizeCalculator: (base64) => base64.length * 2, // Approximate UTF-16 string memory
});

export const previewFrameCache = new MemoryLRUCache<string, string>({
  name: 'preview_frame_cache',
  maxEntries: 50,
  maxSizeBytes: 40 * 1024 * 1024, // 40MB
  sizeCalculator: (dataUrl) => dataUrl.length * 2,
});

/**
 * Generate cache key for waveform peaks
 */
export function getWaveformCacheKey(assetId: string, fileSize: number, durationMs: number, peaksCount = 500): string {
  return `wf_${assetId}_sz${fileSize}_dur${durationMs}_pks${peaksCount}`;
}

/**
 * Generate cache key for thumbnails
 */
export function getThumbnailCacheKey(assetId: string, fileSize: number, timeSec = 1): string {
  return `thumb_${assetId}_sz${fileSize}_t${timeSec.toFixed(1)}`;
}

/**
 * Invalidate all caches for a specific asset (e.g. when file is replaced or relinked)
 */
export function invalidateAssetCaches(assetId: string): void {
  waveformCache.deleteMatching((key) => key.includes(assetId));
  thumbnailCache.deleteMatching((key) => key.includes(assetId));
  previewFrameCache.deleteMatching((key) => key.includes(assetId));
}

/**
 * Clear all in-memory caches
 */
export function clearAllMemoryCaches(): void {
  waveformCache.clear();
  thumbnailCache.clear();
  previewFrameCache.clear();
}
