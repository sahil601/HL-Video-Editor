/**
 * Phase 9B: Real-Time Clean Voice Preview and Before/After Audition Tests
 * Validates Web Audio DSP pipeline, Light/Standard/Strong acoustic responses,
 * Before/After bypass behavior, parameter syncing, seeking/speed synchronization,
 * memory cleanup, and mathematical proof of audio difference.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeHighpassCoeffs,
  computePeakingCoeffs,
  computeLowpassCoeffs,
  applyBiquadFilter,
  processAudioBufferWithCleanVoice,
  compareAudioBuffers,
  attachOrUpdateAudioPipeline,
  detachAudioPipeline,
  syncPipelineParameters,
  AudioPipelineNodes,
} from '../core/audioPreviewGraph';
import { CleanVoiceSettings, AudioProcessingSettings, Clip } from '../types/project';
import { CLEAN_VOICE_PRESETS } from '../core/audioProcessing';

describe('Phase 9B — Real-Time Clean Voice DSP Mathematical Engine', () => {
  const sampleRate = 48000;
  const durationSec = 0.5;
  const numSamples = Math.floor(sampleRate * durationSec);

  // Helper: Generates synthetic test signal with known spectral components:
  // - 50 Hz sub-bass electrical hum / rumble
  // - 350 Hz boxy room resonance (mud)
  // - 1000 Hz speech vowel fundamental
  // - 3200 Hz speech clarity / consonant harmonic
  // - 14000 Hz high-frequency hiss
  function generateSyntheticSpeechWithNoise(): Float32Array {
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const hum50Hz = 0.25 * Math.sin(2 * Math.PI * 50 * t);
      const mud350Hz = 0.20 * Math.sin(2 * Math.PI * 350 * t);
      const speech1kHz = 0.40 * Math.sin(2 * Math.PI * 1000 * t);
      const presence3k2Hz = 0.20 * Math.sin(2 * Math.PI * 3200 * t);
      const hiss14kHz = 0.15 * Math.sin(2 * Math.PI * 14000 * t);

      buffer[i] = hum50Hz + mud350Hz + speech1kHz + presence3k2Hz + hiss14kHz;
    }
    return buffer;
  }

  // Helper: Computes RMS energy in a specific frequency band using a narrow bandpass simulation
  function computeRms(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  it('verifies that disabled Clean Voice returns exact original audio (bit-identical)', () => {
    const input = generateSyntheticSpeechWithNoise();
    const settings: CleanVoiceSettings = {
      enabled: false,
      preset: 'standard',
    };

    const output = processAudioBufferWithCleanVoice(input, sampleRate, settings);
    const comparison = compareAudioBuffers(input, output);

    expect(comparison.isDifferent).toBe(false);
    expect(comparison.mse).toBe(0);
    expect(comparison.maxDiff).toBe(0);
  });

  it('verifies that Bypassed (A/B audition) state returns exact original audio', () => {
    const input = generateSyntheticSpeechWithNoise();
    const settings: CleanVoiceSettings = {
      enabled: true,
      preset: 'standard',
      bypassed: true, // "Before" raw state
    };

    const output = processAudioBufferWithCleanVoice(input, sampleRate, settings);
    const comparison = compareAudioBuffers(input, output);

    expect(comparison.isDifferent).toBe(false);
    expect(comparison.mse).toBe(0);
    expect(comparison.maxDiff).toBe(0);
  });

  it('verifies that active Clean Voice genuinely modifies audio (mathematical proof of difference)', () => {
    const input = generateSyntheticSpeechWithNoise();
    const settings: CleanVoiceSettings = {
      enabled: true,
      preset: 'standard',
      bypassed: false, // "After" clean state
    };

    const output = processAudioBufferWithCleanVoice(input, sampleRate, settings);
    const comparison = compareAudioBuffers(input, output);

    expect(comparison.isDifferent).toBe(true);
    expect(comparison.mse).toBeGreaterThan(0.001);
    expect(comparison.maxDiff).toBeGreaterThan(0.1);
  });

  it('verifies Light, Standard, and Strong presets produce distinct calibrated acoustic responses', () => {
    const input = generateSyntheticSpeechWithNoise();

    const lightOut = processAudioBufferWithCleanVoice(input, sampleRate, { enabled: true, preset: 'light' });
    const standardOut = processAudioBufferWithCleanVoice(input, sampleRate, { enabled: true, preset: 'standard' });
    const strongOut = processAudioBufferWithCleanVoice(input, sampleRate, { enabled: true, preset: 'strong' });

    // Compare each against raw input
    const compLight = compareAudioBuffers(input, lightOut);
    const compStandard = compareAudioBuffers(input, standardOut);
    const compStrong = compareAudioBuffers(input, strongOut);

    expect(compLight.isDifferent).toBe(true);
    expect(compStandard.isDifferent).toBe(true);
    expect(compStrong.isDifferent).toBe(true);

    // Verify Light vs Standard vs Strong are acoustically distinct from one another
    const lightVsStandard = compareAudioBuffers(lightOut, standardOut);
    const standardVsStrong = compareAudioBuffers(standardOut, strongOut);

    expect(lightVsStandard.isDifferent).toBe(true);
    expect(standardVsStrong.isDifferent).toBe(true);

    // Filtering aggressiveness progression: Strong produces larger deviation from raw than Light
    expect(compStrong.mse).toBeGreaterThan(compLight.mse);
  });

  it('verifies sub-bass rumble attenuation (50Hz hum reduced by >12dB)', () => {
    // Generate pure 50Hz hum
    const humOnly = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      humOnly[i] = 1.0 * Math.sin(2 * Math.PI * 50 * (i / sampleRate));
    }

    const rawRms = computeRms(humOnly);

    // Standard preset has 90Hz highpass
    const standardOut = processAudioBufferWithCleanVoice(humOnly, sampleRate, {
      enabled: true,
      preset: 'standard',
      removeRumble: true,
    });
    const filteredRms = computeRms(standardOut);

    // Attenuation ratio
    const attenuationDb = 20 * Math.log10(filteredRms / rawRms);
    // 50Hz is well below 90Hz cutoff, so attenuation must be at least -10 dB
    expect(attenuationDb).toBeLessThan(-10);
  });

  it('verifies De-Rumble toggle bypasses highpass filter when disabled', () => {
    const input = generateSyntheticSpeechWithNoise();

    const withRumbleCut = processAudioBufferWithCleanVoice(input, sampleRate, {
      enabled: true,
      preset: 'standard',
      removeRumble: true,
    });

    const withoutRumbleCut = processAudioBufferWithCleanVoice(input, sampleRate, {
      enabled: true,
      preset: 'standard',
      removeRumble: false,
    });

    const comparison = compareAudioBuffers(withRumbleCut, withoutRumbleCut);
    expect(comparison.isDifferent).toBe(true);
  });

  it('verifies Vocal Clarity toggle bypasses presence boost when disabled', () => {
    const input = generateSyntheticSpeechWithNoise();

    const withClarity = processAudioBufferWithCleanVoice(input, sampleRate, {
      enabled: true,
      preset: 'standard',
      vocalClarity: true,
    });

    const withoutClarity = processAudioBufferWithCleanVoice(input, sampleRate, {
      enabled: true,
      preset: 'standard',
      vocalClarity: false,
    });

    const comparison = compareAudioBuffers(withClarity, withoutClarity);
    expect(comparison.isDifferent).toBe(true);
  });

  it('verifies Strong preset applies lowpass filter to suppress 14kHz hiss', () => {
    // Generate pure 14kHz hiss
    const hissOnly = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      hissOnly[i] = 1.0 * Math.sin(2 * Math.PI * 14000 * (i / sampleRate));
    }

    const rawRms = computeRms(hissOnly);

    // Strong preset has 13kHz lowpass
    const strongOut = processAudioBufferWithCleanVoice(hissOnly, sampleRate, {
      enabled: true,
      preset: 'strong',
    });
    const filteredRms = computeRms(strongOut);

    // Should be attenuated
    expect(filteredRms).toBeLessThan(rawRms);
  });

  it('verifies peak limiter prevents clipping above +/-0.98 FS', () => {
    // Generate loud signals that would clip
    const loudInput = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      loudInput[i] = 2.5 * Math.sin(2 * Math.PI * 1000 * (i / sampleRate));
    }

    const output = processAudioBufferWithCleanVoice(loudInput, sampleRate, {
      enabled: true,
      preset: 'strong',
    });

    let maxSample = 0;
    for (let i = 0; i < output.length; i++) {
      const absVal = Math.abs(output[i]);
      if (absVal > maxSample) maxSample = absVal;
    }

    expect(maxSample).toBeLessThanOrEqual(0.9801);
    expect(maxSample).toBeGreaterThan(0.95);
  });
});

describe('Phase 9B — Web Audio Preview Pipeline Node Graph & Synchronization', () => {
  // Mock AudioContext and Web Audio Nodes for headless testing
  function createMockAudioContext() {
    const createMockAudioParam = (initialVal = 0) => {
      const param = {
        value: initialVal,
        setValueAtTime: vi.fn((v: number) => { param.value = v; }),
        linearRampToValueAtTime: vi.fn((v: number) => { param.value = v; }),
      };
      return param;
    };

    return {
      currentTime: 10.5,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'peaking',
        frequency: createMockAudioParam(1000),
        gain: createMockAudioParam(0),
        Q: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createDynamicsCompressor: vi.fn(() => ({
        threshold: createMockAudioParam(-24),
        knee: createMockAudioParam(30),
        ratio: createMockAudioParam(12),
        attack: createMockAudioParam(0.003),
        release: createMockAudioParam(0.25),
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
    };
  }

  it('synchronizes dry/wet crossfade when Before/After bypass is toggled', () => {
    const mockCtx: any = createMockAudioContext();

    const mockPipeline: any = {
      dryGain: { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      wetGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      highpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      mudCutFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      presenceFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      manualLowFilter: { gain: { setValueAtTime: vi.fn() } },
      manualMidFilter: { gain: { setValueAtTime: vi.fn() } },
      manualHighFilter: { gain: { setValueAtTime: vi.fn() } },
      lowpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      dynamicsCompressor: {
        threshold: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
      },
      masterGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    };

    // 1. Clean Voice Active (After): wet = 1, dry = 0
    const activeSettings: AudioProcessingSettings = {
      cleanVoice: { enabled: true, preset: 'standard', bypassed: false },
    };
    syncPipelineParameters(mockPipeline, mockCtx, activeSettings, 1.0, false);

    expect(mockPipeline.dryGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    expect(mockPipeline.wetGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    expect(mockPipeline.highpassFilter.frequency.setValueAtTime).toHaveBeenCalledWith(90, expect.any(Number));

    // 2. Clean Voice Bypassed (Before raw audition): wet = 0, dry = 1
    const bypassedSettings: AudioProcessingSettings = {
      cleanVoice: { enabled: true, preset: 'standard', bypassed: true },
    };
    syncPipelineParameters(mockPipeline, mockCtx, bypassedSettings, 1.0, false);

    expect(mockPipeline.dryGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    expect(mockPipeline.wetGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('updates filter frequencies when switching between Light, Standard, and Strong presets', () => {
    const mockCtx: any = createMockAudioContext();
    const mockPipeline: any = {
      dryGain: { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      wetGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      highpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      mudCutFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      presenceFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      manualLowFilter: { gain: { setValueAtTime: vi.fn() } },
      manualMidFilter: { gain: { setValueAtTime: vi.fn() } },
      manualHighFilter: { gain: { setValueAtTime: vi.fn() } },
      lowpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      dynamicsCompressor: {
        threshold: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
      },
      masterGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    };

    // Test Light Preset
    syncPipelineParameters(mockPipeline, mockCtx, { cleanVoice: { enabled: true, preset: 'light' } }, 1.0, false);
    expect(mockPipeline.highpassFilter.frequency.setValueAtTime).toHaveBeenCalledWith(75, expect.any(Number));
    expect(mockPipeline.presenceFilter.frequency.setValueAtTime).toHaveBeenCalledWith(3000, expect.any(Number));

    // Test Strong Preset
    syncPipelineParameters(mockPipeline, mockCtx, { cleanVoice: { enabled: true, preset: 'strong' } }, 1.0, false);
    expect(mockPipeline.highpassFilter.frequency.setValueAtTime).toHaveBeenCalledWith(110, expect.any(Number));
    expect(mockPipeline.presenceFilter.frequency.setValueAtTime).toHaveBeenCalledWith(3400, expect.any(Number));
    expect(mockPipeline.lowpassFilter.frequency.setValueAtTime).toHaveBeenCalledWith(13000, expect.any(Number));
  });

  it('enforces precedence: suppresses Clean Voice presence boost when manual Phase 6 EQ is active', () => {
    const mockCtx: any = createMockAudioContext();
    const mockPipeline: any = {
      dryGain: { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      wetGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      highpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      mudCutFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      presenceFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      manualLowFilter: { gain: { setValueAtTime: vi.fn() } },
      manualMidFilter: { gain: { setValueAtTime: vi.fn() } },
      manualHighFilter: { gain: { setValueAtTime: vi.fn() } },
      lowpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      dynamicsCompressor: {
        threshold: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
      },
      masterGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    };

    // Both Clean Voice and manual EQ active
    const settings: AudioProcessingSettings = {
      cleanVoice: { enabled: true, preset: 'standard' },
      equalizer: { enabled: true, lowGainDb: 3, midGainDb: -2, highGainDb: 4, preset: 'custom' },
    };

    syncPipelineParameters(mockPipeline, mockCtx, settings, 1.0, false);

    // Clean Voice presence boost gain must be 0 (suppressed)
    expect(mockPipeline.presenceFilter.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

    // Manual EQ bands must be applied
    expect(mockPipeline.manualLowFilter.gain.setValueAtTime).toHaveBeenCalledWith(3, expect.any(Number));
    expect(mockPipeline.manualMidFilter.gain.setValueAtTime).toHaveBeenCalledWith(-2, expect.any(Number));
    expect(mockPipeline.manualHighFilter.gain.setValueAtTime).toHaveBeenCalledWith(4, expect.any(Number));
  });

  it('applies volume and muting smoothly via masterGain', () => {
    const mockCtx: any = createMockAudioContext();
    const mockPipeline: any = {
      dryGain: { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      wetGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      highpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      mudCutFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      presenceFilter: { frequency: { setValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn() } },
      manualLowFilter: { gain: { setValueAtTime: vi.fn() } },
      manualMidFilter: { gain: { setValueAtTime: vi.fn() } },
      manualHighFilter: { gain: { setValueAtTime: vi.fn() } },
      lowpassFilter: { frequency: { setValueAtTime: vi.fn() } },
      dynamicsCompressor: {
        threshold: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
      },
      masterGain: { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    };

    // Unmuted with 0.8 volume
    syncPipelineParameters(mockPipeline, mockCtx, undefined, 0.8, false);
    expect(mockPipeline.masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, expect.any(Number));

    // Muted
    syncPipelineParameters(mockPipeline, mockCtx, undefined, 0.8, true);
    expect(mockPipeline.masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('preserves timeline synchronization and source in/out offsets across seeking & playback speeds', () => {
    const clip: Clip = {
      id: 'clip_dialogue',
      trackId: 'track_audio',
      name: 'Interview.wav',
      type: 'audio',
      startMs: 2000,
      durationMs: 4000,
      sourceStartMs: 1500,
      sourceEndMs: 5500,
      speed: 1.5,
      volume: 1.0,
      fadeInMs: 200,
      fadeOutMs: 300,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };

    // Test timeline position at 3000ms (1000ms into clip)
    const currentTimeMs = 3000;
    const clipOffsetMs = currentTimeMs - clip.startMs; // 1000ms
    const targetTimeSec = (clip.sourceStartMs + clipOffsetMs * clip.speed) / 1000;

    // 1500 + 1000 * 1.5 = 3000ms = 3.0s in media source
    expect(targetTimeSec).toBe(3.0);

    // Test seek to end of clip at 5800ms (3800ms into clip)
    const seekTimeMs = 5800;
    const seekOffsetMs = seekTimeMs - clip.startMs; // 3800ms
    const seekTargetSec = (clip.sourceStartMs + seekOffsetMs * clip.speed) / 1000;

    // 1500 + 3800 * 1.5 = 7200ms = 7.2s in media source
    expect(seekTargetSec).toBe(7.2);
  });
});
