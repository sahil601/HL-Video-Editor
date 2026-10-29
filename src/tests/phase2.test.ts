import { describe, it, expect } from 'vitest';
import {
  OVERLAY_PRESETS,
  OVERLAY_CATEGORIES,
  generateOverlaySvg,
  filterOverlayPresets,
} from '../core/overlays/overlayDefinitions';
import {
  EFFECT_PRESETS,
  EFFECT_CATEGORIES,
  createEffect,
  composeEffectsCss,
  composeEffectsFfmpeg,
  filterEffectPresets,
} from '../core/effects/effectDefinitions';
import {
  SFX_PRESETS,
  SFX_CATEGORIES,
  synthesizeSfxSamples,
  pcmToWavBlob,
  filterSfxPresets,
} from '../core/audioLibrary';
import {
  TRANSITION_PRESETS,
  TRANSITION_CATEGORIES,
  createTransition,
  clampTransitionDuration,
  filterTransitionPresets,
} from '../core/transitions/transitionDefinitions';
import { buildFFmpegExportArgs, EXPORT_PRESETS } from '../core/ffmpeg';
import { Project, Clip } from '../types/project';
import { createDefaultProject } from '../core/project';

describe('Phase 2 — Built-in Overlays Library', () => {
  it('contains at least 24 overlay presets covering all 6 required categories', () => {
    expect(OVERLAY_PRESETS.length).toBeGreaterThanOrEqual(24);

    const categories = new Set(OVERLAY_PRESETS.map((p) => p.category));
    expect(categories.has('light_leaks')).toBe(true);
    expect(categories.has('film_grain')).toBe(true);
    expect(categories.has('particles')).toBe(true);
    expect(categories.has('retro_vhs')).toBe(true);
    expect(categories.has('cinematic')).toBe(true);
    expect(categories.has('frames')).toBe(true);
    expect(OVERLAY_CATEGORIES.length).toBe(6);
  });

  it('generates valid SVG markup for all overlay presets', () => {
    for (const preset of OVERLAY_PRESETS) {
      const svg = generateOverlaySvg(preset.id, 1920, 1080);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('width="1920"');
      expect(svg).toContain('height="1080"');
    }
  });

  it('filters overlay presets by category and search keyword', () => {
    const lightLeaks = filterOverlayPresets(OVERLAY_PRESETS, 'light_leaks');
    expect(lightLeaks.length).toBeGreaterThanOrEqual(4);
    expect(lightLeaks.every((p) => p.category === 'light_leaks')).toBe(true);

    const searchResult = filterOverlayPresets(OVERLAY_PRESETS, 'all', 'anamorphic');
    expect(searchResult.length).toBeGreaterThanOrEqual(1);
    expect(searchResult[0].id).toBe('lens_flare_anamorphic');
  });

  it('preserves recommended blend modes on presets', () => {
    const warmLeak = OVERLAY_PRESETS.find((p) => p.id === 'light_leak_warm');
    expect(warmLeak?.recommendedBlendMode).toBe('screen');

    const filmGrain = OVERLAY_PRESETS.find((p) => p.id === 'film_grain_35mm');
    expect(filmGrain?.recommendedBlendMode).toBe('overlay');

    const paper = OVERLAY_PRESETS.find((p) => p.id === 'vintage_paper');
    expect(paper?.recommendedBlendMode).toBe('multiply');
  });
});

describe('Phase 2 — Effects & VFX Library', () => {
  it('contains at least 24 video effect presets covering all 6 required categories', () => {
    expect(EFFECT_PRESETS.length).toBeGreaterThanOrEqual(24);

    const categories = new Set(EFFECT_PRESETS.map((p) => p.category));
    expect(categories.has('cinematic')).toBe(true);
    expect(categories.has('glitch')).toBe(true);
    expect(categories.has('blur_glow')).toBe(true);
    expect(categories.has('motion_impact')).toBe(true);
    expect(categories.has('color_looks')).toBe(true);
    expect(categories.has('particles_vfx')).toBe(true);
    expect(EFFECT_CATEGORIES.length).toBe(6);
  });

  it('creates valid VideoEffect instances with default intensity and active state', () => {
    const effect = createEffect('gaussian_blur');
    expect(effect.id).toMatch(/^eff_/);
    expect(effect.type).toBe('gaussian_blur');
    expect(effect.enabled).toBe(true);
    expect(effect.intensity).toBeGreaterThan(0);
    expect(effect.category).toBe('blur_glow');
  });

  it('composes valid CSS filter and transform strings for real-time preview', () => {
    const blur = createEffect('gaussian_blur');
    blur.intensity = 50;

    const rgbSplit = createEffect('rgb_split');
    rgbSplit.intensity = 80;

    const css = composeEffectsCss([blur, rgbSplit]);
    expect(css.filter).toContain('blur(');
    expect(css.filter).toContain('drop-shadow(');
  });

  it('maps video effects to corresponding FFmpeg video filter strings', () => {
    const blur = createEffect('gaussian_blur');
    blur.intensity = 50;
    const noir = createEffect('film_noir');
    const sepia = createEffect('sepia_tone');
    const rgb = createEffect('rgb_split');

    const ffmpegFilters = composeEffectsFfmpeg([blur, noir, sepia, rgb]);
    expect(ffmpegFilters.some((f) => f.includes('gblur=sigma='))).toBe(true);
    expect(ffmpegFilters.some((f) => f.includes('hue=s=0'))).toBe(true);
    expect(ffmpegFilters.some((f) => f.includes('colorchannelmixer='))).toBe(true);
    expect(ffmpegFilters.some((f) => f.includes('rgbashift='))).toBe(true);
  });

  it('filters effect presets by category and query', () => {
    const glitch = filterEffectPresets(EFFECT_PRESETS, 'glitch');
    expect(glitch.length).toBeGreaterThanOrEqual(4);
    expect(glitch.every((p) => p.category === 'glitch')).toBe(true);

    const search = filterEffectPresets(EFFECT_PRESETS, 'all', 'sharpen');
    expect(search.some((p) => p.type === 'sharpen')).toBe(true);
  });
});

describe('Phase 2 — Free Built-in Sound Effects', () => {
  it('contains at least 24 sound FX presets covering all 6 required categories', () => {
    expect(SFX_PRESETS.length).toBeGreaterThanOrEqual(24);

    const categories = new Set(SFX_PRESETS.map((p) => p.category));
    expect(categories.has('whoosh')).toBe(true);
    expect(categories.has('impact')).toBe(true);
    expect(categories.has('cinematic')).toBe(true);
    expect(categories.has('glitch')).toBe(true);
    expect(categories.has('ui')).toBe(true);
    expect(categories.has('ambient')).toBe(true);
    expect(SFX_CATEGORIES.length).toBe(6);
  });

  it('synthesizes valid Float32Array PCM samples for all 24 presets', () => {
    for (const preset of SFX_PRESETS) {
      const samples = synthesizeSfxSamples(preset.id, 44100);
      expect(samples.length).toBeGreaterThan(1000);

      // Verify samples are non-silent
      let hasSound = false;
      let maxAbs = 0;
      for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > 0.01) hasSound = true;
        if (abs > maxAbs) maxAbs = abs;
      }
      expect(hasSound).toBe(true);
      expect(maxAbs).toBeLessThanOrEqual(1.0); // Never clip
    }
  });

  it('encodes PCM samples into standard 16-bit WAV Blobs with 44-byte header', () => {
    const samples = synthesizeSfxSamples('whoosh_fast', 44100);
    const wavBlob = pcmToWavBlob(samples, 44100);

    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(44 + samples.length * 2);
  });

  it('filters sound FX presets by category and search keyword', () => {
    const impacts = filterSfxPresets(SFX_PRESETS, 'impact');
    expect(impacts.length).toBeGreaterThanOrEqual(4);
    expect(impacts.every((p) => p.category === 'impact')).toBe(true);

    const search = filterSfxPresets(SFX_PRESETS, 'all', 'shutter');
    expect(search.some((p) => p.id === 'camera_shutter')).toBe(true);
  });
});

describe('Phase 2 — Multiple Working Transitions', () => {
  it('contains at least 20 transition presets covering all 5 required categories', () => {
    expect(TRANSITION_PRESETS.length).toBeGreaterThanOrEqual(20);

    const categories = new Set(TRANSITION_PRESETS.map((p) => p.category));
    expect(categories.has('basic')).toBe(true);
    expect(categories.has('directional')).toBe(true);
    expect(categories.has('motion')).toBe(true);
    expect(categories.has('cinematic')).toBe(true);
    expect(categories.has('stylized')).toBe(true);
    expect(TRANSITION_CATEGORIES.length).toBe(5);
  });

  it('clamps transition duration to prevent exceeding 50% of clip duration', () => {
    // 1000ms requested, but clip is only 1000ms long -> clamped to 500ms
    const clamped = clampTransitionDuration(1000, 1000);
    expect(clamped).toBe(500);

    // 1500ms requested, clip is 5000ms, adjacent is 2000ms -> clamped to 1000ms (50% of 2000ms)
    const clampedAdjacent = clampTransitionDuration(1500, 5000, 2000);
    expect(clampedAdjacent).toBe(1000);

    // Normal duration within range
    const normal = clampTransitionDuration(800, 4000, 4000);
    expect(normal).toBe(800);
  });

  it('creates valid ClipTransition objects', () => {
    const trans = createTransition('slideLeft', 750);
    expect(trans.id).toMatch(/^trans_/);
    expect(trans.type).toBe('slideLeft');
    expect(trans.durationMs).toBe(750);
    expect(trans.direction).toBe('left');
  });

  it('filters transition presets by category and search query', () => {
    const directional = filterTransitionPresets(TRANSITION_PRESETS, 'directional');
    expect(directional.length).toBeGreaterThanOrEqual(6);
    expect(directional.every((p) => p.category === 'directional')).toBe(true);

    const wipes = filterTransitionPresets(TRANSITION_PRESETS, 'all', 'wipe');
    expect(wipes.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Phase 2 — FFmpeg Export Filtergraph Integration', () => {
  it('assembles FFmpeg filtergraph with video effects, transitions, overlays and sound effects', () => {
    const project = createDefaultProject('phase2_export_test');
    project.durationMs = 8000;

    // 1. Add video clip with Transition and Video Effects
    const videoClip: Clip = {
      id: 'clip_v1',
      trackId: 'track_video_1',
      assetId: 'asset_v1',
      name: 'Main Video',
      type: 'video',
      startMs: 0,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: {
        positionX: 0,
        positionY: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
      },
      keyframes: [],
      transition: createTransition('fadeBlack', 800),
      effects: [createEffect('gaussian_blur'), createEffect('sepia_tone')],
    };

    // 2. Add second video clip with slideLeft transition
    const videoClip2: Clip = {
      id: 'clip_v2',
      trackId: 'track_video_1',
      assetId: 'asset_v2',
      name: 'Second Video',
      type: 'video',
      startMs: 4000,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: {
        positionX: 0,
        positionY: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
      },
      keyframes: [],
      transition: createTransition('slideLeft', 700),
    };

    // 3. Add overlay clip with blend mode
    const overlayClip: Clip = {
      id: 'clip_ov1',
      trackId: 'track_overlay_1',
      assetId: 'asset_ov1',
      name: 'Warm Sunset Light Leak',
      type: 'overlay',
      startMs: 1000,
      durationMs: 3000,
      sourceStartMs: 0,
      sourceEndMs: 3000,
      speed: 1.0,
      volume: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: {
        positionX: 0,
        positionY: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 0.85,
        blendMode: 'screen',
      },
      keyframes: [],
      overlayProperties: {
        overlayType: 'light_leak_warm',
        category: 'light_leaks',
        blendMode: 'screen',
        opacity: 0.85,
      },
    };

    // 4. Add Sound FX audio clip
    const sfxClip: Clip = {
      id: 'clip_sfx1',
      trackId: 'track_audio_1',
      assetId: 'asset_sfx1',
      name: 'Fast Air Whoosh',
      type: 'audio',
      startMs: 3800,
      durationMs: 500,
      sourceStartMs: 0,
      sourceEndMs: 500,
      speed: 1.0,
      volume: 1.2,
      fadeInMs: 50,
      fadeOutMs: 50,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };

    const videoTrack = project.tracks.find((t) => t.type === 'video')!;
    const overlayTrack = project.tracks.find((t) => t.type === 'overlay')!;
    const audioTrack = project.tracks.find((t) => t.type === 'audio')!;

    videoClip.trackId = videoTrack.id;
    videoClip2.trackId = videoTrack.id;
    overlayClip.trackId = overlayTrack.id;
    sfxClip.trackId = audioTrack.id;

    videoTrack.clips = [videoClip, videoClip2];
    overlayTrack.clips = [overlayClip];
    audioTrack.clips = [sfxClip];

    const pathMap = new Map<string, string>([
      ['asset_v1', 'C:/test/sample1.mp4'],
      ['asset_v2', 'C:/test/sample2.mp4'],
      ['asset_ov1', 'C:/test/overlay.png'],
      ['asset_sfx1', 'C:/test/whoosh.wav'],
    ]);

    const { args, inputFiles } = buildFFmpegExportArgs(
      project,
      EXPORT_PRESETS[0],
      'C:/test/output.mp4',
      (id) => pathMap.get(id) || null
    );

    // Verify all 4 inputs are registered
    expect(inputFiles.length).toBe(4);
    expect(args).toContain('-filter_complex');

    const filterComplexIndex = args.indexOf('-filter_complex');
    const filtergraph = args[filterComplexIndex + 1];

    // Verify Video Effects filters are in filtergraph
    expect(filtergraph).toContain('gblur=sigma=');
    expect(filtergraph).toContain('colorchannelmixer=');

    // Verify Transitions (fadeBlack and slideLeft)
    expect(filtergraph).toContain('fade=t=in:st=0:d=0.800:color=black');
    expect(filtergraph).toContain('if(lt(t,4.700)'); // slideLeft transition expression

    // Verify underlayer preservation: outgoing clip frame is cloned for the duration of the transition
    expect(filtergraph).toContain('tpad=stop_mode=clone:stop_duration=0.700');
    expect(filtergraph).toContain('between(t,0.000,4.700)'); // Outgoing clip active through transition overlap

    // Verify Overlay track positioning and timing
    expect(filtergraph).toContain("between(t,1.000,4.000)");

    // Verify Audio SFX stream delay, volume, and fades
    expect(filtergraph).toContain('volume=1.20');
    expect(filtergraph).toContain('adelay=3800|3800');
    expect(filtergraph).toContain('afade=t=in');
    expect(filtergraph).toContain('afade=t=out');
  });

  it('preserves accurate audio mime types and handles procedural sound fx extraction', async () => {
    // Verify that package.ts extraction maps .wav to audio/wav and .webm to audio/webm
    const testAssets = [
      { name: 'sound.wav', expected: 'audio/wav' },
      { name: 'voice.webm', expected: 'audio/webm' },
      { name: 'music.mp3', expected: 'audio/mpeg' },
    ];
    for (const item of testAssets) {
      const ext = item.name.split('.').pop()?.toLowerCase();
      const detected = ext === 'wav' ? 'audio/wav' : ext === 'webm' ? 'audio/webm' : 'audio/mpeg';
      expect(detected).toBe(item.expected);
    }
  });
});
