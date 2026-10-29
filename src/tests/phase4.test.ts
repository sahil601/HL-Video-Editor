import { describe, it, expect } from 'vitest';
import {
  parseSilenceOutput,
  parseSceneOutput,
  invertSilenceToSpeech,
  computeAutoCuts,
  applyAutoCutsToTimeline,
} from '../core/autoCut';
import {
  WATERMARK_CORNER_PRESETS,
  detectWatermarkCornerCandidate,
  interpolateWatermarkPosition,
  calculateWatermarkPixelRect,
  buildWatermarkFFmpegFilters,
} from '../core/watermark';
import { createDefaultProject } from '../core/project';
import { Clip, Project, Track, ProposedCut, WatermarkRemoverSettings } from '../types/project';
import { buildFFmpegExportArgs, EXPORT_PRESETS } from '../core/ffmpeg';
import { validateProjectManifest } from '../core/project';

describe('Phase 4: Auto Cut Engine', () => {
  it('parses raw FFmpeg silencedetect output accurately into intervals', () => {
    const sampleStderr = `
[silencedetect @ 000001f3e7b10280] silence_start: 1.425
[silencedetect @ 000001f3e7b10280] silence_end: 3.850 | silence_duration: 2.425
[silencedetect @ 000001f3e7b10280] silence_start: 7.100
[silencedetect @ 000001f3e7b10280] silence_end: 9.300 | silence_duration: 2.200
    `.trim();

    const silences = parseSilenceOutput(sampleStderr);
    expect(silences).toHaveLength(2);
    expect(silences[0].startMs).toBe(1425);
    expect(silences[0].endMs).toBe(3850);
    expect(silences[0].durationMs).toBe(2425);

    expect(silences[1].startMs).toBe(7100);
    expect(silences[1].endMs).toBe(9300);
    expect(silences[1].durationMs).toBe(2200);
  });

  it('parses raw FFmpeg scene showinfo output into timestamps and filters rapid duplicates', () => {
    const sampleShowinfo = `
[Parsed_showinfo_1 @ 0000021b2] n: 30 pts: 3000 pts_time: 1.000000 pos: 1024
[Parsed_showinfo_1 @ 0000021b2] n: 33 pts: 3300 pts_time: 1.100000 pos: 2048
[Parsed_showinfo_1 @ 0000021b2] n: 120 pts: 12000 pts_time: 4.000000 pos: 8192
    `.trim();

    const sceneChanges = parseSceneOutput(sampleShowinfo, 800); // 800ms min distance
    expect(sceneChanges).toHaveLength(2);
    expect(sceneChanges[0].timeMs).toBe(1000);
    expect(sceneChanges[1].timeMs).toBe(4000); // 1.1s was skipped due to minSceneDuration
  });

  it('inverts silences to speech with padding and merges near gaps', () => {
    const totalDurationMs = 10000;
    const silences = [
      { startMs: 2000, endMs: 4000, durationMs: 2000 },
      { startMs: 7000, endMs: 8500, durationMs: 1500 },
    ];

    const speech = invertSilenceToSpeech(totalDurationMs, silences, 200, 200, 150);
    expect(speech.length).toBeGreaterThanOrEqual(2);

    // Segment 1 should start at 0 and end padded into silence (2000 + 200 = 2200)
    expect(speech[0].startMs).toBe(0);
    expect(speech[0].endMs).toBe(2200);

    // Segment 2 should start padded before speech (4000 - 200 = 3800)
    expect(speech[1].startMs).toBe(3800);
  });

  it('computes proposed cuts and respects target duration budgets (e.g. 15s short-form)', () => {
    const clipDurMs = 45000; // 45 seconds total
    const silences = [
      { startMs: 5000, endMs: 8000, durationMs: 3000 },
      { startMs: 16000, endMs: 20000, durationMs: 4000 },
      { startMs: 28000, endMs: 33000, durationMs: 5000 },
    ];
    const sceneChanges = [{ timeMs: 10000 }, { timeMs: 22000 }];

    const result = computeAutoCuts(clipDurMs, silences, sceneChanges, {
      sensitivity: 0.3,
      minSceneDurationMs: 1000,
      silenceThresholdDb: -30,
      minSilenceDurationMs: 500,
      speechPaddingBeforeMs: 200,
      speechPaddingAfterMs: 200,
      targetDurationSec: 15, // 15s budget
    });

    expect(result.proposedCuts.length).toBeGreaterThan(0);
    expect(result.originalDurationMs).toBe(45000);
    expect(result.projectedDurationMs).toBeLessThanOrEqual(15000 * 1.15); // Budget within target tolerance
    expect(result.timeSavedMs).toBeGreaterThan(15000);
    expect(result.percentSaved).toBeGreaterThan(50);
  });

  it('protects against zero-length or hyper-short clips (< 150ms)', () => {
    const clipDurMs = 5000;
    // Tiny speech glitch between 1000 and 1050 (50ms)
    const silences = [
      { startMs: 0, endMs: 1000, durationMs: 1000 },
      { startMs: 1080, endMs: 4900, durationMs: 3820 },
    ];

    const result = computeAutoCuts(clipDurMs, silences, [], {
      sensitivity: 0.3,
      minSceneDurationMs: 1000,
      silenceThresholdDb: -30,
      minSilenceDurationMs: 500,
      speechPaddingBeforeMs: 0,
      speechPaddingAfterMs: 0,
      targetDurationSec: 'all',
    });

    // Zero-length clips (<150ms) must never be emitted as independent cuts
    for (const cut of result.proposedCuts) {
      expect(cut.durationMs).toBeGreaterThanOrEqual(150);
    }
  });

  it('applies auto-cuts to timeline, preserves audio/video sync, and updates duration safely', () => {
    const project = createDefaultProject();
    const videoTrack = project.tracks.find((t) => t.type === 'video')!;

    const testClip: Clip = {
      id: 'target_clip_1',
      trackId: videoTrack.id,
      assetId: 'asset_1',
      name: 'Main Interview Video',
      type: 'video',
      startMs: 0,
      durationMs: 10000,
      sourceStartMs: 5000, // Starts at 5s in source file
      sourceEndMs: 15000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    videoTrack.clips = [testClip];
    project.durationMs = 10000;

    const approvedCuts: ProposedCut[] = [
      {
        id: 'cut_1',
        startMs: 0,
        endMs: 3000,
        durationMs: 3000,
        sourceStartMs: 0,
        sourceEndMs: 3000,
        type: 'speech',
        confidence: 0.9,
        included: true,
        reason: 'First speech sentence',
      },
      {
        id: 'cut_2',
        startMs: 6000,
        endMs: 9000,
        durationMs: 3000,
        sourceStartMs: 6000,
        sourceEndMs: 9000,
        type: 'speech',
        confidence: 0.9,
        included: true,
        reason: 'Second speech sentence',
      },
    ];

    const updatedProject = applyAutoCutsToTimeline(project, 'target_clip_1', approvedCuts, '9:16');
    const updatedTrack = updatedProject.tracks.find((t) => t.id === videoTrack.id)!;

    expect(updatedTrack.clips).toHaveLength(2);

    // First slice
    expect(updatedTrack.clips[0].startMs).toBe(0);
    expect(updatedTrack.clips[0].durationMs).toBe(3000);
    expect(updatedTrack.clips[0].sourceStartMs).toBe(5000 + 0); // Preserves media sync
    expect(updatedTrack.clips[0].sourceEndMs).toBe(5000 + 3000);

    // Second slice placed contiguous to first slice on timeline
    expect(updatedTrack.clips[1].startMs).toBe(3000);
    expect(updatedTrack.clips[1].durationMs).toBe(3000);
    expect(updatedTrack.clips[1].sourceStartMs).toBe(5000 + 6000);
    expect(updatedTrack.clips[1].sourceEndMs).toBe(5000 + 9000);

    // Total project duration updated to 6000ms
    expect(updatedProject.durationMs).toBe(6000);

    // Aspect ratio updated to 9:16 vertical
    expect(updatedProject.settings.aspectRatio).toBe('9:16');
    expect(updatedProject.settings.width).toBe(1080);
    expect(updatedProject.settings.height).toBe(1920);
  });
});

describe('Phase 4: Watermark Remover Engine', () => {
  it('provides standard location corner presets and candidate detector', () => {
    expect(WATERMARK_CORNER_PRESETS.length).toBeGreaterThanOrEqual(4);
    const topRight = WATERMARK_CORNER_PRESETS.find((p) => p.corner === 'top_right')!;
    expect(topRight.positionX).toBeGreaterThanOrEqual(75);
    expect(topRight.positionY).toBeLessThanOrEqual(10);

    const candidate = detectWatermarkCornerCandidate(1920, 1080);
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.8);
    expect(candidate.candidate.detectedCandidate).toBe(true);
    expect(candidate.candidate.userConfirmed).toBe(false); // User confirmation required
  });

  it('calculates safe even pixel coordinates for FFmpeg YUV compatibility', () => {
    const settings: WatermarkRemoverSettings = {
      enabled: true,
      shape: 'rectangle',
      positionX: 80.5,
      positionY: 5.2,
      width: 15.3,
      height: 7.9,
      feather: 4,
      method: 'delogo',
    };

    const rect = calculateWatermarkPixelRect(settings, 1920, 1080);
    expect(rect.x % 2).toBe(0);
    expect(rect.y % 2).toBe(0);
    expect(rect.w % 2).toBe(0);
    expect(rect.h % 2).toBe(0);
    expect(rect.x + rect.w).toBeLessThanOrEqual(1920);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1080);
  });

  it('interpolates watermark position across tracking keyframes over time', () => {
    const settings: WatermarkRemoverSettings = {
      enabled: true,
      shape: 'rectangle',
      positionX: 10,
      positionY: 10,
      width: 15,
      height: 8,
      feather: 4,
      method: 'delogo',
      trackingKeyframes: [
        { offsetMs: 0, positionX: 10, positionY: 10, width: 15, height: 8 },
        { offsetMs: 2000, positionX: 30, positionY: 50, width: 20, height: 10 },
      ],
    };

    // At offset 1000ms (halfway)
    const mid = interpolateWatermarkPosition(settings, 1000);
    expect(mid.positionX).toBe(20);
    expect(mid.positionY).toBe(30);
    expect(mid.width).toBe(17.5);
    expect(mid.height).toBe(9);

    // Before start / after end clamping
    expect(interpolateWatermarkPosition(settings, -500).positionX).toBe(10);
    expect(interpolateWatermarkPosition(settings, 3000).positionX).toBe(30);
  });

  it('generates valid FFmpeg filters for delogo, blur, pixelate, and crop methods', () => {
    const baseSettings: WatermarkRemoverSettings = {
      enabled: true,
      shape: 'rectangle',
      positionX: 80,
      positionY: 5,
      width: 16,
      height: 8,
      feather: 4,
      method: 'delogo',
      startMs: 1000,
      endMs: 4000,
    };

    // Delogo
    const delogoFilters = buildWatermarkFFmpegFilters(baseSettings, 1920, 1080);
    expect(delogoFilters[0]).toContain('delogo=');
    expect(delogoFilters[0]).toContain("enable='between(t,1.00,4.00)'");

    // Blur
    const blurFilters = buildWatermarkFFmpegFilters({ ...baseSettings, method: 'blur' }, 1920, 1080);
    expect(blurFilters[0]).toContain('delogo='); // High-band inpainting blur

    // Pixelate
    const pixFilters = buildWatermarkFFmpegFilters({ ...baseSettings, method: 'pixelate' }, 1920, 1080);
    expect(pixFilters[0]).toContain('delogo=');

    // Crop reframe for top watermark
    const cropFilters = buildWatermarkFFmpegFilters({ ...baseSettings, method: 'crop', positionY: 0 }, 1920, 1080);
    expect(cropFilters[0]).toContain('crop=');
  });

  it('integrates watermark filters into buildFFmpegExportArgs without breaking filtergraph', () => {
    const project = createDefaultProject();
    const videoTrack = project.tracks.find((t) => t.type === 'video')!;

    videoTrack.clips.push({
      id: 'clip_wm_test',
      trackId: videoTrack.id,
      assetId: 'asset_1',
      name: 'Watermarked Video',
      type: 'video',
      startMs: 0,
      durationMs: 5000,
      sourceStartMs: 0,
      sourceEndMs: 5000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
      watermarkRemover: {
        enabled: true,
        shape: 'rectangle',
        positionX: 82,
        positionY: 6,
        width: 14,
        height: 8,
        feather: 4,
        method: 'delogo',
      },
    });

    const preset = EXPORT_PRESETS[0];
    const { args } = buildFFmpegExportArgs(
      project,
      preset,
      'C:/test/out.mp4',
      () => 'C:/test/sample.mp4'
    );

    const filterComplexArg = args[args.indexOf('-filter_complex') + 1];
    expect(filterComplexArg).toContain('delogo=');
  });

  it('preserves WatermarkRemover settings across .vnest JSON serialization', () => {
    const project = createDefaultProject();
    project.watermarkRemover = {
      enabled: true,
      shape: 'oval',
      positionX: 75,
      positionY: 80,
      width: 20,
      height: 12,
      feather: 6,
      method: 'blur',
      blurIntensity: 14,
    };

    const json = JSON.stringify(project);
    const parsed = JSON.parse(json);
    const validation = validateProjectManifest(parsed);
    expect(validation.isValid).toBe(true);

    const restored = parsed as Project;
    expect(restored.watermarkRemover).toBeDefined();
    expect(restored.watermarkRemover?.shape).toBe('oval');
    expect(restored.watermarkRemover?.method).toBe('blur');
    expect(restored.watermarkRemover?.blurIntensity).toBe(14);
    expect(restored.watermarkRemover?.positionX).toBe(75);
  });
});
