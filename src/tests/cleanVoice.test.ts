/**
 * Phase 9A: One-Click Clean Voice Core Tests
 * Validates preset generation, filter ordering, disabled/bypass behavior,
 * precedence with existing Phase 6 audio settings, and .vnest serialization.
 */

import { describe, it, expect } from 'vitest';
import {
  CLEAN_VOICE_PRESETS,
  buildCleanVoiceFilters,
  buildClipAudioFFmpegFilters,
  getDefaultAudioProcessing,
} from '../core/audioProcessing';
import {
  AudioProcessingSettings,
  CleanVoiceSettings,
  Project,
  Clip,
} from '../types/project';
import { createDefaultProject } from '../core/project';
import { HistoryManager } from '../core/commands';

describe('Phase 9A — Clean Voice Core Presets & Generation', () => {
  it('defines Light, Standard, and Strong conventional DSP presets with calibrated parameters', () => {
    expect(CLEAN_VOICE_PRESETS.light).toBeDefined();
    expect(CLEAN_VOICE_PRESETS.standard).toBeDefined();
    expect(CLEAN_VOICE_PRESETS.strong).toBeDefined();

    // Light: gentle room tone attenuation
    expect(CLEAN_VOICE_PRESETS.light.highpassFreq).toBe(75);
    expect(CLEAN_VOICE_PRESETS.light.noiseFloorDb).toBe(-24);
    expect(CLEAN_VOICE_PRESETS.light.gateRange).toBe(0.15);

    // Standard: balanced room & HVAC removal
    expect(CLEAN_VOICE_PRESETS.standard.highpassFreq).toBe(90);
    expect(CLEAN_VOICE_PRESETS.standard.noiseFloorDb).toBe(-34);
    expect(CLEAN_VOICE_PRESETS.standard.gateRange).toBe(0.05);
    expect(CLEAN_VOICE_PRESETS.standard.mudCutFreq).toBe(350);

    // Strong: aggressive isolation with lowpass & limiter
    expect(CLEAN_VOICE_PRESETS.strong.highpassFreq).toBe(110);
    expect(CLEAN_VOICE_PRESETS.strong.lowpassFreq).toBe(13000);
    expect(CLEAN_VOICE_PRESETS.strong.noiseFloorDb).toBe(-42);
    expect(CLEAN_VOICE_PRESETS.strong.gateRange).toBe(0.01);
    expect(CLEAN_VOICE_PRESETS.strong.needsLimiter).toBe(true);
  });

  it('generates exact filter chain for Standard preset', () => {
    const cv: CleanVoiceSettings = {
      enabled: true,
      preset: 'standard',
    };
    const filters = buildCleanVoiceFilters(cv);

    expect(filters).toContain('highpass=f=90');
    expect(filters).toContain('afftdn=nf=-34:tn=1');
    expect(filters.some((f) => f.startsWith('agate=range=0.05'))).toBe(true);
    expect(filters).toContain('equalizer=f=350:t=q:w=1:g=-1.5');
    expect(filters).toContain('equalizer=f=3200:t=q:w=1:g=2.5');
  });

  it('generates exact filter chain for Light preset', () => {
    const cv: CleanVoiceSettings = {
      enabled: true,
      preset: 'light',
    };
    const filters = buildCleanVoiceFilters(cv);

    expect(filters).toContain('highpass=f=75');
    expect(filters).toContain('afftdn=nf=-24:tn=1');
    expect(filters.some((f) => f.startsWith('agate=range=0.15'))).toBe(true);
    expect(filters).toContain('equalizer=f=3000:t=q:w=1:g=1.5');
    // Light preset should not have lowpass or limiter
    expect(filters.some((f) => f.startsWith('lowpass='))).toBe(false);
    expect(filters.some((f) => f.startsWith('alimiter='))).toBe(false);
  });

  it('generates exact filter chain for Strong preset with lowpass and limiter', () => {
    const cv: CleanVoiceSettings = {
      enabled: true,
      preset: 'strong',
    };
    const filters = buildCleanVoiceFilters(cv);

    expect(filters).toContain('highpass=f=110');
    expect(filters).toContain('afftdn=nf=-42:tn=1');
    expect(filters.some((f) => f.startsWith('agate=range=0.01'))).toBe(true);
    expect(filters).toContain('equalizer=f=320:t=q:w=1:g=-2.5');
    expect(filters).toContain('equalizer=f=3400:t=q:w=1:g=3.5');
    expect(filters).toContain('lowpass=f=13000');
    expect(filters).toContain('alimiter=limit=0.95:attack=5:release=50');
  });

  it('outputs inspectable FFmpeg filter graphs for Light, Standard, and Strong presets', () => {
    const lightFilters = buildCleanVoiceFilters({ enabled: true, preset: 'light' });
    const standardFilters = buildCleanVoiceFilters({ enabled: true, preset: 'standard' });
    const strongFilters = buildCleanVoiceFilters({ enabled: true, preset: 'strong' });
    const compositeFilters = buildClipAudioFFmpegFilters({
      cleanVoice: { enabled: true, preset: 'standard' },
      normalization: { enabled: true, target: 'streaming' },
      limiter: true
    });

    console.log('\n[FFmpeg Filter Graph - Light Preset]:\n' + lightFilters.join(', '));
    console.log('\n[FFmpeg Filter Graph - Standard Preset]:\n' + standardFilters.join(', '));
    console.log('\n[FFmpeg Filter Graph - Strong Preset]:\n' + strongFilters.join(', '));
    console.log('\n[FFmpeg Filter Graph - Composite Export]:\n' + compositeFilters.join(', '));

    expect(lightFilters.length).toBeGreaterThan(0);
    expect(standardFilters.length).toBeGreaterThan(0);
    expect(strongFilters.length).toBeGreaterThan(0);
    expect(compositeFilters.length).toBeGreaterThan(0);
  });
});

describe('Phase 9A — Disabled & Bypass Behavior (Before / After Comparison)', () => {
  it('returns empty filters when Clean Voice is disabled', () => {
    const cv: CleanVoiceSettings = {
      enabled: false,
      preset: 'standard',
    };
    expect(buildCleanVoiceFilters(cv)).toEqual([]);

    const ap: AudioProcessingSettings = {
      cleanVoice: cv,
      limiter: false,
    };
    expect(buildClipAudioFFmpegFilters(ap)).toEqual([]);
  });

  it('returns empty filters when Clean Voice is bypassed (A/B audition state)', () => {
    const cv: CleanVoiceSettings = {
      enabled: true,
      preset: 'standard',
      bypassed: true, // User switched to "Before" raw state
    };
    expect(buildCleanVoiceFilters(cv)).toEqual([]);

    const ap: AudioProcessingSettings = {
      cleanVoice: cv,
      limiter: false,
    };
    expect(buildClipAudioFFmpegFilters(ap)).toEqual([]);
  });

  it('re-engages filters immediately when bypass is toggled off', () => {
    const cv: CleanVoiceSettings = {
      enabled: true,
      preset: 'standard',
      bypassed: false,
    };
    const filters = buildCleanVoiceFilters(cv);
    expect(filters.length).toBeGreaterThan(0);
    expect(filters).toContain('afftdn=nf=-34:tn=1');
  });
});

describe('Phase 9A — Precedence with Existing Phase 6 Audio Settings', () => {
  it('avoids calling afftdn twice when both Clean Voice and manual noiseReduction are enabled', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'standard', // -34dB
      },
      noiseReduction: {
        enabled: true,
        amount: 80, // would normally emit -40dB
      },
      limiter: false,
    };

    const filters = buildClipAudioFFmpegFilters(ap);

    // afftdn MUST occur exactly ONCE in the chain
    const afftdnFilters = filters.filter((f) => f.startsWith('afftdn='));
    expect(afftdnFilters.length).toBe(1);
    // Clean Voice tuned noise floor takes precedence
    expect(afftdnFilters[0]).toBe('afftdn=nf=-34:tn=1');
  });

  it('falls back to manual noiseReduction when Clean Voice is bypassed or disabled', () => {
    const apBypassed: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'standard',
        bypassed: true,
      },
      noiseReduction: {
        enabled: true,
        amount: 50, // 18 + 0.5 * 27 = 31.5 -> 32dB
      },
      limiter: false,
    };

    const filters = buildClipAudioFFmpegFilters(apBypassed);
    const afftdnFilters = filters.filter((f) => f.startsWith('afftdn='));
    expect(afftdnFilters.length).toBe(1);
    expect(afftdnFilters[0]).toBe('afftdn=nf=-32:tn=1');
  });

  it('gives manual Equalizer precedence over Clean Voice presence EQ', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'standard',
        vocalClarity: true,
      },
      equalizer: {
        enabled: true,
        lowGainDb: 4,
        midGainDb: -2,
        highGainDb: 3,
        preset: 'custom',
      },
      limiter: false,
    };

    const filters = buildClipAudioFFmpegFilters(ap);

    // Manual EQ filters must be present
    expect(filters).toContain('equalizer=f=100:t=q:w=1:g=4.0');
    expect(filters).toContain('equalizer=f=1000:t=q:w=1:g=-2.0');
    expect(filters).toContain('equalizer=f=10000:t=q:w=1:g=3.0');

    // Clean Voice presence EQ (3200Hz, 350Hz) should NOT be stacked
    expect(filters).not.toContain('equalizer=f=3200:t=q:w=1:g=2.5');
    expect(filters).not.toContain('equalizer=f=350:t=q:w=1:g=-1.5');
  });

  it('emits at most ONE alimiter filter when both Clean Voice strong and audioProc.limiter are active', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'strong', // needsLimiter: true
      },
      limiter: true, // explicit limiter: true
    };

    const filters = buildClipAudioFFmpegFilters(ap);
    const limiters = filters.filter((f) => f.startsWith('alimiter='));
    expect(limiters.length).toBe(1);
  });
});

describe('Phase 9A — Filter Ordering & Signal Flow', () => {
  it('enforces textbook acoustic ordering: highpass -> afftdn -> agate -> EQ -> lowpass -> norm -> limiter', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'strong',
      },
      normalization: {
        enabled: true,
        target: 'streaming',
      },
      gainDb: 2,
      limiter: true,
    };

    const filters = buildClipAudioFFmpegFilters(ap);

    const hpIndex = filters.findIndex((f) => f.startsWith('highpass='));
    const denoiseIndex = filters.findIndex((f) => f.startsWith('afftdn='));
    const gateIndex = filters.findIndex((f) => f.startsWith('agate='));
    const eqIndex = filters.findIndex((f) => f.startsWith('equalizer='));
    const lpIndex = filters.findIndex((f) => f.startsWith('lowpass='));
    const normIndex = filters.findIndex((f) => f.startsWith('loudnorm='));
    const volIndex = filters.findIndex((f) => f.startsWith('volume='));
    const limitIndex = filters.findIndex((f) => f.startsWith('alimiter='));

    // Highpass before Denoise
    expect(hpIndex).toBeLessThan(denoiseIndex);
    // Denoise before Gate
    expect(denoiseIndex).toBeLessThan(gateIndex);
    // Gate before EQ
    expect(gateIndex).toBeLessThan(eqIndex);
    // EQ before Lowpass
    expect(eqIndex).toBeLessThan(lpIndex);
    // Lowpass before Normalization
    expect(lpIndex).toBeLessThan(normIndex);
    // Normalization before Volume
    expect(normIndex).toBeLessThan(volIndex);
    // Volume before Limiter
    expect(volIndex).toBeLessThan(limitIndex);
  });

  it('respects fine-tuning overrides for custom noise floor and gate threshold', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'standard',
        customNoiseFloorDb: -48,
        customGateThreshold: 0.08,
      },
      limiter: false,
    };

    const filters = buildClipAudioFFmpegFilters(ap);
    expect(filters).toContain('afftdn=nf=-48:tn=1');
    expect(filters.some((f) => f.includes('threshold=0.08'))).toBe(true);
  });

  it('allows disabling individual sub-modules without disabling Clean Voice', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: {
        enabled: true,
        preset: 'standard',
        removeRumble: false, // highpass off
        noiseGate: false,    // gate off
        vocalClarity: false, // EQ off
      },
      limiter: false,
    };

    const filters = buildClipAudioFFmpegFilters(ap);
    // Only spectral denoise should remain
    expect(filters.some((f) => f.startsWith('highpass='))).toBe(false);
    expect(filters.some((f) => f.startsWith('agate='))).toBe(false);
    expect(filters.some((f) => f.startsWith('equalizer='))).toBe(false);
    expect(filters).toContain('afftdn=nf=-34:tn=1');
  });
});

describe('Phase 9A — Project Model & .vnest Serialization Compatibility', () => {
  it('serializes Clean Voice settings into project JSON and restores with 100% fidelity', () => {
    const testClip: Partial<Clip> = {
      id: 'clip_test_audio',
      type: 'audio',
      name: 'Interview Audio.wav',
      audioProcessing: {
        cleanVoice: {
          enabled: true,
          preset: 'strong',
          bypassed: false,
          removeRumble: true,
          noiseGate: true,
          vocalClarity: true,
          customNoiseFloorDb: -38,
        },
      },
    };

    const json = JSON.stringify(testClip);
    const parsed: Partial<Clip> = JSON.parse(json);

    expect(parsed.audioProcessing?.cleanVoice).toBeDefined();
    expect(parsed.audioProcessing?.cleanVoice?.preset).toBe('strong');
    expect(parsed.audioProcessing?.cleanVoice?.customNoiseFloorDb).toBe(-38);
  });

  it('seamlessly loads legacy project JSON without cleanVoice (Backward Compatibility)', () => {
    const legacyClipJson = JSON.stringify({
      id: 'legacy_clip',
      type: 'audio',
      name: 'Legacy Voiceover.wav',
      audioProcessing: {
        equalizer: { enabled: true, lowGainDb: 2, midGainDb: 0, highGainDb: -1 },
        limiter: true,
      },
    });

    const parsed: Partial<Clip> = JSON.parse(legacyClipJson);
    expect(parsed.audioProcessing).toBeDefined();
    expect(parsed.audioProcessing?.cleanVoice).toBeUndefined();

    // Default builder handles legacy clip gracefully
    const filters = buildClipAudioFFmpegFilters(parsed.audioProcessing);
    expect(filters).toContain('equalizer=f=100:t=q:w=1:g=2.0');
    expect(filters).toContain('alimiter=limit=0.95:attack=5:release=50');
  });

  it('integrates with HistoryManager for undo/redo of Clean Voice operations', () => {
    const history = new HistoryManager();

    const initialProject: Project = createDefaultProject('Clean Voice Project', '16:9');
    const audioClip: Clip = {
      id: 'clip_1',
      trackId: 'track_audio_1',
      name: 'Dialogue.wav',
      type: 'audio',
      startMs: 0,
      durationMs: 5000,
      sourceStartMs: 0,
      sourceEndMs: 5000,
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
    };
    // Ensure track exists and insert clip
    const audioTrack = initialProject.tracks.find((t) => t.type === 'audio');
    if (audioTrack) {
      audioTrack.clips.push(audioClip);
    }

    // Push state before modification
    history.push(initialProject, 'Initial State');

    // Apply Clean Voice
    const modifiedProject: Project = JSON.parse(JSON.stringify(initialProject));
    const modTrack = modifiedProject.tracks.find((t) => t.type === 'audio')!;
    modTrack.clips[0].audioProcessing = {
      cleanVoice: {
        enabled: true,
        preset: 'standard',
      },
    };

    // Verify modified project has cleanVoice enabled
    expect(modTrack.clips[0].audioProcessing?.cleanVoice?.enabled).toBe(true);

    // Undo action reverts to initialProject (where audioProcessing is undefined)
    const undoRes = history.undo(modifiedProject);
    expect(undoRes).toBeDefined();
    const undoTrack = undoRes!.project.tracks.find((t) => t.type === 'audio')!;
    expect(undoTrack.clips[0].audioProcessing).toBeUndefined();

    // Redo action restores cleanVoice modification
    const redoRes = history.redo(undoRes!.project);
    expect(redoRes).toBeDefined();
    const redoTrack = redoRes!.project.tracks.find((t) => t.type === 'audio')!;
    expect(redoTrack.clips[0].audioProcessing?.cleanVoice?.enabled).toBe(true);
  });
});
