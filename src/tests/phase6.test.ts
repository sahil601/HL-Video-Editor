import { describe, it, expect } from 'vitest';
import { Project, Clip, Keyframe } from '../types/project';
import {
  parseCubeLut,
  applyLutToRgb,
  generateCubeString,
  generateCubeStringFromLut,
  BUILTIN_LUT_PRESETS,
} from '../core/lut';
import {
  getDefaultColorWheels,
  getDefaultColorAdjustments,
  wheelPuckToRgb,
  buildColorGradingFFmpegFilters,
  buildColorGradingCssFilter,
} from '../core/colorGrading';
import {
  EQUALIZER_PRESETS,
  getDefaultAudioProcessing,
  buildClipAudioFFmpegFilters,
  getDialogueIntervals,
  buildAudioDuckingFilter,
} from '../core/audioProcessing';
import { interpolateKeyframes } from '../core/keyframes';
import { createDefaultProject } from '../core/project';

describe('HL Phase 6 — Professional Color Grading and Audio', () => {
  // =========================================================================
  // 1. 3D LUT (.cube) Parser & Interpolation
  // =========================================================================
  describe('3D LUT (.cube) Parser & Interpolation', () => {
    it('parses a standard 3D .cube file string correctly', () => {
      const sampleCube = `
# Sample 3D LUT
TITLE "Test Vintage 3D"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
      const parsed = parseCubeLut(sampleCube);
      expect(parsed.title).toBe('Test Vintage 3D');
      expect(parsed.type).toBe('3d');
      expect(parsed.size).toBe(2);
      expect(parsed.domainMin).toEqual([0, 0, 0]);
      expect(parsed.domainMax).toEqual([1, 1, 1]);
      expect(parsed.data.length).toBe(2 * 2 * 2 * 3);
      expect(parsed.data[0]).toBe(0.0);
      expect(parsed.data[parsed.data.length - 1]).toBe(1.0);
    });

    it('parses a 1D .cube file string correctly', () => {
      const sample1DCube = `
TITLE "Gamma Correction 1D"
LUT_1D_SIZE 3
0.0 0.0 0.0
0.5 0.5 0.5
1.0 1.0 1.0
`;
      const parsed = parseCubeLut(sample1DCube);
      expect(parsed.title).toBe('Gamma Correction 1D');
      expect(parsed.type).toBe('1d');
      expect(parsed.size).toBe(3);
      expect(parsed.data.length).toBe(9);
    });

    it('infers 3D size if LUT_3D_SIZE header is omitted', () => {
      // 8 RGB lines = 2x2x2
      const noHeaderCube = `
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
      const parsed = parseCubeLut(noHeaderCube);
      expect(parsed.size).toBe(2);
      expect(parsed.type).toBe('3d');
    });

    it('applies trilinear interpolation and intensity blending', () => {
      // Identity 2x2x2 LUT
      const identityCube = `
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
      const lut = parseCubeLut(identityCube);
      // Midway sample [0.5, 0.5, 0.5] through identity LUT
      const [r, g, b] = applyLutToRgb(lut, 0.5, 0.5, 0.5, 1.0);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);

      // Inverted LUT
      const invertedCube = `
LUT_3D_SIZE 2
1.0 1.0 1.0
0.0 1.0 1.0
1.0 0.0 1.0
0.0 0.0 1.0
1.0 1.0 0.0
0.0 1.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
`;
      const invLut = parseCubeLut(invertedCube);
      // At intensity 0, returns original color
      const [origR] = applyLutToRgb(invLut, 0.2, 0.2, 0.2, 0.0);
      expect(origR).toBeCloseTo(0.2, 2);

      // At intensity 1, returns inverted color (1 - 0.2 = 0.8)
      const [invR] = applyLutToRgb(invLut, 0.2, 0.2, 0.2, 1.0);
      expect(invR).toBeCloseTo(0.8, 2);

      // At intensity 0.5, returns midpoint (0.5)
      const [midR] = applyLutToRgb(invLut, 0.2, 0.2, 0.2, 0.5);
      expect(midR).toBeCloseTo(0.5, 2);
    });

    it('validates all built-in cinema LUT presets', () => {
      expect(BUILTIN_LUT_PRESETS.length).toBeGreaterThanOrEqual(5);
      const presetIds = BUILTIN_LUT_PRESETS.map((p) => p.id);
      expect(presetIds).toContain('teal_orange');
      expect(presetIds).toContain('warm_sunset');
      expect(presetIds).toContain('faded_cinema');
      expect(presetIds).toContain('bw_noir');
      expect(presetIds).toContain('cyber_neon');

      for (const preset of BUILTIN_LUT_PRESETS) {
        const cubeText = preset.generateCube();
        expect(cubeText.length).toBeGreaterThan(50);
        const parsed = parseCubeLut(cubeText);
        expect(parsed.size).toBeGreaterThanOrEqual(2);
        expect(parsed.data.length).toBe(parsed.size * parsed.size * parsed.size * 3);
      }
    });

    it('generates a valid .cube string that can be parsed back', () => {
      const original = parseCubeLut(BUILTIN_LUT_PRESETS[0].generateCube());
      const generated = generateCubeStringFromLut(original);
      const reParsed = parseCubeLut(generated);
      expect(reParsed.size).toBe(original.size);
      expect(reParsed.data.length).toBe(original.data.length);
      expect(reParsed.data[0]).toBeCloseTo(original.data[0], 4);
    });
  });

  // =========================================================================
  // 2. Color Wheels & Professional Grading Filter Builder
  // =========================================================================
  describe('Color Wheels & Grading Filters', () => {
    it('creates default neutral color wheels and adjustments', () => {
      const wheels = getDefaultColorWheels();
      expect(wheels.lift).toEqual({ x: 0, y: 0, luma: 0 });
      expect(wheels.gamma).toEqual({ x: 0, y: 0, luma: 0 });
      expect(wheels.gain).toEqual({ x: 0, y: 0, luma: 0 });

      const adj = getDefaultColorAdjustments();
      expect(adj.exposure).toBe(0);
      expect(adj.contrast).toBe(0);
      expect(adj.saturation).toBe(0);
      expect(adj.bypassed).toBe(false);
      expect(adj.colorWheels).toBeDefined();
    });

    it('converts wheel puck coordinates to RGB offsets', () => {
      // Neutral center
      const [r0, g0, b0] = wheelPuckToRgb({ x: 0, y: 0, luma: 0 });
      expect(r0).toBe(0);
      expect(g0).toBe(0);
      expect(b0).toBe(0);

      // Positive X pushes Red
      const [rRed, , bRed] = wheelPuckToRgb({ x: 0.8, y: 0, luma: 0 });
      expect(rRed).toBeGreaterThan(0.2);
      expect(bRed).toBeLessThan(0);

      // Luma adds uniform luminance offset
      const [rLuma, gLuma, bLuma] = wheelPuckToRgb({ x: 0, y: 0, luma: 50 });
      expect(rLuma).toBeCloseTo(0.15, 2);
      expect(gLuma).toBeCloseTo(0.15, 2);
      expect(bLuma).toBeCloseTo(0.15, 2);
    });

    it('builds FFmpeg filter graph for color wheels, basic adjustments, and LUT', () => {
      const colors = getDefaultColorAdjustments();
      colors.exposure = 20; // +20% exposure
      colors.contrast = 15;
      colors.saturation = 10;
      colors.temperature = 25; // warm
      colors.colorWheels = {
        lift: { x: 0, y: 0.5, luma: -10 },
        gamma: { x: 0.3, y: 0, luma: 5 },
        gain: { x: -0.2, y: 0, luma: 0 },
      };
      colors.lut = {
        enabled: true,
        preset: 'teal_orange',
        intensity: 0.8,
      };

      const filters = buildColorGradingFFmpegFilters(colors, 'C:/temp/lut.cube');
      expect(filters.length).toBeGreaterThan(0);

      // EQ filter
      const eqFilter = filters.find((f) => f.startsWith('eq='));
      expect(eqFilter).toBeDefined();
      expect(eqFilter).toContain('contrast=');
      expect(eqFilter).toContain('saturation=');

      // Color balance filter (wheels + temp/tint)
      const cbFilter = filters.find((f) => f.startsWith('colorbalance='));
      expect(cbFilter).toBeDefined();
      expect(cbFilter).toContain('rs=');
      expect(cbFilter).toContain('rm=');
      expect(cbFilter).toContain('rh=');

      // LUT3D filter
      const lutFilter = filters.find((f) => f.startsWith('lut3d='));
      expect(lutFilter).toBeDefined();
      expect(lutFilter).toContain('lut.cube');
    });

    it('returns empty filter list when grading is bypassed', () => {
      const colors = getDefaultColorAdjustments();
      colors.exposure = 50;
      colors.saturation = 30;
      colors.bypassed = true;

      const filters = buildColorGradingFFmpegFilters(colors, 'C:/temp/lut.cube');
      expect(filters).toEqual([]);

      const css = buildColorGradingCssFilter(colors);
      expect(css).toBe('');
    });

    it('constructs accurate CSS preview filter string', () => {
      const colors = getDefaultColorAdjustments();
      colors.exposure = 20;
      colors.contrast = 10;
      colors.saturation = 20;
      colors.temperature = 30; // warm sepia

      const css = buildColorGradingCssFilter(colors);
      expect(css).toContain('brightness(');
      expect(css).toContain('contrast(');
      expect(css).toContain('saturate(');
      expect(css).toContain('sepia(');
    });
  });

  // =========================================================================
  // 3. Professional Audio Processing (EQ, Noise, Normalization, Ducking)
  // =========================================================================
  describe('Professional Audio Tools Engine', () => {
    it('provides standard 3-band equalizer presets', () => {
      expect(EQUALIZER_PRESETS.length).toBeGreaterThanOrEqual(6);
      const flat = EQUALIZER_PRESETS.find((p) => p.id === 'flat');
      expect(flat?.lowGainDb).toBe(0);
      expect(flat?.midGainDb).toBe(0);
      expect(flat?.highGainDb).toBe(0);

      const podcast = EQUALIZER_PRESETS.find((p) => p.id === 'podcast');
      expect(podcast?.lowGainDb).toBe(-4);
      expect(podcast?.midGainDb).toBe(5);
    });

    it('builds FFmpeg audio filters for Equalizer, Noise Reduction, Normalization, and Limiter', () => {
      const audioProc = getDefaultAudioProcessing();
      audioProc.equalizer = {
        enabled: true,
        lowGainDb: 4,
        midGainDb: -2,
        highGainDb: 5,
        preset: 'custom',
      };
      audioProc.noiseReduction = {
        enabled: true,
        amount: 60,
      };
      audioProc.normalization = {
        enabled: true,
        target: 'streaming', // -14 LUFS
      };
      audioProc.gainDb = 3.5;
      audioProc.limiter = true;

      const filters = buildClipAudioFFmpegFilters(audioProc);

      // EQ bands: 100Hz, 1000Hz, 10000Hz
      expect(filters.some((f) => f.includes('equalizer=f=100:') && f.includes('g=4.0'))).toBe(true);
      expect(filters.some((f) => f.includes('equalizer=f=1000:') && f.includes('g=-2.0'))).toBe(true);
      expect(filters.some((f) => f.includes('equalizer=f=10000:') && f.includes('g=5.0'))).toBe(true);

      // afftdn noise reduction
      expect(filters.some((f) => f.startsWith('afftdn='))).toBe(true);

      // loudnorm streaming target
      expect(filters.some((f) => f.includes('loudnorm=I=-14:TP=-1.5'))).toBe(true);

      // Additional gain
      expect(filters.some((f) => f === 'volume=3.5dB')).toBe(true);

      // Anti-clipping limiter
      expect(filters.some((f) => f.startsWith('alimiter='))).toBe(true);
    });

    it('supports broadcast EBU R128 (-23 LUFS) and peak normalization targets', () => {
      const audioProcBroadcast = getDefaultAudioProcessing();
      audioProcBroadcast.normalization = { enabled: true, target: 'broadcast' };
      const filtersBroadcast = buildClipAudioFFmpegFilters(audioProcBroadcast);
      expect(filtersBroadcast.some((f) => f.includes('loudnorm=I=-23:TP=-2.0'))).toBe(true);

      const audioProcPeak = getDefaultAudioProcessing();
      audioProcPeak.normalization = { enabled: true, target: 'peak' };
      const filtersPeak = buildClipAudioFFmpegFilters(audioProcPeak);
      expect(filtersPeak.some((f) => f.startsWith('dynaudnorm='))).toBe(true);
    });

    it('identifies dialogue intervals across tracks correctly', () => {
      const project = createDefaultProject('Audio Ducking Test');
      // Track 0: Main Video with dialogue (0s - 4s) and (7s - 10s)
      project.tracks[0].clips = [
        {
          id: 'dialogue_1',
          trackId: project.tracks[0].id,
          name: 'Host Talking',
          type: 'video',
          startMs: 1000,
          durationMs: 3000, // 1s to 4s
          sourceStartMs: 0,
          sourceEndMs: 3000,
          speed: 1.0,
          volume: 1.0,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
          keyframes: [],
        },
        {
          id: 'dialogue_2',
          trackId: project.tracks[0].id,
          name: 'Guest Talking',
          type: 'video',
          startMs: 7000,
          durationMs: 3000, // 7s to 10s
          sourceStartMs: 0,
          sourceEndMs: 3000,
          speed: 1.0,
          volume: 1.0,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
          keyframes: [],
        },
      ];

      const intervals = getDialogueIntervals(project, 'music_clip');
      expect(intervals.length).toBe(2);
      // Interval 1 spans around ~0.8s to 4.3s with padding
      expect(intervals[0][0]).toBeLessThanOrEqual(1.0);
      expect(intervals[0][1]).toBeGreaterThanOrEqual(4.0);
      // Interval 2 spans around ~6.8s to 10.3s
      expect(intervals[1][0]).toBeLessThanOrEqual(7.0);
      expect(intervals[1][1]).toBeGreaterThanOrEqual(10.0);
    });

    it('generates dynamic FFmpeg ducking filter for background music', () => {
      const project = createDefaultProject('Ducking Filter Test');
      // Dialogue on Track 0 (2s to 6s)
      project.tracks[0].clips = [
        {
          id: 'speech_clip',
          trackId: project.tracks[0].id,
          name: 'Dialogue',
          type: 'video',
          startMs: 2000,
          durationMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          speed: 1.0,
          volume: 1.0,
          fadeInMs: 0,
          fadeOutMs: 0,
          transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
          keyframes: [],
        },
      ];

      // Background music on Track 1 (0s to 10s) with ducking enabled
      const bgmClip: Clip = {
        id: 'bgm_clip',
        trackId: project.tracks[1].id,
        name: 'Background Music',
        type: 'audio',
        startMs: 0,
        durationMs: 10000,
        sourceStartMs: 0,
        sourceEndMs: 10000,
        speed: 1.0,
        volume: 0.8,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
        audioProcessing: {
          ducking: {
            enabled: true,
            duckAmountDb: -12, // ~0.251 factor
            thresholdDb: -24,
          },
          limiter: true,
        },
      };
      project.tracks[1].clips = [bgmClip];

      const duckingFilter = buildAudioDuckingFilter(bgmClip, project);
      expect(duckingFilter).not.toBeNull();
      expect(duckingFilter).toContain('volume=\'if(gt(');
      expect(duckingFilter).toContain('between(t,');
      expect(duckingFilter).toContain(':eval=frame');
    });
  });

  // =========================================================================
  // 4. Keyframe Animation for Color & Audio
  // =========================================================================
  describe('Phase 6 Keyframes for Animated Color & Audio', () => {
    it('smoothly interpolates color adjustments across keyframes', () => {
      const baseTransform = { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
      const keyframes: Keyframe[] = [
        {
          id: 'kf1',
          offsetMs: 0,
          properties: {
            exposure: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            volume: 1.0,
          },
          easing: 'linear',
        },
        {
          id: 'kf2',
          offsetMs: 2000,
          properties: {
            exposure: 40,
            brightness: 20,
            contrast: 30,
            saturation: 50,
            volume: 0.2,
          },
          easing: 'linear',
        },
      ];

      // At 1000ms (50% progress)
      const eval50 = interpolateKeyframes(baseTransform, 1.0, keyframes, 1000);
      expect(eval50.exposure).toBeCloseTo(20, 1);
      expect(eval50.brightness).toBeCloseTo(10, 1);
      expect(eval50.contrast).toBeCloseTo(15, 1);
      expect(eval50.saturation).toBeCloseTo(25, 1);
      expect(eval50.volume).toBeCloseTo(0.6, 2);

      // At 2000ms (100% progress)
      const eval100 = interpolateKeyframes(baseTransform, 1.0, keyframes, 2000);
      expect(eval100.exposure).toBeCloseTo(40, 1);
      expect(eval100.saturation).toBeCloseTo(50, 1);
      expect(eval100.volume).toBeCloseTo(0.2, 2);
    });
  });

  // =========================================================================
  // 5. Project Serialization & Backward Compatibility
  // =========================================================================
  describe('Project Serialization & .vnest Schema Compatibility', () => {
    it('serializes and deserializes color wheels, LUT settings, and audio processing', () => {
      const project = createDefaultProject('Phase 6 Serialization');
      const testClip: Clip = {
        id: 'clip_phase6',
        trackId: project.tracks[0].id,
        name: 'Graded Clip',
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
      };
      project.tracks[0].clips = [testClip];

      // Apply complete Phase 6 parameters
      testClip.colorAdjustments = {
        exposure: 15,
        brightness: 5,
        contrast: 10,
        saturation: 25,
        temperature: -10,
        tint: 5,
        highlights: -15,
        shadows: 10,
        gamma: 0,
        fade: 0,
        vignette: 15,
        sharpen: 20,
        colorWheels: {
          lift: { x: 0.1, y: -0.1, luma: -5 },
          gamma: { x: 0.0, y: 0.2, luma: 2 },
          gain: { x: -0.1, y: 0.0, luma: 0 },
        },
        lut: {
          enabled: true,
          preset: 'teal_orange',
          intensity: 0.85,
        },
        bypassed: false,
        presetName: 'Custom',
      };

      testClip.audioProcessing = {
        equalizer: {
          enabled: true,
          lowGainDb: 3,
          midGainDb: 0,
          highGainDb: -2,
          preset: 'vocal_enhance',
        },
        noiseReduction: {
          enabled: true,
          amount: 50,
        },
        normalization: {
          enabled: true,
          target: 'streaming',
        },
        ducking: {
          enabled: true,
          duckAmountDb: -14,
          thresholdDb: -20,
        },
        limiter: true,
        gainDb: 1.5,
      };

      // Serialize to JSON (.vnest)
      const json = JSON.stringify(project);
      expect(json).toContain('teal_orange');
      expect(json).toContain('colorWheels');
      expect(json).toContain('audioProcessing');

      // Deserialize
      const loaded: Project = JSON.parse(json);
      const loadedClip = loaded.tracks[0].clips[0];

      expect(loadedClip.colorAdjustments?.lut?.preset).toBe('teal_orange');
      expect(loadedClip.colorAdjustments?.colorWheels?.lift.x).toBe(0.1);
      expect(loadedClip.audioProcessing?.equalizer?.preset).toBe('vocal_enhance');
      expect(loadedClip.audioProcessing?.normalization?.target).toBe('streaming');
      expect(loadedClip.audioProcessing?.ducking?.duckAmountDb).toBe(-14);
    });

    it('gracefully handles projects without Phase 6 fields (backward compatibility)', () => {
      // Legacy project json from Phase 1-5 without colorWheels or audioProcessing
      const legacyClipJson = {
        id: 'legacy_clip',
        trackId: 'track_0',
        name: 'Legacy Clip',
        type: 'video',
        startMs: 0,
        durationMs: 3000,
        sourceStartMs: 0,
        sourceEndMs: 3000,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      };

      const clip = legacyClipJson as Clip;
      // Building filters shouldn't crash on missing Phase 6 properties
      const colorFilters = buildColorGradingFFmpegFilters(clip.colorAdjustments);
      expect(colorFilters).toEqual([]);

      const audioFilters = buildClipAudioFFmpegFilters(clip.audioProcessing);
      expect(audioFilters).toEqual([]);
    });
  });
});
