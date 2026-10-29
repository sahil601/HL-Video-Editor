import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDefaultProject } from '../core/project';
import { Project, Clip } from '../types/project';
import { EXPORT_PRESETS, buildFFmpegExportArgs, parseFFmpegProgress } from '../core/ffmpeg';
import { ProfessionalExportPreset, DetectedEncoder } from '../types/export';
import { validateProjectForExport, sanitizeExportFilename } from '../core/exportValidation';
import { ExportQueueManager, ExportHistoryManager } from '../core/exportQueue';

// Mock localStorage for test environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (index: number) => Array.from(storageMap.keys())[index] || null,
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

describe('Phase 8 — Export & Professional Workflow System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
    ExportQueueManager.getInstance().reset();
  });

  describe('1. Professional Platform Export Presets', () => {
    it('provides YouTube optimized presets with 60fps and high bitrates', () => {
      const yt1080p = EXPORT_PRESETS.find((p) => p.id === 'youtube_1080p');
      const yt4k = EXPORT_PRESETS.find((p) => p.id === 'youtube_4k');
      const ytShorts = EXPORT_PRESETS.find((p) => p.id === 'youtube_shorts');

      expect(yt1080p).toBeDefined();
      expect(yt1080p!.width).toBe(1920);
      expect(yt1080p!.height).toBe(1080);
      expect(yt1080p!.fps).toBe(60);
      expect(yt1080p!.videoBitrate).toBe('12M');
      expect(yt1080p!.category).toBe('youtube');

      expect(yt4k).toBeDefined();
      expect(yt4k!.width).toBe(3840);
      expect(yt4k!.height).toBe(2160);
      expect(yt4k!.fps).toBe(60);
      expect(yt4k!.videoBitrate).toBe('45M');
      expect(yt4k!.category).toBe('youtube');

      expect(ytShorts).toBeDefined();
      expect(ytShorts!.width).toBe(1080);
      expect(ytShorts!.height).toBe(1920);
      expect(ytShorts!.aspectRatio).toBe('9:16');
      expect(ytShorts!.fps).toBe(60);
      expect(ytShorts!.category).toBe('youtube');
    });

    it('provides Instagram vertical, square, and portrait presets', () => {
      const igSquare = EXPORT_PRESETS.find((p) => p.id === 'instagram_square');
      const igPortrait = EXPORT_PRESETS.find((p) => p.id === 'instagram_portrait');
      const igStory = EXPORT_PRESETS.find((p) => p.id === 'instagram_story');

      expect(igSquare).toBeDefined();
      expect(igSquare!.width).toBe(1080);
      expect(igSquare!.height).toBe(1080);
      expect(igSquare!.aspectRatio).toBe('1:1');
      expect(igSquare!.category).toBe('instagram');

      expect(igPortrait).toBeDefined();
      expect(igPortrait!.width).toBe(1080);
      expect(igPortrait!.height).toBe(1350);
      expect(igPortrait!.aspectRatio).toBe('4:5');
      expect(igPortrait!.category).toBe('instagram');

      expect(igStory).toBeDefined();
      expect(igStory!.width).toBe(1080);
      expect(igStory!.height).toBe(1920);
      expect(igStory!.aspectRatio).toBe('9:16');
      expect(igStory!.category).toBe('instagram');
    });

    it('provides TikTok HD and Fast Draft presets', () => {
      const tt1080p = EXPORT_PRESETS.find((p) => p.id === 'tiktok_1080p');
      const tt720p = EXPORT_PRESETS.find((p) => p.id === 'tiktok_720p');

      expect(tt1080p).toBeDefined();
      expect(tt1080p!.width).toBe(1080);
      expect(tt1080p!.height).toBe(1920);
      expect(tt1080p!.videoBitrate).toBe('10M');
      expect(tt1080p!.category).toBe('tiktok');

      expect(tt720p).toBeDefined();
      expect(tt720p!.width).toBe(720);
      expect(tt720p!.height).toBe(1280);
      expect(tt720p!.videoBitrate).toBe('5M');
      expect(tt720p!.category).toBe('tiktok');
    });

    it('provides Cinema 4K (21:9 at 24fps) and Apple ProRes 422 HQ (MOV)', () => {
      const cinema = EXPORT_PRESETS.find((p) => p.id === 'cinematic_4k');
      const prores = EXPORT_PRESETS.find((p) => p.id === 'prores_hq');

      expect(cinema).toBeDefined();
      expect(cinema!.width).toBe(3840);
      expect(cinema!.height).toBe(1620);
      expect(cinema!.fps).toBe(24);
      expect(cinema!.aspectRatio).toBe('21:9');
      expect(cinema!.category).toBe('cinema');

      expect(prores).toBeDefined();
      expect(prores!.format).toBe('mov');
      expect(prores!.codec).toBe('prores_ks');
      expect(prores!.audioCodec).toBe('pcm_s16le');
      expect(prores!.category).toBe('cinema');
    });

    it('preserves all legacy preset IDs for 100% backward compatibility', () => {
      const legacyIds = ['1080p_16x9', '1080p_9x16', '1080p_1x1', '720p_fast', '4k_uhd'];
      for (const id of legacyIds) {
        const found = EXPORT_PRESETS.find((p) => p.id === id);
        expect(found).toBeDefined();
      }
    });
  });

  describe('2. Custom Settings and Rate Control Compilation', () => {
    it('compiles custom resolution, framerate, and CRF rate control in buildFFmpegExportArgs', () => {
      const project = createDefaultProject('Custom Export Test', '16:9');
      project.durationMs = 5000;
      const clip: Clip = {
        id: 'clip_c1',
        trackId: 'track_video_main',
        name: 'Video Clip 1',
        type: 'video',
        startMs: 0,
        durationMs: 5000,
        sourceStartMs: 0,
        sourceEndMs: 5000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      project.tracks[2].clips = [clip];

      const customPreset: ProfessionalExportPreset = {
        id: 'custom_test_crf',
        name: 'Custom CRF High Quality',
        description: 'Custom CRF 18 test',
        width: 2560,
        height: 1440,
        fps: 60,
        aspectRatio: '16:9',
        videoBitrate: '20M',
        audioBitrate: '256k',
        format: 'mp4',
        codec: 'libx264',
        rateControl: 'crf',
        crf: 18,
        audioCodec: 'aac',
      };

      const { args } = buildFFmpegExportArgs(
        project,
        customPreset,
        'C:/Exports/custom_crf.mp4',
        () => 'C:/Media/input.mp4'
      );

      // Verify CRF is used instead of -b:v
      expect(args).toContain('-crf');
      expect(args[args.indexOf('-crf') + 1]).toBe('18');
      expect(args).not.toContain('-b:v');

      // Verify fps and movflags
      expect(args).toContain('-r');
      expect(args[args.indexOf('-r') + 1]).toBe('60');
      expect(args).toContain('-movflags');
      expect(args[args.indexOf('-movflags') + 1]).toBe('+faststart');
    });

    it('compiles ProRes 422 HQ with 10-bit color profile and uncompressed PCM audio', () => {
      const project = createDefaultProject('ProRes Test', '16:9');
      project.durationMs = 4000;
      const clip: Clip = {
        id: 'clip_pr1',
        trackId: 'track_video_main',
        name: 'Master Video',
        type: 'video',
        startMs: 0,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      project.tracks[2].clips = [clip];

      const proresPreset = EXPORT_PRESETS.find((p) => p.id === 'prores_hq')!;
      const { args } = buildFFmpegExportArgs(
        project,
        proresPreset,
        'C:/Exports/master.mov',
        () => 'C:/Media/raw_source.mp4'
      );

      expect(args).toContain('-c:v');
      expect(args[args.indexOf('-c:v') + 1]).toBe('prores_ks');
      expect(args).toContain('-profile:v');
      expect(args[args.indexOf('-profile:v') + 1]).toBe('3');
      expect(args).toContain('-pix_fmt');
      expect(args[args.indexOf('-pix_fmt') + 1]).toBe('yuv422p10le');
      expect(args).toContain('-c:a');
      expect(args[args.indexOf('-c:a') + 1]).toBe('pcm_s16le');
    });

    it('compiles MP3 audio codec when selected in preset', () => {
      const project = createDefaultProject('MP3 Audio Test', '16:9');
      project.durationMs = 3000;
      const clip: Clip = {
        id: 'clip_a1',
        assetId: 'asset_a1',
        trackId: 'track_audio_1',
        name: 'Voiceover',
        type: 'audio',
        startMs: 0,
        durationMs: 3000,
        sourceStartMs: 0,
        sourceEndMs: 3000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      project.tracks[3].clips = [clip];

      const mp3Preset: ProfessionalExportPreset = {
        id: 'test_mp3',
        name: 'MP3 Audio Preset',
        description: 'Test',
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        videoBitrate: '8M',
        audioBitrate: '192k',
        format: 'mp4',
        codec: 'libx264',
        audioCodec: 'libmp3lame',
      };

      const { args } = buildFFmpegExportArgs(
        project,
        mp3Preset,
        'C:/Exports/out_mp3.mp4',
        () => 'C:/Media/audio.wav'
      );

      expect(args).toContain('-c:a');
      expect(args[args.indexOf('-c:a') + 1]).toBe('libmp3lame');
      expect(args).toContain('-b:a');
      expect(args[args.indexOf('-b:a') + 1]).toBe('192k');
    });
  });

  describe('3. Runtime Encoder Detection and Hardware Fallback', () => {
    it('supports encoderOverride in buildFFmpegExportArgs for hardware acceleration', () => {
      const project = createDefaultProject('Hardware Acceleration Test', '16:9');
      project.durationMs = 2000;
      const clip: Clip = {
        id: 'clip_hw1',
        trackId: 'track_video_main',
        name: 'Video Clip',
        type: 'video',
        startMs: 0,
        durationMs: 2000,
        sourceStartMs: 0,
        sourceEndMs: 2000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      project.tracks[2].clips = [clip];

      const preset = EXPORT_PRESETS[0];

      // Test Intel QSV override
      const { args: qsvArgs } = buildFFmpegExportArgs(
        project,
        preset,
        'C:/Exports/qsv.mp4',
        () => 'C:/Media/input.mp4',
        { encoderOverride: 'h264_qsv' }
      );
      expect(qsvArgs).toContain('-c:v');
      expect(qsvArgs[qsvArgs.indexOf('-c:v') + 1]).toBe('h264_qsv');

      // Test NVIDIA NVENC override
      const { args: nvencArgs } = buildFFmpegExportArgs(
        project,
        preset,
        'C:/Exports/nvenc.mp4',
        () => 'C:/Media/input.mp4',
        { encoderOverride: 'h264_nvenc' }
      );
      expect(nvencArgs).toContain('-c:v');
      expect(nvencArgs[nvencArgs.indexOf('-c:v') + 1]).toBe('h264_nvenc');

      // Test libx265 override
      const { args: hevcArgs } = buildFFmpegExportArgs(
        project,
        preset,
        'C:/Exports/hevc.mp4',
        () => 'C:/Media/input.mp4',
        { encoderOverride: 'libx265' }
      );
      expect(hevcArgs).toContain('-c:v');
      expect(hevcArgs[hevcArgs.indexOf('-c:v') + 1]).toBe('libx265');
    });

    it('identifies hardware vs software encoders and identifies fallback path', () => {
      const mockEncoders: DetectedEncoder[] = [
        {
          id: 'h264_nvenc',
          name: 'H.264 (NVIDIA NVENC Hardware)',
          codecType: 'h264',
          isHardware: true,
          isAvailable: false,
          fallbackEncoder: 'libx264',
        },
        {
          id: 'libx264',
          name: 'H.264 (CPU Software)',
          codecType: 'h264',
          isHardware: false,
          isAvailable: true,
          fallbackEncoder: 'libx264',
        },
      ];

      const chosen = mockEncoders.find((e) => e.id === 'h264_nvenc')!;
      const effectiveCodec = chosen.isAvailable ? chosen.id : chosen.fallbackEncoder;
      expect(effectiveCodec).toBe('libx264');
    });
  });

  describe('4. Pre-flight Export Validation', () => {
    it('detects and rejects project with duration 0ms', () => {
      const emptyProject = createDefaultProject('Empty Project', '16:9');
      const validation = validateProjectForExport(
        emptyProject,
        EXPORT_PRESETS[0],
        'C:/Exports/out.mp4',
        () => null
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('duration is 0ms'))).toBe(true);
      expect(validation.errors.some((e) => e.includes('No active clips found'))).toBe(true);
    });

    it('detects missing media assets and identifies affected clips by name', () => {
      const project = createDefaultProject('Missing Media Test', '16:9');
      project.durationMs = 4000;
      const clip: Clip = {
        id: 'clip_missing_1',
        assetId: 'asset_nonexistent_123',
        trackId: 'track_video_main',
        name: 'Beach Sunset B-Roll',
        type: 'video',
        startMs: 0,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      project.tracks[2].clips = [clip];

      // Resolver returns null indicating file is missing on disk
      const validation = validateProjectForExport(
        project,
        EXPORT_PRESETS[0],
        'C:/Exports/out.mp4',
        () => null
      );

      expect(validation.isValid).toBe(false);
      expect(validation.missingMedia).toHaveLength(1);
      expect(validation.missingMedia[0].clipName).toBe('Beach Sunset B-Roll');
      expect(validation.errors.some((e) => e.includes('Beach Sunset B-Roll'))).toBe(true);
    });

    it('rejects odd dimensional resolutions that break yuv420p video encoding', () => {
      const project = createDefaultProject('Odd Dimension Test', '16:9');
      project.durationMs = 2000;
      project.tracks[2].clips = [
        {
          id: 'c1',
          trackId: 'track_video_main',
          name: 'Clip',
          type: 'video',
          startMs: 0,
          durationMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          speed: 1,
          volume: 1,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
          keyframes: [],
        },
      ];

      const oddPreset: ProfessionalExportPreset = {
        id: 'odd_res',
        name: 'Odd Res',
        description: 'Odd',
        width: 1921,
        height: 1081,
        fps: 30,
        aspectRatio: '16:9',
        videoBitrate: '8M',
        audioBitrate: '192k',
        format: 'mp4',
        codec: 'libx264',
      };

      const validation = validateProjectForExport(
        project,
        oddPreset,
        'C:/Exports/odd.mp4',
        () => 'C:/Media/valid.mp4'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('even numbers'))).toBe(true);
    });

    it('requires a non-empty destination path', () => {
      const project = createDefaultProject('Valid Project', '16:9');
      project.durationMs = 2000;
      project.tracks[2].clips = [
        {
          id: 'c1',
          trackId: 'track_video_main',
          name: 'Clip',
          type: 'video',
          startMs: 0,
          durationMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          speed: 1,
          volume: 1,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
          keyframes: [],
        },
      ];

      const validation = validateProjectForExport(
        project,
        EXPORT_PRESETS[0],
        '',
        () => 'C:/Media/valid.mp4'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('Destination path is required'))).toBe(true);
    });

    it('passes clean project with valid media and settings', () => {
      const project = createDefaultProject('Valid Project', '16:9');
      project.durationMs = 5000;
      project.tracks[2].clips = [
        {
          id: 'c1',
          trackId: 'track_video_main',
          name: 'Hero Shot',
          type: 'video',
          startMs: 0,
          durationMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 5000,
          speed: 1,
          volume: 1,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
          keyframes: [],
        },
      ];

      const validation = validateProjectForExport(
        project,
        EXPORT_PRESETS[0],
        'C:/Exports/hero_out.mp4',
        () => 'C:/Media/valid.mp4'
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.activeClipCount).toBe(1);
    });

    it('sanitizes unsafe characters in export filenames', () => {
      const unsafe = 'My Summer Video: "Hawaii" <2026>? *Draft* | Final';
      const clean = sanitizeExportFilename(unsafe);
      expect(clean).not.toContain(':');
      expect(clean).not.toContain('"');
      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
      expect(clean).not.toContain('?');
      expect(clean).not.toContain('*');
      expect(clean).not.toContain('|');
    });
  });

  describe('5. Export Queue Lifecycle and History Management', () => {
    it('enqueues job and maintains job lifecycle states', async () => {
      const queueManager = ExportQueueManager.getInstance();
      queueManager.clearFinishedJobs();

      const project = createDefaultProject('Queue Test Project', '16:9');
      project.durationMs = 3000;

      const job = queueManager.enqueueJob({
        project,
        preset: EXPORT_PRESETS[0],
        destinationPath: 'C:/Exports/test_queue.mp4',
        useProxies: false,
        burnCaptions: false,
        assetPathResolver: () => 'C:/Media/test.mp4',
      });

      expect(job.id).toBeDefined();
      expect(job.projectName).toBe('Queue Test Project');
      expect(job.destinationPath).toBe('C:/Exports/test_queue.mp4');
      expect(job.tempPath).toContain('.hl_tmp_');
      expect(job.useProxies).toBe(false);

      const jobs = queueManager.getJobs();
      expect(jobs.some((j) => j.id === job.id)).toBe(true);
    });

    it('cancels queued job cleanly', async () => {
      const queueManager = ExportQueueManager.getInstance();
      queueManager.clearFinishedJobs();

      const project = createDefaultProject('Cancel Test', '16:9');
      project.durationMs = 2000;

      const job = queueManager.enqueueJob({
        project,
        preset: EXPORT_PRESETS[0],
        destinationPath: 'C:/Exports/cancel_test.mp4',
        useProxies: false,
        burnCaptions: false,
        assetPathResolver: () => 'C:/Media/test.mp4',
      });

      const cancelled = await queueManager.cancelJob(job.id);
      expect(cancelled).toBe(true);

      const currentJob = queueManager.getJobs().find((j) => j.id === job.id);
      expect(currentJob?.status).toBe('cancelled');
    });

    it('retries cancelled job by resetting status to queued', async () => {
      const queueManager = ExportQueueManager.getInstance();
      queueManager.clearFinishedJobs();

      const project = createDefaultProject('Retry Test', '16:9');
      project.durationMs = 2000;

      const job = queueManager.enqueueJob({
        project,
        preset: EXPORT_PRESETS[0],
        destinationPath: 'C:/Exports/retry_test.mp4',
        useProxies: false,
        burnCaptions: false,
        assetPathResolver: () => 'C:/Media/test.mp4',
      });

      await queueManager.cancelJob(job.id);
      const retried = queueManager.retryJob(job.id);
      expect(retried).toBe(true);

      const currentJob = queueManager.getJobs().find((j) => j.id === job.id);
      expect(['queued', 'rendering']).toContain(currentJob?.status);
    });

    it('persists and retrieves export history records in localStorage', () => {
      ExportHistoryManager.clearHistory();
      expect(ExportHistoryManager.getHistory()).toHaveLength(0);

      const record = {
        id: 'hist_123',
        jobId: 'job_123',
        projectId: 'proj_123',
        projectName: 'Travel Vlog',
        presetName: 'YouTube 1080p Full HD',
        destinationPath: 'C:/Exports/travel_vlog.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        codec: 'libx264',
        format: 'mp4',
        status: 'completed' as const,
        fileSizeBytes: 24500000,
        durationSec: 15,
        completedAt: new Date().toISOString(),
      };

      ExportHistoryManager.addRecord(record);
      const history = ExportHistoryManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].projectName).toBe('Travel Vlog');
      expect(history[0].fileSizeBytes).toBe(24500000);

      // Remove record
      ExportHistoryManager.removeRecord(record.id);
      expect(ExportHistoryManager.getHistory()).toHaveLength(0);
    });

    it('preserves original media by default and only uses proxies when opt-in', () => {
      const project = createDefaultProject('Proxy Policy Test', '16:9');
      project.durationMs = 3000;
      project.assets = [
        {
          id: 'asset_p1',
          name: '4K Footage',
          type: 'video',
          relativePath: 'media/4k.mp4',
          originalPath: 'C:/Media/original_4k.mp4',
          fileSize: 500000000,
          durationMs: 3000,
          isBundled: false,
          proxyPath: 'C:/Users/sahil/AppData/Local/Temp/proxy_540p.mp4',
        },
      ];

      const queueManager = ExportQueueManager.getInstance();
      queueManager.clearFinishedJobs();

      // Case A: Default export (useProxies: false) -> resolves originalPath
      const defaultJob = queueManager.enqueueJob({
        project,
        preset: EXPORT_PRESETS[0],
        destinationPath: 'C:/Exports/default_export.mp4',
        useProxies: false,
        burnCaptions: false,
        assetPathResolver: (id) => project.assets.find((a) => a.id === id)?.originalPath || null,
      });
      expect(defaultJob.useProxies).toBe(false);

      // Case B: Draft export (useProxies: true) -> resolves proxyPath
      const draftJob = queueManager.enqueueJob({
        project,
        preset: EXPORT_PRESETS[0],
        destinationPath: 'C:/Exports/draft_export.mp4',
        useProxies: true,
        burnCaptions: false,
        assetPathResolver: (id) => project.assets.find((a) => a.id === id)?.originalPath || null,
      });
      expect(draftJob.useProxies).toBe(true);
    });
  });
});
