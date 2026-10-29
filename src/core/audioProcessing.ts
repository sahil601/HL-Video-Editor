/**
 * HL Video Editor — Professional Audio Processing Engine
 * Handles 3-Band Equalizer, Noise Reduction (afftdn), Loudness Normalization (loudnorm),
 * Audio Ducking under dialogue, and Anti-Clipping Soft Limiter.
 */

import {
  AudioProcessingSettings,
  AudioEqualizer,
  CleanVoicePreset,
  CleanVoiceSettings,
  Project,
  Clip,
} from '../types/project';

export interface EqualizerPreset {
  id: string;
  name: string;
  description: string;
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Flat', description: 'Neutral response (0 dB across all bands)', lowGainDb: 0, midGainDb: 0, highGainDb: 0 },
  { id: 'bass_boost', name: 'Bass Boost', description: 'Rich punchy low end (+6 dB at 100Hz)', lowGainDb: 6, midGainDb: 0, highGainDb: -1 },
  { id: 'vocal_enhance', name: 'Vocal Enhance', description: 'Clean forward vocals with reduced mud (+4 dB at 1kHz, +3 dB at 10kHz)', lowGainDb: -3, midGainDb: 4, highGainDb: 3 },
  { id: 'podcast', name: 'Podcast / Speech Clarity', description: 'Optimized spoken voice with rumble cut (-4 dB at 100Hz, +5 dB at 1kHz)', lowGainDb: -4, midGainDb: 5, highGainDb: 2 },
  { id: 'treble_boost', name: 'Treble Air', description: 'Bright open high-frequency shimmer (+6 dB at 10kHz)', lowGainDb: 0, midGainDb: 1, highGainDb: 6 },
  { id: 'reduce_rumble', name: 'Reduce Rumble', description: 'Attenuates low microphone wind and handling noise (-10 dB at 100Hz)', lowGainDb: -10, midGainDb: 0, highGainDb: 0 },
];

/**
 * Phase 9A: One-Click Clean Voice Conventional DSP Presets
 * Calibrated acoustic filter parameters combining Highpass (de-rumble),
 * Spectral Denoise (afftdn), Downward Gate (agate), and Vocal Clarity EQ.
 */
export interface CleanVoicePresetDefinition {
  id: CleanVoicePreset;
  name: string;
  description: string;
  highpassFreq: number;       // Hz, cuts mechanical/mic rumble below vocal fundamental
  noiseFloorDb: number;       // dB, maps to afftdn noise floor (e.g. -24dB to -42dB)
  gateThreshold: number;      // 0.001 to 0.2 linear threshold for downward gating
  gateRange: number;          // Attenuation range when gate is closed (0.15 = -16dB, 0.01 = -40dB)
  gateAttackMs: number;       // Gate opening speed in ms
  gateReleaseMs: number;      // Gate closing decay in ms
  presenceBoostFreq: number;  // Hz, voice intelligibility boost
  presenceBoostGain: number;  // dB, voice presence lift
  mudCutFreq?: number;        // Hz, attenuation of boxy/muddy room resonance
  mudCutGain?: number;        // dB, cut amount
  lowpassFreq?: number;       // Hz, optional top-end hiss cut
  needsLimiter?: boolean;     // Protects against peak overshoots from aggressive filtering
}

export const CLEAN_VOICE_PRESETS: Record<CleanVoicePreset, CleanVoicePresetDefinition> = {
  light: {
    id: 'light',
    name: 'Light Clean',
    description: 'Subtle room tone & laptop fan attenuation while preserving natural voice dynamics and breath.',
    highpassFreq: 75,
    noiseFloorDb: -24,
    gateThreshold: 0.015,
    gateRange: 0.15,
    gateAttackMs: 20,
    gateReleaseMs: 250,
    presenceBoostFreq: 3000,
    presenceBoostGain: 1.5,
  },
  standard: {
    id: 'standard',
    name: 'Standard Clean',
    description: 'Balanced background hiss, HVAC, and room noise removal with vocal presence boost. Recommended for most dialogue.',
    highpassFreq: 90,
    noiseFloorDb: -34,
    gateThreshold: 0.025,
    gateRange: 0.05,
    gateAttackMs: 15,
    gateReleaseMs: 200,
    presenceBoostFreq: 3200,
    presenceBoostGain: 2.5,
    mudCutFreq: 350,
    mudCutGain: -1.5,
  },
  strong: {
    id: 'strong',
    name: 'Strong Clean',
    description: 'Aggressive isolation for loud air conditioning, persistent hiss, traffic hum, and noisy environments.',
    highpassFreq: 110,
    lowpassFreq: 13000,
    noiseFloorDb: -42,
    gateThreshold: 0.040,
    gateRange: 0.01,
    gateAttackMs: 10,
    gateReleaseMs: 180,
    presenceBoostFreq: 3400,
    presenceBoostGain: 3.5,
    mudCutFreq: 320,
    mudCutGain: -2.5,
    needsLimiter: true,
  },
};

export function getDefaultAudioProcessing(): AudioProcessingSettings {
  return {
    equalizer: {
      enabled: false,
      lowGainDb: 0,
      midGainDb: 0,
      highGainDb: 0,
      preset: 'flat',
    },
    noiseReduction: {
      enabled: false,
      amount: 40,
    },
    cleanVoice: {
      enabled: false,
      preset: 'standard',
      bypassed: false,
      removeRumble: true,
      noiseGate: true,
      vocalClarity: true,
    },
    normalization: {
      enabled: false,
      target: 'streaming',
    },
    ducking: {
      enabled: false,
      duckAmountDb: -12,
      thresholdDb: -24,
    },
    limiter: true,
    gainDb: 0,
  };
}

/**
 * Builds standalone Clean Voice FFmpeg filters for a given CleanVoiceSettings configuration.
 * Respects options to suppress presence EQ or limiter if already handled by external settings.
 */
export function buildCleanVoiceFilters(
  cleanVoice: CleanVoiceSettings,
  options: { skipPresenceEq?: boolean; skipLimiter?: boolean } = {}
): string[] {
  if (!cleanVoice.enabled || cleanVoice.bypassed) {
    return [];
  }

  const def = CLEAN_VOICE_PRESETS[cleanVoice.preset] || CLEAN_VOICE_PRESETS.standard;
  const filters: string[] = [];

  // 1. Highpass sub-bass rumble filter
  if (cleanVoice.removeRumble !== false) {
    const hpFreq = Math.max(20, Math.min(300, def.highpassFreq));
    filters.push(`highpass=f=${hpFreq}`);
  }

  // 2. Spectral noise reduction (afftdn)
  const noiseFloor = cleanVoice.customNoiseFloorDb !== undefined
    ? Math.max(-60, Math.min(-10, Math.round(cleanVoice.customNoiseFloorDb)))
    : def.noiseFloorDb;
  filters.push(`afftdn=nf=${noiseFloor}:tn=1`);

  // 3. Downward noise expander / gate (agate)
  if (cleanVoice.noiseGate !== false) {
    const threshold = cleanVoice.customGateThreshold !== undefined
      ? Math.max(0.001, Math.min(0.2, cleanVoice.customGateThreshold))
      : def.gateThreshold;
    filters.push(
      `agate=range=${def.gateRange}:threshold=${threshold}:attack=${def.gateAttackMs}:release=${def.gateReleaseMs}`
    );
  }

  // 4. Vocal clarity and presence equalization
  if (cleanVoice.vocalClarity !== false && !options.skipPresenceEq) {
    if (def.mudCutFreq && def.mudCutGain) {
      filters.push(`equalizer=f=${def.mudCutFreq}:t=q:w=1:g=${def.mudCutGain.toFixed(1)}`);
    }
    filters.push(`equalizer=f=${def.presenceBoostFreq}:t=q:w=1:g=${def.presenceBoostGain.toFixed(1)}`);
  }

  // 5. High-frequency roll-off (lowpass for strong preset)
  if (def.lowpassFreq) {
    filters.push(`lowpass=f=${def.lowpassFreq}`);
  }

  // 6. Anti-clipping limiter (if needed and not skipped)
  if (def.needsLimiter && !options.skipLimiter) {
    filters.push(`alimiter=limit=0.95:attack=5:release=50`);
  }

  return filters;
}

/**
 * Builds FFmpeg audio filter string for a clip's audio processing settings.
 * Enforces strict precedence:
 * - When Clean Voice is active (!bypassed):
 *   1. Clean Voice denoise replaces manual noiseReduction (never calls afftdn twice).
 *   2. If manual equalizer is explicitly enabled, it takes precedence over Clean Voice presence EQ.
 *   3. If either cleanVoice requires a limiter or audioProc.limiter is true, only ONE alimiter filter is emitted.
 */
export function buildClipAudioFFmpegFilters(audioProc?: AudioProcessingSettings): string[] {
  if (!audioProc) return [];

  const filters: string[] = [];
  const cleanVoice = audioProc.cleanVoice;
  const isCleanVoiceActive = !!(cleanVoice && cleanVoice.enabled && !cleanVoice.bypassed);
  const cvDef = isCleanVoiceActive
    ? CLEAN_VOICE_PRESETS[cleanVoice!.preset] || CLEAN_VOICE_PRESETS.standard
    : null;

  // 1. Clean Voice Highpass (Sub-bass rumble removal)
  if (cvDef && cleanVoice!.removeRumble !== false) {
    const hpFreq = Math.max(20, Math.min(300, cvDef.highpassFreq));
    filters.push(`highpass=f=${hpFreq}`);
  }

  // 2. Denoise (afftdn)
  // Precedence: Clean Voice takes precedence when active to prevent duplicate afftdn passes.
  if (cvDef) {
    const noiseFloor = cleanVoice!.customNoiseFloorDb !== undefined
      ? Math.max(-60, Math.min(-10, Math.round(cleanVoice!.customNoiseFloorDb)))
      : cvDef.noiseFloorDb;
    filters.push(`afftdn=nf=${noiseFloor}:tn=1`);
  } else if (audioProc.noiseReduction && audioProc.noiseReduction.enabled) {
    const amt = Math.max(0, Math.min(100, audioProc.noiseReduction.amount));
    // Maps 0-100% to -18dB to -45dB noise floor
    const noiseFloor = Math.round(18 + (amt / 100) * 27);
    filters.push(`afftdn=nf=-${noiseFloor}:tn=1`);
  }

  // 3. Clean Voice Downward Gate (agate)
  if (cvDef && cleanVoice!.noiseGate !== false) {
    const threshold = cleanVoice!.customGateThreshold !== undefined
      ? Math.max(0.001, Math.min(0.2, cleanVoice!.customGateThreshold))
      : cvDef.gateThreshold;
    filters.push(
      `agate=range=${cvDef.gateRange}:threshold=${threshold}:attack=${cvDef.gateAttackMs}:release=${cvDef.gateReleaseMs}`
    );
  }

  // 4. Equalizer / Vocal Clarity
  // Precedence: Manual 3-band equalizer takes precedence if explicitly enabled.
  const hasManualEq = !!(audioProc.equalizer && audioProc.equalizer.enabled);
  if (hasManualEq) {
    const { lowGainDb = 0, midGainDb = 0, highGainDb = 0 } = audioProc.equalizer!;
    if (lowGainDb !== 0) {
      filters.push(`equalizer=f=100:t=q:w=1:g=${lowGainDb.toFixed(1)}`);
    }
    if (midGainDb !== 0) {
      filters.push(`equalizer=f=1000:t=q:w=1:g=${midGainDb.toFixed(1)}`);
    }
    if (highGainDb !== 0) {
      filters.push(`equalizer=f=10000:t=q:w=1:g=${highGainDb.toFixed(1)}`);
    }
  } else if (cvDef && cleanVoice!.vocalClarity !== false) {
    if (cvDef.mudCutFreq && cvDef.mudCutGain) {
      filters.push(`equalizer=f=${cvDef.mudCutFreq}:t=q:w=1:g=${cvDef.mudCutGain.toFixed(1)}`);
    }
    filters.push(`equalizer=f=${cvDef.presenceBoostFreq}:t=q:w=1:g=${cvDef.presenceBoostGain.toFixed(1)}`);
  }

  // 5. Clean Voice High-frequency Taming (lowpass for strong preset)
  if (cvDef && cvDef.lowpassFreq) {
    filters.push(`lowpass=f=${cvDef.lowpassFreq}`);
  }

  // 6. Audio Normalization (loudnorm / dynaudnorm)
  if (audioProc.normalization && audioProc.normalization.enabled) {
    const target = audioProc.normalization.target;
    if (target === 'streaming') {
      // YouTube / Spotify standard: -14 LUFS, True Peak -1.5 dB, LRA 11
      filters.push(`loudnorm=I=-14:TP=-1.5:LRA=11`);
    } else if (target === 'broadcast') {
      // EBU R128 standard: -23 LUFS, True Peak -2.0 dB, LRA 11
      filters.push(`loudnorm=I=-23:TP=-2.0:LRA=11`);
    } else if (target === 'peak') {
      // Dynamic peak normalizer
      filters.push(`dynaudnorm=p=0.95`);
    }
  }

  // 7. Additional Gain (dB)
  if (audioProc.gainDb && audioProc.gainDb !== 0) {
    filters.push(`volume=${audioProc.gainDb.toFixed(1)}dB`);
  }

  // 8. Anti-Clipping Soft Limiter (Single instance max)
  const needsLimiter = !!audioProc.limiter || !!(cvDef && cvDef.needsLimiter);
  if (needsLimiter) {
    filters.push(`alimiter=limit=0.95:attack=5:release=50`);
  }

  return filters;
}

/**
 * Calculates dialogue intervals across all tracks to duck background music
 * Returns array of [startSec, endSec] relative to timeline
 */
export function getDialogueIntervals(project: Project, excludeClipId?: string): [number, number][] {
  const intervals: [number, number][] = [];

  for (const track of project.tracks) {
    if (track.isMuted) continue;
    // Look for video tracks with audio, voiceover tracks, or dialogue
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      // If clip is on a video or voiceover track and has volume > 0
      if ((clip.type === 'video' || track.name.toLowerCase().includes('voice') || clip.type === 'audio') &&
          clip.volume > 0.05 &&
          !track.name.toLowerCase().includes('music') &&
          !track.name.toLowerCase().includes('bgm')) {
        const startSec = clip.startMs / 1000;
        const endSec = (clip.startMs + clip.durationMs) / 1000;
        intervals.push([startSec, endSec]);
      }
    }
  }

  // Merge overlapping dialogue intervals with 0.3s padding
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  let current = [Math.max(0, intervals[0][0] - 0.2), intervals[0][1] + 0.3];

  for (let i = 1; i < intervals.length; i++) {
    const nextStart = Math.max(0, intervals[i][0] - 0.2);
    const nextEnd = intervals[i][1] + 0.3;
    if (nextStart <= current[1]) {
      current[1] = Math.max(current[1], nextEnd);
    } else {
      merged.push([current[0], current[1]]);
      current = [nextStart, nextEnd];
    }
  }
  merged.push([current[0], current[1]]);
  return merged;
}

/**
 * Builds FFmpeg dynamic volume ducking expression for a background music clip
 */
export function buildAudioDuckingFilter(
  clip: Clip,
  project: Project
): string | null {
  const ducking = clip.audioProcessing?.ducking;
  if (!ducking || !ducking.enabled) return null;

  const dialogue = getDialogueIntervals(project, clip.id);
  if (dialogue.length === 0) return null;

  // Convert dB reduction (e.g. -12dB) to linear volume factor: 10^(dB/20)
  const duckFactor = Math.pow(10, (ducking.duckAmountDb || -12) / 20).toFixed(3);

  // Clip timeline window
  const clipStartSec = clip.startMs / 1000;
  const clipEndSec = (clip.startMs + clip.durationMs) / 1000;

  // Find intervals overlapping with this clip
  const relevant = dialogue.filter(([dStart, dEnd]) => dEnd > clipStartSec && dStart < clipEndSec);
  if (relevant.length === 0) return null;

  // In FFmpeg, source time 't' inside clip stream starts at 0
  const conditions = relevant.map(([dStart, dEnd]) => {
    const relStart = Math.max(0, dStart - clipStartSec).toFixed(3);
    const relEnd = Math.max(0, dEnd - clipStartSec).toFixed(3);
    return `between(t,${relStart},${relEnd})`;
  });

  const condExpr = conditions.join('+');
  return `volume='if(gt(${condExpr},0),${duckFactor},1.0)':eval=frame`;
}
