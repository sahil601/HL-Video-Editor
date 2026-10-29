import { describe, it, expect } from 'vitest';
import {
  SPEED_CURVE_PRESETS,
  evaluateSpeedCurve,
  calculateSpeedCurveAverage,
  getSpeedCurveSourceTimeMs,
  generateSpeedCurveSegments,
} from '../core/speedCurves';
import {
  LOOK_PRESETS,
  getDefaultColorAdjustments,
  formatColorFilterCss,
} from '../core/colorPresets';
import { buildFFmpegExportArgs, EXPORT_PRESETS } from '../core/ffmpeg';
import { Project, Clip, Track } from '../types/project';
import { createVnestPackage, extractVnestPackage } from '../core/package';

describe('Phase 3 — Variable Speed Curves', () => {
  it('provides all required speed curve presets with normalized coordinates', () => {
    const requiredPresets = ['slow_motion', 'speed_ramp', 'montage', 'fast_to_slow', 'hero', 'bullet', 'jump_out'];
    const presetIds = SPEED_CURVE_PRESETS.map((p) => p.id);
    for (const req of requiredPresets) {
      expect(presetIds).toContain(req);
    }

    SPEED_CURVE_PRESETS.forEach((preset) => {
      expect(preset.points.length).toBeGreaterThanOrEqual(2);
      expect(preset.points[0].x).toBe(0.0);
      expect(preset.points[preset.points.length - 1].x).toBe(1.0);
      preset.points.forEach((pt) => {
        expect(pt.x).toBeGreaterThanOrEqual(0.0);
        expect(pt.x).toBeLessThanOrEqual(1.0);
        expect(pt.y).toBeGreaterThan(0.0);
        expect(pt.y).toBeLessThanOrEqual(10.0);
      });
    });
  });

  it('evaluates speed curve with smooth cosine interpolation and bounds safety', () => {
    const points = [
      { x: 0.0, y: 0.5 },
      { x: 0.5, y: 2.0 },
      { x: 1.0, y: 0.5 },
    ];

    expect(evaluateSpeedCurve(points, 0.0)).toBeCloseTo(0.5, 2);
    expect(evaluateSpeedCurve(points, 0.5)).toBeCloseTo(2.0, 2);
    expect(evaluateSpeedCurve(points, 1.0)).toBeCloseTo(0.5, 2);

    // Midpoint should be between 0.5 and 2.0
    const midSpeed = evaluateSpeedCurve(points, 0.25);
    expect(midSpeed).toBeGreaterThan(0.5);
    expect(midSpeed).toBeLessThan(2.0);

    // Negative or out of bounds inputs are clamped safely
    expect(evaluateSpeedCurve(points, -0.5)).toBeCloseTo(0.5, 2);
    expect(evaluateSpeedCurve(points, 1.5)).toBeCloseTo(0.5, 2);
    expect(evaluateSpeedCurve(undefined, 0.5)).toBe(1.0);
  });

  it('computes accurate source offset using numerical integration (preview & export parity)', () => {
    const slowMotion = SPEED_CURVE_PRESETS.find((p) => p.id === 'slow_motion')!;
    const clipDurationMs = 4000;

    // At t=0, source offset must be 0
    expect(getSpeedCurveSourceTimeMs(slowMotion.points, 0, clipDurationMs)).toBe(0);

    // At full duration, source offset must equal integral
    const fullSrcMs = getSpeedCurveSourceTimeMs(slowMotion.points, clipDurationMs, clipDurationMs);
    expect(fullSrcMs).toBeGreaterThan(0);
    // Since slow motion has speeds <= 1.0, source used should be less than real time
    expect(fullSrcMs).toBeLessThan(clipDurationMs);

    // Monotonically increasing check
    const t1 = getSpeedCurveSourceTimeMs(slowMotion.points, 1000, clipDurationMs);
    const t2 = getSpeedCurveSourceTimeMs(slowMotion.points, 2000, clipDurationMs);
    const t3 = getSpeedCurveSourceTimeMs(slowMotion.points, 3000, clipDurationMs);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });

  it('generates piecewise FFmpeg sub-segments summing to exact timeline duration', () => {
    const ramp = SPEED_CURVE_PRESETS.find((p) => p.id === 'speed_ramp')!;
    const totalSrcMs = getSpeedCurveSourceTimeMs(ramp.points, 5000, 5000);
    const segments = generateSpeedCurveSegments(ramp.points, 0, totalSrcMs, 5000, 8);

    expect(segments.length).toBe(8);
    const totalTimelineDuration = segments.reduce((sum, s) => sum + s.timelineDurationSec, 0);
    expect(totalTimelineDuration).toBeCloseTo(5.0, 3);

    segments.forEach((seg) => {
      expect(seg.sourceDurationSec).toBeGreaterThan(0);
      expect(seg.speed).toBeGreaterThanOrEqual(0.1);
      expect(seg.speed).toBeLessThanOrEqual(8.0);
    });
  });
});

describe('Phase 3 — Advanced Color Grading', () => {
  it('provides default color adjustments with zero offsets', () => {
    const def = getDefaultColorAdjustments();
    expect(def.exposure).toBe(0);
    expect(def.brightness).toBe(0);
    expect(def.contrast).toBe(0);
    expect(def.saturation).toBe(0);
    expect(def.temperature).toBe(0);
    expect(def.tint).toBe(0);
    expect(def.highlights).toBe(0);
    expect(def.shadows).toBe(0);
    expect(def.gamma).toBe(0);
    expect(def.fade).toBe(0);
    expect(def.vignette).toBe(0);
    expect(def.sharpen).toBe(0);
  });

  it('provides all required cinematic look presets with all Phase 3 properties', () => {
    expect(LOOK_PRESETS.length).toBeGreaterThanOrEqual(8);
    const presetNames = LOOK_PRESETS.map((p) => p.name);
    expect(presetNames).toContain('Normal');
    expect(presetNames).toContain('Teal & Orange');
    expect(presetNames).toContain('Golden Hour');
    expect(presetNames).toContain('Cool Cinema');
    expect(presetNames).toContain('Vintage 70s');
    expect(presetNames).toContain('Film Noir B&W');
    expect(presetNames).toContain('Cyberpunk Neon');

    LOOK_PRESETS.forEach((p) => {
      expect(p.adjustments.exposure).toBeDefined();
      expect(p.adjustments.gamma).toBeDefined();
      expect(p.adjustments.highlights).toBeDefined();
      expect(p.adjustments.shadows).toBeDefined();
      expect(p.adjustments.fade).toBeDefined();
      expect(p.adjustments.sharpen).toBeDefined();
    });
  });

  it('formats valid CSS filters reflecting exposure, gamma, temperature, and tint', () => {
    const tealOrange = LOOK_PRESETS.find((p) => p.name === 'Teal & Orange')!.adjustments;
    const css = formatColorFilterCss(tealOrange);
    expect(css).toContain('brightness(');
    expect(css).toContain('contrast(');
    expect(css).toContain('saturate(');
    expect(css).toContain('sepia(');
  });
});

describe('Phase 3 — Chroma Key & Advanced Masks', () => {
  it('properly configures despill and keying options in clip model', () => {
    const clip: Partial<Clip> = {
      chromaKey: {
        enabled: true,
        color: '#00FF00',
        similarity: 0.35,
        smoothness: 0.10,
        spill: 45,
      },
    };

    expect(clip.chromaKey?.enabled).toBe(true);
    expect(clip.chromaKey?.spill).toBe(45);
  });

  it('properly configures rectangle, circle, oval, and linear masks in clip model', () => {
    const clipCircle: Partial<Clip> = {
      mask: {
        shape: 'circle',
        positionX: 5,
        positionY: -10,
        scaleX: 1.2,
        scaleY: 1.2,
        feather: 20,
        inverted: false,
        rotation: 0,
      },
    };
    expect(clipCircle.mask?.shape).toBe('circle');
    expect(clipCircle.mask?.feather).toBe(20);

    const clipLinear: Partial<Clip> = {
      mask: {
        shape: 'linear',
        positionX: 0,
        positionY: 0,
        scaleX: 1,
        scaleY: 1,
        feather: 35,
        inverted: true,
        rotation: 45,
      },
    };
    expect(clipLinear.mask?.shape).toBe('linear');
    expect(clipLinear.mask?.inverted).toBe(true);
    expect(clipLinear.mask?.rotation).toBe(45);
  });
});

describe('Phase 3 — Text Controls, Shadows & Animations', () => {
  it('supports shadow offset, blur, opacity, and color in text properties', () => {
    const clip: Partial<Clip> = {
      type: 'text',
      textProperties: {
        text: 'HL Phase 3 Title',
        fontSize: 48,
        color: '#ffffff',
        textAlign: 'center',
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        shadowBlur: 12,
        shadowOpacity: 90,
        shadowColor: '#000000',
        inAnimation: 'slide',
        inAnimationDurationMs: 500,
        outAnimation: 'fade',
        outAnimationDurationMs: 400,
        fontFamily: 'CustomFont',
        customFontPath: 'C:/fonts/MyCustomFont.ttf',
      },
    };

    expect(clip.textProperties?.shadowOffsetX).toBe(4);
    expect(clip.textProperties?.shadowOffsetY).toBe(4);
    expect(clip.textProperties?.shadowBlur).toBe(12);
    expect(clip.textProperties?.inAnimation).toBe('slide');
    expect(clip.textProperties?.outAnimation).toBe('fade');
    expect(clip.textProperties?.customFontPath).toBe('C:/fonts/MyCustomFont.ttf');
  });
});

describe('Phase 3 — Project Save/Reopen Round-Trip Compatibility', () => {
  it('saves and restores all Phase 3 properties across .vnest format', async () => {
    const mockProject: Project = {
      schemaVersion: '1.0.0',
      generator: 'HL Video Editor 1.0.0',
      id: 'proj_phase3_test',
      name: 'Phase 3 Test Project',
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
      durationMs: 10000,
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        sampleRate: 48000,
        backgroundColor: '#000000',
      },
      tracks: [
        {
          id: 'track_v1',
          name: 'Video 1',
          type: 'video',
          order: 0,
          isMuted: false,
          isLocked: false,
          clips: [
            {
              id: 'clip_v1',
              trackId: 'track_v1',
              name: 'Action Clip',
              type: 'video',
              assetId: 'asset_1',
              startMs: 0,
              durationMs: 6000,
              sourceStartMs: 0,
              sourceEndMs: 6000,
              speed: 1.0,
              speedCurve: SPEED_CURVE_PRESETS[1].points, // Speed ramp
              speedCurvePreset: 'speed_ramp',
              pitchCorrection: true,
              muteAudioOnSpeed: false,
              volume: 1.0,
              fadeInMs: 0,
              fadeOutMs: 0,
              transform: {
                scale: 1.0,
                positionX: 0,
                positionY: 0,
                rotation: 0,
                opacity: 1.0,
              },
              chromaKey: {
                enabled: true,
                color: '#00FF00',
                similarity: 0.38,
                smoothness: 0.12,
                spill: 45,
              },
              colorAdjustments: {
                exposure: 15,
                brightness: 5,
                contrast: 20,
                saturation: 30,
                temperature: 10,
                tint: -5,
                highlights: 12,
                shadows: -10,
                gamma: 8,
                fade: 15,
                vignette: 25,
                sharpen: 30,
                presetName: 'Teal & Orange',
              },
              mask: {
                shape: 'oval',
                positionX: 0,
                positionY: 0,
                scaleX: 1.2,
                scaleY: 0.9,
                feather: 25,
                inverted: false,
                rotation: 15,
              },
              effects: [],
              keyframes: [],
            },
            {
              id: 'clip_text1',
              trackId: 'track_v1',
              name: 'Title Text',
              type: 'text',
              startMs: 6000,
              durationMs: 4000,
              sourceStartMs: 0,
              sourceEndMs: 4000,
              speed: 1.0,
              volume: 1.0,
              fadeInMs: 0,
              fadeOutMs: 0,
              transform: {
                scale: 1.0,
                positionX: 0,
                positionY: 20,
                rotation: 0,
                opacity: 1.0,
              },
              textProperties: {
                text: 'Phase 3 Cinematic Look',
                fontSize: 42,
                color: '#f8fafc',
                textAlign: 'center',
                shadowOffsetX: 2,
                shadowOffsetY: 4,
                shadowBlur: 10,
                shadowOpacity: 90,
                shadowColor: '#000000',
                inAnimation: 'zoom',
                inAnimationDurationMs: 600,
                outAnimation: 'fade',
                outAnimationDurationMs: 500,
                fontFamily: 'Montserrat',
              },
              effects: [],
              keyframes: [],
            },
          ],
        },
      ],
      assets: [
        {
          id: 'asset_1',
          name: 'action.mp4',
          type: 'video',
          relativePath: 'media/action.mp4',
          originalPath: 'C:/media/action.mp4',
          fileSize: 1024000,
          durationMs: 12000,
          fps: 30,
          width: 1920,
          height: 1080,
          isBundled: false,
        },
      ],
    };

    // Export to ZIP blob
    const zipBlob = await createVnestPackage(mockProject, new Map(), { includeMedia: false });
    expect(zipBlob.size).toBeGreaterThan(100);

    // Import from ZIP blob
    const restored = await extractVnestPackage(zipBlob);
    expect(restored.project.id).toBe(mockProject.id);

    const restoredVideo = restored.project.tracks[0].clips[0];
    expect(restoredVideo.speedCurve).toBeDefined();
    expect(restoredVideo.speedCurve?.length).toBe(SPEED_CURVE_PRESETS[1].points.length);
    expect(restoredVideo.pitchCorrection).toBe(true);
    expect(restoredVideo.chromaKey?.spill).toBe(45);
    expect(restoredVideo.colorAdjustments?.exposure).toBe(15);
    expect(restoredVideo.colorAdjustments?.fade).toBe(15);
    expect(restoredVideo.colorAdjustments?.sharpen).toBe(30);
    expect(restoredVideo.mask?.shape).toBe('oval');
    expect(restoredVideo.mask?.feather).toBe(25);

    const restoredText = restored.project.tracks[0].clips[1];
    expect(restoredText.textProperties?.shadowBlur).toBe(10);
    expect(restoredText.textProperties?.inAnimation).toBe('zoom');
    expect(restoredText.textProperties?.inAnimationDurationMs).toBe(600);
  });
});

describe('Phase 3 — FFmpeg Export Filtergraph Verification', () => {
  it('generates valid filtergraph containing speed curves, despill, color grading, and geq masks', () => {
    const project: Project = {
      schemaVersion: '1.0.0',
      generator: 'HL Video Editor 1.0.0',
      id: 'proj_export_test',
      name: 'Export Test',
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
      durationMs: 4000,
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        sampleRate: 48000,
        backgroundColor: '#000000',
      },
      tracks: [
        {
          id: 'v_track',
          name: 'Video',
          type: 'video',
          order: 0,
          isMuted: false,
          isLocked: false,
          clips: [
            {
              id: 'c1',
              trackId: 'v_track',
              name: 'Sample Clip',
              type: 'video',
              assetId: 'a1',
              startMs: 0,
              durationMs: 4000,
              sourceStartMs: 0,
              sourceEndMs: 4000,
              speed: 1.0,
              speedCurve: SPEED_CURVE_PRESETS[0].points, // Slow motion
              pitchCorrection: true,
              muteAudioOnSpeed: false,
              volume: 1.0,
              fadeInMs: 0,
              fadeOutMs: 0,
              transform: {
                scale: 1.0,
                positionX: 0,
                positionY: 0,
                rotation: 0,
                opacity: 1.0,
              },
              chromaKey: {
                enabled: true,
                color: '#00FF00',
                similarity: 0.35,
                smoothness: 0.10,
                spill: 50,
              },
              colorAdjustments: {
                exposure: 10,
                brightness: 5,
                contrast: 15,
                saturation: 20,
                temperature: 15,
                tint: -10,
                highlights: 10,
                shadows: -5,
                gamma: 5,
                fade: 20,
                vignette: 30,
                sharpen: 25,
              },
              mask: {
                shape: 'circle',
                positionX: 0,
                positionY: 0,
                scaleX: 1,
                scaleY: 1,
                feather: 15,
                inverted: false,
                rotation: 0,
              },
              effects: [],
              keyframes: [],
            },
          ],
        },
      ],
      assets: [
        {
          id: 'a1',
          name: 'video.mp4',
          type: 'video',
          relativePath: 'media/video.mp4',
          originalPath: 'C:/media/video.mp4',
          fileSize: 10000,
          durationMs: 5000,
          fps: 30,
          width: 1920,
          height: 1080,
          isBundled: false,
        },
      ],
    };

    const preset = EXPORT_PRESETS[0];
    const { args, inputFiles } = buildFFmpegExportArgs(
      project,
      preset,
      'C:/exports/test_phase3.mp4',
      () => 'C:/media/video.mp4'
    );

    expect(inputFiles.length).toBe(1);
    expect(args).toContain('-filter_complex');

    const filterArg = args[args.indexOf('-filter_complex') + 1];

    // Check variable speed curve split & concat
    expect(filterArg).toContain('split=8');
    expect(filterArg).toContain('concat=n=8:v=1:a=0');

    // Check despill
    expect(filterArg).toContain('despill=type=green:mix=0.50');

    // Check advanced color grading: eq, colorbalance, colorlevels, vignette, unsharp
    expect(filterArg).toContain('eq=');
    expect(filterArg).toContain('colorbalance=');
    expect(filterArg).toContain('colorlevels=');
    expect(filterArg).toContain('vignette=');
    expect(filterArg).toContain('unsharp=');

    // Check geq mask
    expect(filterArg).toContain('geq=');
    expect(filterArg).toContain('hypot(');

    // Check audio pitch preservation
    expect(filterArg).toContain('atempo=');
  });
});
