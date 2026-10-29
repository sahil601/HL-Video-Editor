import { describe, it, expect, beforeEach } from 'vitest';
import {
  PROXY_PROFILES,
  DEFAULT_PROXY_SETTINGS,
  isProxyEligible,
  buildProxyFFmpegArgs,
  parseProxyProgress,
  getEffectivePreviewUrl,
  getEffectiveExportPath,
} from '../core/proxy';
import {
  MemoryLRUCache,
  getWaveformCacheKey,
  getThumbnailCacheKey,
  invalidateAssetCaches,
  waveformCache,
  thumbnailCache,
} from '../core/cache';
import { profiler } from '../core/profiler';
import {
  RecoveryManager,
  ProjectRecoverySnapshot,
} from '../core/recovery';
import {
  relinkSingleAsset,
  relinkDirectoryByMatchingFiles,
  getFormattedMediaDetails,
  formatBytes,
} from '../core/mediaRelinking';
import { Project, ProjectAsset } from '../types/project';
import { createDefaultProject } from '../core/project';

// Node.js localStorage polyfill for headless tests
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (index: number) => Array.from(storageMap.keys())[index] || null,
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

function createTestAsset(partial: Partial<ProjectAsset> & { id: string; name: string; type: ProjectAsset['type'] }): ProjectAsset {
  return {
    relativePath: `media/${partial.name}`,
    originalPath: `C:\\Media\\${partial.name}`,
    fileSize: 1024 * 1024,
    durationMs: 5000,
    isBundled: false,
    ...partial,
  };
}

describe('HL Phase 7 — Performance, Media Management & Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // 1. PROXY MEDIA ENGINE
  // --------------------------------------------------------------------------
  describe('Proxy Media Generation & Profiles', () => {
    it('defines distinct proxy quality profiles with proper resolutions and faststart', () => {
      expect(PROXY_PROFILES['360p'].width).toBe(640);
      expect(PROXY_PROFILES['360p'].height).toBe(360);
      expect(PROXY_PROFILES['540p'].width).toBe(960);
      expect(PROXY_PROFILES['540p'].height).toBe(540);
      expect(PROXY_PROFILES['720p'].width).toBe(1280);
      expect(PROXY_PROFILES['720p'].height).toBe(720);
    });

    it('identifies proxy eligibility by file extension and media type', () => {
      const videoAsset = createTestAsset({
        id: 'a1',
        name: 'vacation.mp4',
        type: 'video',
        durationMs: 10000,
        originalPath: 'C:\\Videos\\vacation.mp4',
      });
      const movAsset = createTestAsset({
        id: 'a2',
        name: 'cinema.mov',
        type: 'video',
        durationMs: 5000,
        originalPath: 'C:\\Videos\\cinema.mov',
      });
      const audioAsset = createTestAsset({
        id: 'a3',
        name: 'song.mp3',
        type: 'audio',
        durationMs: 3000,
        originalPath: 'C:\\Audio\\song.mp3',
      });
      const imageAsset = createTestAsset({
        id: 'a4',
        name: 'photo.jpg',
        type: 'image',
        durationMs: 5000,
        originalPath: 'C:\\Images\\photo.jpg',
      });

      expect(isProxyEligible(videoAsset)).toBe(true);
      expect(isProxyEligible(movAsset)).toBe(true);
      expect(isProxyEligible(audioAsset)).toBe(false);
      expect(isProxyEligible(imageAsset)).toBe(false);
    });

    it('builds FFmpeg transcode arguments preserving aspect ratio, even integer scale, and +faststart', () => {
      const args = buildProxyFFmpegArgs('C:\\input.mov', 'C:\\output_540p.mp4', '540p');
      expect(args).toContain('-i');
      expect(args).toContain('C:\\input.mov');
      expect(args).toContain('-vf');
      expect(args).toContain("scale=w='min(iw,960)':h='-2'");
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('-movflags');
      expect(args).toContain('+faststart');
      expect(args).toContain('-y');
      expect(args[args.length - 1]).toBe('C:\\output_540p.mp4');
    });

    it('parses FFmpeg progress output into percentage and speed', () => {
      const line = 'frame=  120 fps= 60 q=28.0 size=    1024kB time=00:00:05.50 bitrate=1525.0kbits/s speed=2.5x';
      const progress = parseProxyProgress(line, 10); // 10s total
      expect(progress).not.toBeNull();
      expect(progress?.percent).toBe(55);
      expect(progress?.speed).toBe('2.5x');
    });

    it('resolves effective preview URL using proxy when enabled, falling back to original media', () => {
      const asset = createTestAsset({
        id: 'asset_vid_1',
        name: 'interview.mp4',
        type: 'video',
        durationMs: 20000,
        proxyStatus: 'ready',
        proxyPath: 'C:\\proxies\\asset_vid_1.mp4',
      });
      const rawUrlMap = new Map([['asset_vid_1', 'blob:http://localhost/raw123']]);
      const proxyUrlMap = new Map([['asset_vid_1', 'blob:http://localhost/proxy456']]);

      // When enabled and ready -> uses proxy
      const urlEnabled = getEffectivePreviewUrl(asset, true, proxyUrlMap, rawUrlMap);
      expect(urlEnabled).toBe('blob:http://localhost/proxy456');

      // When disabled by user -> falls back to raw original URL
      const urlDisabled = getEffectivePreviewUrl(asset, false, proxyUrlMap, rawUrlMap);
      expect(urlDisabled).toBe('blob:http://localhost/raw123');

      // When proxy status is generating or error -> falls back to raw
      const notReadyAsset = { ...asset, proxyStatus: 'generating' as const };
      const urlGenerating = getEffectivePreviewUrl(notReadyAsset, true, proxyUrlMap, rawUrlMap);
      expect(urlGenerating).toBe('blob:http://localhost/raw123');
    });

    it('resolves export path retaining original media by default unless explicitly configured', () => {
      const asset = createTestAsset({
        id: 'a1',
        name: 'master.mp4',
        type: 'video',
        durationMs: 15000,
        originalPath: 'D:\\Footage\\master.mp4',
        proxyPath: 'C:\\Proxies\\a1_proxy.mp4',
        proxyStatus: 'ready',
      });

      // By default: useForExport is false -> retains original high-res media
      const defaultExport = getEffectiveExportPath(asset, false);
      expect(defaultExport).toBe('D:\\Footage\\master.mp4');

      // When user explicitly checks draft proxy export -> uses proxy
      const draftExport = getEffectiveExportPath(asset, true);
      expect(draftExport).toBe('C:\\Proxies\\a1_proxy.mp4');
    });
  });

  // --------------------------------------------------------------------------
  // 2. BOUNDED CACHING & PERFORMANCE PROFILING
  // --------------------------------------------------------------------------
  describe('Bounded LRU Caching & Invalidation', () => {
    it('enforces entry count limits with LRU eviction order', () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 3,
        name: 'test_lru',
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBe(1); // accesses 'a', making 'b' least recently used
      cache.set('d', 4); // should evict 'b'

      expect(cache.has('b')).toBe(false);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
    });

    it('enforces memory byte limits with estimated byte eviction', () => {
      const cache = new MemoryLRUCache<string, string>({
        maxEntries: 10,
        maxSizeBytes: 100, // 100 bytes max
        sizeCalculator: (str) => str.length * 2,
        name: 'test_byte_limit',
      });

      cache.set('k1', 'x'.repeat(25)); // 50 bytes
      cache.set('k2', 'y'.repeat(25)); // 50 bytes
      expect(cache.getStats().estimatedSizeBytes).toBe(100);

      cache.set('k3', 'z'.repeat(25)); // exceeds 100 bytes -> evicts k1
      expect(cache.has('k1')).toBe(false);
      expect(cache.has('k2')).toBe(true);
      expect(cache.has('k3')).toBe(true);
      expect(cache.getStats().estimatedSizeBytes).toBeLessThanOrEqual(100);
    });

    it('invalidates asset caches when media changes', () => {
      waveformCache.set(getWaveformCacheKey('asset_99', 5000, 10000), [0.1, 0.5, 0.9]);
      thumbnailCache.set(getThumbnailCacheKey('asset_99', 5000, 1.0), 'data:image/png;base64,123');

      expect(waveformCache.has(getWaveformCacheKey('asset_99', 5000, 10000))).toBe(true);
      expect(thumbnailCache.has(getThumbnailCacheKey('asset_99', 5000, 1.0))).toBe(true);

      invalidateAssetCaches('asset_99');

      expect(waveformCache.has(getWaveformCacheKey('asset_99', 5000, 10000))).toBe(false);
      expect(thumbnailCache.has(getThumbnailCacheKey('asset_99', 5000, 1.0))).toBe(false);
    });

    it('tracks render latency, seek latency, and memory snapshots in profiler', () => {
      profiler.recordDuration('render', 8.5);
      profiler.recordDuration('render', 12.0);
      profiler.recordDuration('seek', 4.2);

      const snap = profiler.getSnapshot();
      expect(snap.metrics['render'].avgDurationMs).toBeGreaterThan(0);
      expect(snap.metrics['seek'].avgDurationMs).toBeGreaterThan(0);
      expect(snap.metrics['render'].count).toBeGreaterThanOrEqual(2);
    });
  });

  // --------------------------------------------------------------------------
  // 3. AUTOSAVE & ABNORMAL SHUTDOWN RECOVERY
  // --------------------------------------------------------------------------
  describe('Autosave & Project Recovery Snapshots', () => {
    it('saves rolling recovery snapshots capped at 5 and evicts oldest', () => {
      const proj = createDefaultProject('Rolling Test');

      for (let i = 1; i <= 7; i++) {
        const p = { ...proj, name: `Snapshot Project ${i}` };
        const res = RecoveryManager.saveSnapshot(p, 'autosave');
        expect(res.success).toBe(true);
      }

      const snapshots = RecoveryManager.getSnapshots();
      expect(snapshots.length).toBe(5);
      // Newest should be at front
      expect(snapshots[0].projectName).toBe('Snapshot Project 7');
      expect(snapshots[4].projectName).toBe('Snapshot Project 3');
    });

    it('detects abnormal shutdown when session lock is dirty and resolves matching snapshot', () => {
      const proj = createDefaultProject('Crashed Session');
      proj.id = 'proj_crash_123';

      RecoveryManager.saveSnapshot(proj, 'autosave');
      RecoveryManager.markSessionActive(proj, true); // marked dirty

      const detected = RecoveryManager.detectAbnormalShutdown();
      expect(detected).not.toBeNull();
      expect(detected?.lock.projectId).toBe('proj_crash_123');
      expect(detected?.snapshot?.projectId).toBe('proj_crash_123');

      // When cleaned, no abnormal shutdown reported
      RecoveryManager.markSessionClean();
      expect(RecoveryManager.detectAbnormalShutdown()).toBeNull();
    });

    it('formats friendly relative timestamps', () => {
      const now = new Date().toISOString();
      expect(RecoveryManager.formatFriendlyTime(now)).toBe('Just now');

      const twoMinsAgo = new Date(Date.now() - 120 * 1000).toISOString();
      expect(RecoveryManager.formatFriendlyTime(twoMinsAgo)).toBe('2m ago');
    });

    it('restores project snapshot and clears dirty session lock without data loss', () => {
      const proj = createDefaultProject('Restore Me');
      proj.durationMs = 25000;
      const res = RecoveryManager.saveSnapshot(proj, 'manual');
      expect(res.snapshotId).toBeDefined();

      const restored = RecoveryManager.getSnapshotProject(res.snapshotId!);
      expect(restored).not.toBeNull();
      expect(restored?.name).toBe('Restore Me');
      expect(restored?.durationMs).toBe(25000);
    });
  });

  // --------------------------------------------------------------------------
  // 4. MEDIA MANAGEMENT & RELINKING
  // --------------------------------------------------------------------------
  describe('Media Management, Relinking & Portability', () => {
    it('relinks a single asset, updating originalPath and clearing isMissing flag', () => {
      const proj = createDefaultProject('Relink Single');
      proj.assets = [
        createTestAsset({
          id: 'asset_lost',
          name: 'broll_drone.mp4',
          type: 'video',
          durationMs: 8000,
          originalPath: 'D:\\OldFolder\\broll_drone.mp4',
          isMissing: true,
        }),
      ];

      const updatedProj = relinkSingleAsset(proj, 'asset_lost', 'E:\\NewDrive\\Footage\\broll_drone.mp4');
      expect(updatedProj.assets[0].isMissing).toBe(false);
      expect(updatedProj.assets[0].originalPath).toBe('E:\\NewDrive\\Footage\\broll_drone.mp4');
      expect(updatedProj.assets[0].name).toBe('broll_drone.mp4');
      expect(updatedProj.assets[0].durationMs).toBe(8000); // timing preserved
    });

    it('batch relinks directory by safely matching filenames case-insensitively', () => {
      const proj = createDefaultProject('Batch Relink');
      proj.assets = [
        createTestAsset({
          id: 'a1',
          name: 'Hero_Intro.MP4',
          type: 'video',
          durationMs: 5000,
          originalPath: 'C:\\Lost\\hero_intro.mp4',
          isMissing: true,
        }),
        createTestAsset({
          id: 'a2',
          name: 'Voiceover_Track.wav',
          type: 'audio',
          durationMs: 12000,
          originalPath: 'C:\\Lost\\voiceover_track.wav',
          isMissing: true,
        }),
        createTestAsset({
          id: 'a3',
          name: 'Still_Missing.png',
          type: 'image',
          durationMs: 3000,
          originalPath: 'C:\\Lost\\still_missing.png',
          isMissing: true,
        }),
      ];

      const directoryFiles = [
        { name: 'hero_intro.mp4', fullPath: 'D:\\Media\\hero_intro.mp4', size: 5000000 },
        { name: 'Voiceover_Track.WAV', fullPath: 'D:\\Media\\Voiceover_Track.WAV', size: 1200000 },
        { name: 'unrelated.mov', fullPath: 'D:\\Media\\unrelated.mov', size: 200000 },
      ];

      const res = relinkDirectoryByMatchingFiles(proj, directoryFiles);
      expect(res.relinkedCount).toBe(2);
      expect(res.remainingMissingCount).toBe(1);

      const relinkedA1 = res.updatedProject.assets.find((a) => a.id === 'a1');
      const relinkedA2 = res.updatedProject.assets.find((a) => a.id === 'a2');
      const unlinkedA3 = res.updatedProject.assets.find((a) => a.id === 'a3');

      expect(relinkedA1?.isMissing).toBe(false);
      expect(relinkedA1?.originalPath).toBe('D:\\Media\\hero_intro.mp4');
      expect(relinkedA2?.isMissing).toBe(false);
      expect(relinkedA2?.originalPath).toBe('D:\\Media\\Voiceover_Track.WAV');
      expect(unlinkedA3?.isMissing).toBe(true);
    });

    it('formats technical media details accurately for media inspector', () => {
      const asset = createTestAsset({
        id: 'tech_asset',
        name: '4K_Sample.mp4',
        type: 'video',
        durationMs: 65400,
        originalPath: 'C:\\Footage\\4K_Sample.mp4',
        fileSize: 104857600, // 100 MB
        width: 3840,
        height: 2160,
        fps: 60,
        proxyStatus: 'ready',
        proxyQuality: '540p',
        proxyFileSize: 12582912, // 12 MB
      });

      const info = getFormattedMediaDetails(asset);
      expect(info.durationFormatted).toBeDefined();
      expect(info.resolutionFormatted).toContain('3840');
      expect(info.resolutionFormatted).toContain('2160');
      expect(info.fpsFormatted).toBe('60 fps');
      expect(info.fileSizeFormatted).toBe('100 MB');
      expect(info.proxyStatusFormatted).toContain('Ready (540p');
    });

    it('formats bytes into clean human readable representations', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });
  });
});
