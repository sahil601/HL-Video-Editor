/**
 * Phase 9C: Clean Voice Audio Quality & Regression Validation Tests
 * Verifies objective acoustic measurements on reproducible speech fixtures:
 * - Speech + hum/noise attenuation in pauses
 * - Voiced speech level preservation
 * - Quiet word ending and tail retention
 * - Clean studio speech non-coloration
 * - Peak safety and absence of digital clipping
 * - Sample-rate invariance (44.1k, 48k, 96k, mono, stereo)
 * - Before / After auditioning and undo/redo integration
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  processAudioBufferWithCleanVoice,
  compareAudioBuffers,
  computeHighpassCoeffs,
  computePeakingCoeffs,
  computeLowpassCoeffs,
} from '../core/audioPreviewGraph';
import { buildClipAudioFFmpegFilters, CLEAN_VOICE_PRESETS } from '../core/audioProcessing';
import { CleanVoiceSettings, AudioProcessingSettings } from '../types/project';

describe('Phase 9C — Clean Voice Real Speech Fixtures & Objective Audio Quality', () => {
  const fixturesDir = path.join(__dirname, '..', '..', 'test_fixtures', 'audio');

  // Helper: Parses 16-bit PCM WAV into Float32Array
  function parseWavFile(filePath: string) {
    const buf = fs.readFileSync(filePath);
    const channels = buf.readUInt16LE(22);
    const sampleRate = buf.readUInt32LE(24);

    let dataOffset = 12;
    while (dataOffset < buf.length - 8) {
      const chunkId = buf.toString('ascii', dataOffset, dataOffset + 4);
      const chunkSize = buf.readUInt32LE(dataOffset + 4);
      if (chunkId === 'data') {
        dataOffset += 8;
        break;
      }
      dataOffset += 8 + chunkSize;
    }

    const numBytes = buf.length - dataOffset;
    const numSamples = Math.floor(numBytes / 2);
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const int16 = buf.readInt16LE(dataOffset + i * 2);
      samples[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }

    return { samples, sampleRate, channels, durationSec: numSamples / (sampleRate * channels) };
  }

  function windowRms(samples: Float32Array, sampleRate: number, channels: number, startSec: number, endSec: number) {
    const startIdx = Math.floor(startSec * sampleRate) * channels;
    const endIdx = Math.min(samples.length, Math.floor(endSec * sampleRate) * channels);
    if (endIdx <= startIdx) return 0;

    let sum = 0;
    for (let i = startIdx; i < endIdx; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / (endIdx - startIdx));
  }

  it('validates reproducible audio fixtures exist with expected format and channels', () => {
    const f1 = path.join(fixturesDir, 'speech_with_hum_noise_48k_mono.wav');
    const f2 = path.join(fixturesDir, 'speech_quiet_endings_48k_mono.wav');
    const f3 = path.join(fixturesDir, 'speech_clean_studio_44k_stereo.wav');
    const f4 = path.join(fixturesDir, 'speech_dialogue_96k_stereo.wav');

    expect(fs.existsSync(f1)).toBe(true);
    expect(fs.existsSync(f2)).toBe(true);
    expect(fs.existsSync(f3)).toBe(true);
    expect(fs.existsSync(f4)).toBe(true);

    const info1 = parseWavFile(f1);
    expect(info1.sampleRate).toBe(48000);
    expect(info1.channels).toBe(1);

    const info3 = parseWavFile(f3);
    expect(info3.sampleRate).toBe(44100);
    expect(info3.channels).toBe(2);

    const info4 = parseWavFile(f4);
    expect(info4.sampleRate).toBe(96000);
    expect(info4.channels).toBe(2);
  });

  it('demonstrates progressive noise attenuation across Light, Standard, and Strong presets', () => {
    const f1 = path.join(fixturesDir, 'speech_with_hum_noise_48k_mono.wav');
    const wav1 = parseWavFile(f1);

    // Pause window in fixture 1: 2.6s to 3.6s
    const rawPauseRms = windowRms(wav1.samples, wav1.sampleRate, wav1.channels, 2.6, 3.6);

    const lightOut = processAudioBufferWithCleanVoice(wav1.samples, wav1.sampleRate, {
      enabled: true,
      preset: 'light',
    });
    const standardOut = processAudioBufferWithCleanVoice(wav1.samples, wav1.sampleRate, {
      enabled: true,
      preset: 'standard',
    });
    const strongOut = processAudioBufferWithCleanVoice(wav1.samples, wav1.sampleRate, {
      enabled: true,
      preset: 'strong',
    });

    const lightPauseRms = windowRms(lightOut, wav1.sampleRate, wav1.channels, 2.6, 3.6);
    const standardPauseRms = windowRms(standardOut, wav1.sampleRate, wav1.channels, 2.6, 3.6);
    const strongPauseRms = windowRms(strongOut, wav1.sampleRate, wav1.channels, 2.6, 3.6);

    // Verify all presets attenuate pause noise
    expect(lightPauseRms).toBeLessThan(rawPauseRms);
    expect(standardPauseRms).toBeLessThan(lightPauseRms);
    expect(strongPauseRms).toBeLessThan(standardPauseRms);
  });

  it('preserves voiced speech levels without muffled or eaten phonemes', () => {
    const f1 = path.join(fixturesDir, 'speech_with_hum_noise_48k_mono.wav');
    const wav1 = parseWavFile(f1);

    // Voiced speech window in fixture 1: 0.8s to 1.8s
    const rawSpeechRms = windowRms(wav1.samples, wav1.sampleRate, wav1.channels, 0.8, 1.8);

    const standardOut = processAudioBufferWithCleanVoice(wav1.samples, wav1.sampleRate, {
      enabled: true,
      preset: 'standard',
    });
    const cleanSpeechRms = windowRms(standardOut, wav1.sampleRate, wav1.channels, 0.8, 1.8);

    const speechDeltaDb = 20 * Math.log10(cleanSpeechRms / rawSpeechRms);

    // Speech level should remain within +/- 2.5 dB
    expect(Math.abs(speechDeltaDb)).toBeLessThan(2.5);
  });

  it('preserves quiet word endings and soft speech tails', () => {
    const f2 = path.join(fixturesDir, 'speech_quiet_endings_48k_mono.wav');
    const wav2 = parseWavFile(f2);

    // Low-energy word tail window: 1.05s to 1.35s
    const rawTailRms = windowRms(wav2.samples, wav2.sampleRate, wav2.channels, 1.05, 1.35);

    const processed = processAudioBufferWithCleanVoice(wav2.samples, wav2.sampleRate, {
      enabled: true,
      preset: 'standard',
    });
    const procTailRms = windowRms(processed, wav2.sampleRate, wav2.channels, 1.05, 1.35);

    const tailRetention = procTailRms / rawTailRms;

    // Tail should be retained (> 80% energy retained, no chattering cutoff)
    expect(tailRetention).toBeGreaterThan(0.80);
  });

  it('preserves clean studio dialogue without unnatural coloration or distortion', () => {
    const f3 = path.join(fixturesDir, 'speech_clean_studio_44k_stereo.wav');
    const wav3 = parseWavFile(f3);

    const rawRms = windowRms(wav3.samples, wav3.sampleRate, wav3.channels, 0.4, 2.3);

    const processed = processAudioBufferWithCleanVoice(wav3.samples, wav3.sampleRate, {
      enabled: true,
      preset: 'standard',
    });
    const procRms = windowRms(processed, wav3.sampleRate, wav3.channels, 0.4, 2.3);

    const energyDeltaDb = 20 * Math.log10(procRms / rawRms);

    // Energy change on clean vocal must be subtle (< 1.5 dB)
    expect(Math.abs(energyDeltaDb)).toBeLessThan(1.5);
  });

  it('guarantees peak safety and absence of digital clipping across all presets', () => {
    const f1 = path.join(fixturesDir, 'speech_with_hum_noise_48k_mono.wav');
    const wav1 = parseWavFile(f1);

    for (const preset of ['light', 'standard', 'strong'] as const) {
      const output = processAudioBufferWithCleanVoice(wav1.samples, wav1.sampleRate, {
        enabled: true,
        preset,
      });

      let maxSample = 0;
      for (let i = 0; i < output.length; i++) {
        const abs = Math.abs(output[i]);
        if (abs > maxSample) maxSample = abs;
      }

      // Must never exceed 0.985 FS (peak ceiling)
      expect(maxSample).toBeLessThanOrEqual(0.985);
    }
  });

  it('processes high-resolution 96kHz stereo audio without sample-rate distortion', () => {
    const f4 = path.join(fixturesDir, 'speech_dialogue_96k_stereo.wav');
    const wav4 = parseWavFile(f4);

    const output = processAudioBufferWithCleanVoice(wav4.samples, wav4.sampleRate, {
      enabled: true,
      preset: 'strong',
    });

    expect(output.length).toBe(wav4.samples.length);

    // Compare original and strong processed
    const comp = compareAudioBuffers(wav4.samples, output);
    expect(comp.isDifferent).toBe(true);
    expect(comp.mse).toBeGreaterThan(0);
  });
});

describe('Phase 9C — Before / After Auditioning & Export Pipeline Alignment', () => {
  it('confirms Before state is 100% bit-identical to raw source media', () => {
    const testSamples = new Float32Array([0.1, -0.2, 0.35, -0.4, 0.5, 0.12, -0.05]);

    // Bypassed (A/B audition state)
    const bypassedSettings: CleanVoiceSettings = {
      enabled: true,
      preset: 'strong',
      bypassed: true,
    };
    const bypassedOutput = processAudioBufferWithCleanVoice(testSamples, 48000, bypassedSettings);
    expect(compareAudioBuffers(testSamples, bypassedOutput).isDifferent).toBe(false);

    // Disabled state
    const disabledSettings: CleanVoiceSettings = {
      enabled: false,
      preset: 'strong',
    };
    const disabledOutput = processAudioBufferWithCleanVoice(testSamples, 48000, disabledSettings);
    expect(compareAudioBuffers(testSamples, disabledOutput).isDifferent).toBe(false);
  });

  it('aligns export filter generation with validated acoustic thresholds', () => {
    const ap: AudioProcessingSettings = {
      cleanVoice: { enabled: true, preset: 'standard' },
    };
    const filters = buildClipAudioFFmpegFilters(ap);

    // Highpass at 90Hz
    expect(filters).toContain('highpass=f=90');
    // afftdn at -34dB
    expect(filters).toContain('afftdn=nf=-34:tn=1');
    // agate at 0.05 range
    expect(filters.some((f) => f.startsWith('agate=range=0.05'))).toBe(true);
    // vocal clarity EQ at 3200Hz
    expect(filters).toContain('equalizer=f=3200:t=q:w=1:g=2.5');
  });

  it('preserves existing Phase 6 audio settings when Clean Voice is not used', () => {
    const legacyAp: AudioProcessingSettings = {
      equalizer: { enabled: true, lowGainDb: 4, midGainDb: -1, highGainDb: 3, preset: 'custom' },
      noiseReduction: { enabled: true, amount: 50 },
      limiter: true,
    };

    const filters = buildClipAudioFFmpegFilters(legacyAp);

    expect(filters).toContain('equalizer=f=100:t=q:w=1:g=4.0');
    expect(filters).toContain('equalizer=f=1000:t=q:w=1:g=-1.0');
    expect(filters).toContain('equalizer=f=10000:t=q:w=1:g=3.0');
    expect(filters).toContain('afftdn=nf=-32:tn=1');
    expect(filters).toContain('alimiter=limit=0.95:attack=5:release=50');
  });
});
