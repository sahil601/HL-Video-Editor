/**
 * HL Video Editor — Real-Time Clean Voice & Audio Preview Pipeline (Phase 9B)
 *
 * Implements a managed Web Audio API graph for zero-latency in-timeline preview playback.
 * Supports Light, Standard, and Strong presets, dynamic speech leveling/gate,
 * rumble highpass, mud notch, vocal presence lift, and peak limiting.
 *
 * NOTE ON PREVIEW VS. EXPORT ARCHITECTURE (Requirement 5):
 * - Export Pipeline: Uses bundled FFmpeg with 2048-point spectral FFT noise subtraction (afftdn),
 *   downward expander gate (agate), parametric EQ, and ceiling peak limiter (alimiter).
 * - Real-Time Preview Pipeline: Uses Web Audio API zero-latency biquad filters and dynamic
 *   compressor/limiter nodes. While Web Audio API cannot run FFmpeg's non-causal 2048-point
 *   spectral subtraction in real time, it provides an immediate, zero-latency acoustic model
 *   (sub-bass rumble isolation, boxy mud cut, speech intelligibility boost, and dynamics leveling)
 *   that responds instantaneously to playhead scrubbing, retiming, and A/B auditioning without dropouts.
 */

import {
  AudioProcessingSettings,
  CleanVoicePreset,
  CleanVoiceSettings,
} from '../types/project';
import { CLEAN_VOICE_PRESETS } from './audioProcessing';

export interface AudioPipelineNodes {
  source: MediaElementAudioSourceNode;
  inputGain: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;

  // Clean Voice & Equalizer Filters
  highpassFilter: BiquadFilterNode;
  mudCutFilter: BiquadFilterNode;
  presenceFilter: BiquadFilterNode;
  lowpassFilter: BiquadFilterNode;

  // Manual 3-Band EQ (Phase 6)
  manualLowFilter: BiquadFilterNode;
  manualMidFilter: BiquadFilterNode;
  manualHighFilter: BiquadFilterNode;

  // Dynamics / Gate & Limiter
  dynamicsCompressor: DynamicsCompressorNode;
  peakLimiter: DynamicsCompressorNode;

  // Output
  masterGain: GainNode;
  isConnected: boolean;
}

// Global pipeline tracking map to ensure createMediaElementSource is only called ONCE per element
const activePipelines = new WeakMap<HTMLMediaElement, AudioPipelineNodes>();
let sharedAudioContext: AudioContext | null = null;

/**
 * Returns or lazily instantiates the shared AudioContext for timeline preview.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }

  return sharedAudioContext;
}

/**
 * Ensures the AudioContext is running (resumes if browser suspended autoplay).
 */
export function resumeAudioContext(): void {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Attaches or updates the real-time Web Audio preview pipeline for an HTMLMediaElement.
 */
export function attachOrUpdateAudioPipeline(
  element: HTMLMediaElement,
  audioProc?: AudioProcessingSettings,
  effectiveVolume: number = 1.0,
  isMuted: boolean = false
): AudioPipelineNodes | null {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;

  let pipeline = activePipelines.get(element);

  // If pipeline doesn't exist for this element, create and wire nodes
  if (!pipeline) {
    try {
      const source = ctx.createMediaElementSource(element);
      const inputGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();

      // Clean Voice filters
      const highpassFilter = ctx.createBiquadFilter();
      highpassFilter.type = 'highpass';

      const mudCutFilter = ctx.createBiquadFilter();
      mudCutFilter.type = 'peaking';
      mudCutFilter.Q.value = 1.0;

      const presenceFilter = ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.Q.value = 1.0;

      const lowpassFilter = ctx.createBiquadFilter();
      lowpassFilter.type = 'lowpass';

      // Manual 3-Band EQ filters
      const manualLowFilter = ctx.createBiquadFilter();
      manualLowFilter.type = 'lowshelf';
      manualLowFilter.frequency.value = 100;

      const manualMidFilter = ctx.createBiquadFilter();
      manualMidFilter.type = 'peaking';
      manualMidFilter.frequency.value = 1000;
      manualMidFilter.Q.value = 1.0;

      const manualHighFilter = ctx.createBiquadFilter();
      manualHighFilter.type = 'highshelf';
      manualHighFilter.frequency.value = 10000;

      // Dynamics / Leveler
      const dynamicsCompressor = ctx.createDynamicsCompressor();

      // Anti-clipping peak limiter
      const peakLimiter = ctx.createDynamicsCompressor();
      peakLimiter.threshold.value = -0.5;
      peakLimiter.knee.value = 0;
      peakLimiter.ratio.value = 20;
      peakLimiter.attack.value = 0.003;
      peakLimiter.release.value = 0.050;

      const masterGain = ctx.createGain();

      // --- WIRING THE GRAPH ---
      // source -> inputGain
      source.connect(inputGain);

      // Path A: Dry (Raw) Audio for Bypass / Clean Voice Disabled
      inputGain.connect(dryGain);
      dryGain.connect(masterGain);

      // Path B: Wet (Processed) Audio
      // inputGain -> wetGain -> highpass -> mudCut -> presence -> manualLow -> manualMid -> manualHigh -> lowpass -> compressor -> limiter -> masterGain
      inputGain.connect(wetGain);
      wetGain.connect(highpassFilter);
      highpassFilter.connect(mudCutFilter);
      mudCutFilter.connect(presenceFilter);
      presenceFilter.connect(manualLowFilter);
      manualLowFilter.connect(manualMidFilter);
      manualMidFilter.connect(manualHighFilter);
      manualHighFilter.connect(lowpassFilter);
      lowpassFilter.connect(dynamicsCompressor);
      dynamicsCompressor.connect(peakLimiter);
      peakLimiter.connect(masterGain);

      // Master Output to Speakers
      masterGain.connect(ctx.destination);

      pipeline = {
        source,
        inputGain,
        dryGain,
        wetGain,
        highpassFilter,
        mudCutFilter,
        presenceFilter,
        lowpassFilter,
        manualLowFilter,
        manualMidFilter,
        manualHighFilter,
        dynamicsCompressor,
        peakLimiter,
        masterGain,
        isConnected: true,
      };

      activePipelines.set(element, pipeline);
    } catch (err) {
      console.warn('Could not initialize Web Audio pipeline for element:', err);
      return null;
    }
  }

  // Synchronize pipeline parameters with current audio settings
  syncPipelineParameters(pipeline, ctx, audioProc, effectiveVolume, isMuted);
  return pipeline;
}

/**
 * Updates node parameters on an active pipeline smoothly without clicks.
 */
export function syncPipelineParameters(
  pipeline: AudioPipelineNodes,
  ctx: AudioContext,
  audioProc?: AudioProcessingSettings,
  effectiveVolume: number = 1.0,
  isMuted: boolean = false
): void {
  const now = ctx.currentTime;
  const rampTime = 0.015; // 15ms crossfade / parameter smoothing to eliminate clicks

  const cleanVoice = audioProc?.cleanVoice;
  const isCleanVoiceEnabled = !!(cleanVoice && cleanVoice.enabled);
  const isBypassed = !!cleanVoice?.bypassed;
  const isCleanVoiceActive = isCleanVoiceEnabled && !isBypassed;

  const presetKey: CleanVoicePreset = cleanVoice?.preset || 'standard';
  const presetDef = CLEAN_VOICE_PRESETS[presetKey] || CLEAN_VOICE_PRESETS.standard;

  // 1. Dry / Wet Crossfade (A/B Auditioning)
  if (isCleanVoiceActive) {
    // Wet path active
    pipeline.dryGain.gain.setValueAtTime(pipeline.dryGain.gain.value, now);
    pipeline.dryGain.gain.linearRampToValueAtTime(0, now + rampTime);

    pipeline.wetGain.gain.setValueAtTime(pipeline.wetGain.gain.value, now);
    pipeline.wetGain.gain.linearRampToValueAtTime(1, now + rampTime);
  } else {
    // Dry path active (Bypassed or Disabled)
    pipeline.dryGain.gain.setValueAtTime(pipeline.dryGain.gain.value, now);
    pipeline.dryGain.gain.linearRampToValueAtTime(1, now + rampTime);

    pipeline.wetGain.gain.setValueAtTime(pipeline.wetGain.gain.value, now);
    pipeline.wetGain.gain.linearRampToValueAtTime(0, now + rampTime);
  }

  // 2. Highpass Filter (Sub-bass rumble cut)
  const removeRumble = cleanVoice?.removeRumble !== false;
  const targetHpFreq = isCleanVoiceActive && removeRumble ? presetDef.highpassFreq : 20;
  pipeline.highpassFilter.frequency.setValueAtTime(targetHpFreq, now);

  // 3. Mud Cut Filter (Resonance / boxy room attenuation)
  const targetMudFreq = isCleanVoiceActive && presetDef.mudCutFreq ? presetDef.mudCutFreq : 350;
  const targetMudGain = isCleanVoiceActive && presetDef.mudCutGain ? presetDef.mudCutGain : 0;
  pipeline.mudCutFilter.frequency.setValueAtTime(targetMudFreq, now);
  pipeline.mudCutFilter.gain.setValueAtTime(targetMudGain, now);

  // 4. Vocal Clarity Presence Boost
  // Precedence Rule: If manual Phase 6 EQ is enabled, suppress Clean Voice presence boost
  const manualEqEnabled = !!audioProc?.equalizer?.enabled;
  const enableClarity = isCleanVoiceActive && cleanVoice?.vocalClarity !== false && !manualEqEnabled;
  const targetPresenceFreq = enableClarity ? presetDef.presenceBoostFreq : 3200;
  const targetPresenceGain = enableClarity ? presetDef.presenceBoostGain : 0;
  pipeline.presenceFilter.frequency.setValueAtTime(targetPresenceFreq, now);
  pipeline.presenceFilter.gain.setValueAtTime(targetPresenceGain, now);

  // 5. Manual 3-Band Equalizer (Phase 6)
  if (manualEqEnabled && audioProc?.equalizer) {
    pipeline.manualLowFilter.gain.setValueAtTime(audioProc.equalizer.lowGainDb || 0, now);
    pipeline.manualMidFilter.gain.setValueAtTime(audioProc.equalizer.midGainDb || 0, now);
    pipeline.manualHighFilter.gain.setValueAtTime(audioProc.equalizer.highGainDb || 0, now);
  } else {
    pipeline.manualLowFilter.gain.setValueAtTime(0, now);
    pipeline.manualMidFilter.gain.setValueAtTime(0, now);
    pipeline.manualHighFilter.gain.setValueAtTime(0, now);
  }

  // 6. Lowpass Filter (Hiss cut for Strong preset)
  const targetLpFreq = isCleanVoiceActive && presetDef.lowpassFreq ? presetDef.lowpassFreq : 20000;
  pipeline.lowpassFilter.frequency.setValueAtTime(targetLpFreq, now);

  // 7. Dynamics Compressor (Speech Leveler & Pause Attenuation)
  const noiseGateEnabled = isCleanVoiceActive && cleanVoice?.noiseGate !== false;
  if (noiseGateEnabled) {
    // Map preset gate parameters to DynamicsCompressorNode
    const compThreshold = presetKey === 'light' ? -24 : presetKey === 'standard' ? -30 : -36;
    const compRatio = presetKey === 'light' ? 2.5 : presetKey === 'standard' ? 4.0 : 8.0;
    pipeline.dynamicsCompressor.threshold.setValueAtTime(compThreshold, now);
    pipeline.dynamicsCompressor.ratio.setValueAtTime(compRatio, now);
    pipeline.dynamicsCompressor.attack.setValueAtTime(presetDef.gateAttackMs / 1000, now);
    pipeline.dynamicsCompressor.release.setValueAtTime(presetDef.gateReleaseMs / 1000, now);
  } else {
    // Transparent pass-through
    pipeline.dynamicsCompressor.threshold.setValueAtTime(0, now);
    pipeline.dynamicsCompressor.ratio.setValueAtTime(1, now);
  }

  // 8. Master Volume & Mute Control
  const targetVolume = isMuted ? 0 : Math.max(0, Math.min(2.0, effectiveVolume));
  pipeline.masterGain.gain.setValueAtTime(pipeline.masterGain.gain.value, now);
  pipeline.masterGain.gain.linearRampToValueAtTime(targetVolume, now + rampTime);
}

/**
 * Detaches and cleans up the Web Audio pipeline for an HTMLMediaElement upon unmount.
 */
export function detachAudioPipeline(element: HTMLMediaElement): void {
  const pipeline = activePipelines.get(element);
  if (!pipeline) return;

  try {
    pipeline.masterGain.disconnect();
    pipeline.dryGain.disconnect();
    pipeline.wetGain.disconnect();
    pipeline.highpassFilter.disconnect();
    pipeline.mudCutFilter.disconnect();
    pipeline.presenceFilter.disconnect();
    pipeline.manualLowFilter.disconnect();
    pipeline.manualMidFilter.disconnect();
    pipeline.manualHighFilter.disconnect();
    pipeline.lowpassFilter.disconnect();
    pipeline.dynamicsCompressor.disconnect();
    pipeline.peakLimiter.disconnect();
    pipeline.source.disconnect();
    pipeline.inputGain.disconnect();
  } catch (err) {
    // Ignore disconnect errors if already torn down
  }

  activePipelines.delete(element);
}

/**
 * Mathematical Biquad Filter Difference Equation Engine
 * Implements Robert Bristow-Johnson Audio EQ Cookbook formulas matching W3C Web Audio API specs.
 * Used for automated headless tests and deterministic verification of frequency response.
 */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function computeHighpassCoeffs(freq: number, sampleRate: number, Q: number = 0.7071): BiquadCoefficients {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);

  const b0 = (1 + cosW) / 2;
  const b1 = -(1 + cosW);
  const b2 = (1 + cosW) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW;
  const a2 = 1 - alpha;

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function computePeakingCoeffs(freq: number, gainDb: number, sampleRate: number, Q: number = 1.0): BiquadCoefficients {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const A = Math.pow(10, gainDb / 40);

  const b0 = 1 + alpha * A;
  const b1 = -2 * cosW;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cosW;
  const a2 = 1 - alpha / A;

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function computeLowpassCoeffs(freq: number, sampleRate: number, Q: number = 0.7071): BiquadCoefficients {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);

  const b0 = (1 - cosW) / 2;
  const b1 = 1 - cosW;
  const b2 = (1 - cosW) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW;
  const a2 = 1 - alpha;

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/**
 * Runs a 2nd-order Direct Form I/II biquad filter over audio sample array.
 */
export function applyBiquadFilter(input: Float32Array, coeffs: BiquadCoefficients): Float32Array {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

/**
 * Processes a Float32Array audio buffer using Clean Voice conventional DSP presets.
 * Deterministic mathematical simulation of the Web Audio preview graph.
 */
export function processAudioBufferWithCleanVoice(
  input: Float32Array,
  sampleRate: number,
  settings: CleanVoiceSettings
): Float32Array {
  if (!settings.enabled || settings.bypassed) {
    // Dry unprocessed signal
    const dry = new Float32Array(input.length);
    dry.set(input);
    return dry;
  }

  const presetDef = CLEAN_VOICE_PRESETS[settings.preset] || CLEAN_VOICE_PRESETS.standard;
  let buffer: Float32Array<any> = new Float32Array(input.length);
  buffer.set(input);

  // 1. Highpass (Rumble filter)
  if (settings.removeRumble !== false) {
    const hpCoeffs = computeHighpassCoeffs(presetDef.highpassFreq, sampleRate);
    buffer = applyBiquadFilter(buffer, hpCoeffs);
  }

  // 2. Mud cut (Resonance filter)
  if (presetDef.mudCutFreq && presetDef.mudCutGain) {
    const mudCoeffs = computePeakingCoeffs(presetDef.mudCutFreq, presetDef.mudCutGain, sampleRate);
    buffer = applyBiquadFilter(buffer, mudCoeffs);
  }

  // 3. Vocal Clarity EQ
  if (settings.vocalClarity !== false) {
    const clarityCoeffs = computePeakingCoeffs(presetDef.presenceBoostFreq, presetDef.presenceBoostGain, sampleRate);
    buffer = applyBiquadFilter(buffer, clarityCoeffs);
  }

  // 4. Lowpass (Top-end hiss filter)
  if (presetDef.lowpassFreq) {
    const lpCoeffs = computeLowpassCoeffs(presetDef.lowpassFreq, sampleRate);
    buffer = applyBiquadFilter(buffer, lpCoeffs);
  }

  // 5. Speech leveler / peak limiter clamp
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.max(-0.98, Math.min(0.98, buffer[i]));
  }

  return buffer;
}

/**
 * Computes difference metrics between two audio sample arrays.
 */
export function compareAudioBuffers(
  bufA: Float32Array,
  bufB: Float32Array
): { mse: number; maxDiff: number; isDifferent: boolean } {
  const len = Math.min(bufA.length, bufB.length);
  if (len === 0) return { mse: 0, maxDiff: 0, isDifferent: false };

  let sumSquaredDiff = 0;
  let maxDiff = 0;

  for (let i = 0; i < len; i++) {
    const diff = Math.abs(bufA[i] - bufB[i]);
    if (diff > maxDiff) maxDiff = diff;
    sumSquaredDiff += diff * diff;
  }

  const mse = sumSquaredDiff / len;
  return {
    mse,
    maxDiff,
    isDifferent: maxDiff > 1e-4,
  };
}
