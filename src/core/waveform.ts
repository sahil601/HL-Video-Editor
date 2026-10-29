/**
 * Audio Waveform Extraction & Peak Slice Calculation Engine
 * HL Video Editor
 */

/**
 * Extracts normalized peak heights (0.05 to 1.0) from raw Float32 audio samples
 */
export function extractWaveformPeaksFromFloat32(
  samples: Float32Array,
  numPeaks: number = 120
): number[] {
  if (!samples || samples.length === 0) return [];

  const targetCount = Math.max(10, numPeaks);
  const blockSize = Math.floor(samples.length / targetCount);
  if (blockSize <= 0) return [0.5];

  const peaks: number[] = new Array(targetCount);
  let maxPeak = 0.01;

  for (let i = 0; i < targetCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, samples.length);
    let sumSquares = 0;
    let peak = 0;

    for (let j = start; j < end; j++) {
      const val = Math.abs(samples[j]);
      if (val > peak) peak = val;
      sumSquares += val * val;
    }

    const count = Math.max(1, end - start);
    const rms = Math.sqrt(sumSquares / count);
    // Blend peak and RMS for a natural, rich audio waveform shape
    const blended = peak * 0.7 + rms * 0.3;
    peaks[i] = blended;
    if (blended > maxPeak) maxPeak = blended;
  }

  // Normalize all peaks between 0.06 and 1.0
  return peaks.map((p) => {
    const norm = p / maxPeak;
    return Math.max(0.06, Math.min(1.0, Math.round(norm * 1000) / 1000));
  });
}

/**
 * Extracts waveform peaks from an in-memory AudioBuffer
 */
export function extractWaveformPeaksFromAudioBuffer(
  audioBuffer: AudioBuffer,
  numPeaks: number = 150
): number[] {
  const numChannels = audioBuffer.numberOfChannels;
  if (numChannels === 0 || audioBuffer.length === 0) return [];

  const channel0 = audioBuffer.getChannelData(0);
  if (numChannels === 1) {
    return extractWaveformPeaksFromFloat32(channel0, numPeaks);
  }

  // Mix down multi-channel audio to mono Float32Array
  const monoSamples = new Float32Array(audioBuffer.length);
  for (let c = 0; c < numChannels; c++) {
    const chData = audioBuffer.getChannelData(c);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoSamples[i] += chData[i] / numChannels;
    }
  }

  return extractWaveformPeaksFromFloat32(monoSamples, numPeaks);
}

/**
 * Parses a 16-bit PCM WAV ArrayBuffer to Float32Array and extracts peaks
 * Works in both Node.js (tests) and Browser
 */
export function extractWaveformPeaksFromWavBuffer(
  buffer: ArrayBuffer,
  numPeaks: number = 150
): number[] {
  try {
    const view = new DataView(buffer);
    // Check 'RIFF' header
    if (view.getUint32(0, false) !== 0x52494646) {
      return [];
    }

    let offset = 12;
    while (offset < buffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 'data') {
        offset += 8;
        break;
      }
      offset += 8 + chunkSize;
    }

    const sampleCount = Math.floor((buffer.byteLength - offset) / 2);
    if (sampleCount <= 0) return [];

    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      float32[i] = view.getInt16(offset + i * 2, true) / 32768.0;
    }

    return extractWaveformPeaksFromFloat32(float32, numPeaks);
  } catch (err) {
    console.warn('Failed to parse WAV buffer for waveforms:', err);
    return [];
  }
}

/**
 * Extracts waveform peaks using standard Web Audio API in the browser
 */
export async function extractWaveformPeaksFromBlob(
  blob: Blob,
  numPeaks: number = 150
): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();

    // Check if it's a WAV file first (can decode synchronously and quickly)
    const wavPeaks = extractWaveformPeaksFromWavBuffer(arrayBuffer, numPeaks);
    if (wavPeaks.length > 0) return wavPeaks;

    // Use Web Audio decodeAudioData for MP3, AAC, WebM, OGG
    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      try {
        const decodePromise = ctx.decodeAudioData(arrayBuffer.slice(0));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Audio decode timeout')), 500)
        );
        const audioBuffer = await Promise.race([decodePromise, timeoutPromise]);
        return extractWaveformPeaksFromAudioBuffer(audioBuffer, numPeaks);
      } catch (err) {
        // Fallback for corrupted or synthetic audio data
        return [];
      } finally {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('Waveform extraction from blob failed:', e);
  }
  return [];
}

/**
 * Computes the exact slice of waveform bars for a clip, accounting for:
 * - Clip in-point (`sourceStartMs`)
 * - Clip duration (`durationMs`)
 * - Source asset total duration (`assetDurationMs`)
 * - Target display pixel width / bar count
 */
export function getSliceWaveformPeaks(
  assetPeaks: number[] | undefined,
  assetDurationMs: number,
  sourceStartMs: number,
  clipDurationMs: number,
  targetBarCount: number = 100
): number[] {
  if (!assetPeaks || assetPeaks.length === 0 || assetDurationMs <= 0 || clipDurationMs <= 0) {
    return [];
  }

  const bars = Math.max(8, Math.floor(targetBarCount || 100));

  const startFrac = Math.max(0, Math.min(1, sourceStartMs / assetDurationMs));
  const endFrac = Math.max(startFrac, Math.min(1, (sourceStartMs + clipDurationMs) / assetDurationMs));

  const startIndex = Math.floor(startFrac * (assetPeaks.length - 1));
  const endIndex = Math.min(assetPeaks.length - 1, Math.ceil(endFrac * (assetPeaks.length - 1)));
  const sliceLength = Math.max(1, endIndex - startIndex + 1);

  const result: number[] = new Array(bars);

  for (let i = 0; i < bars; i++) {
    const progress = i / (bars - 1 || 1);
    const sourceIdx = startIndex + progress * (sliceLength - 1);
    const low = Math.floor(sourceIdx);
    const high = Math.min(assetPeaks.length - 1, Math.ceil(sourceIdx));
    const frac = sourceIdx - low;

    const lowVal = assetPeaks[low] ?? 0;
    const highVal = assetPeaks[high] ?? 0;
    const val = lowVal * (1 - frac) + highVal * frac;
    result[i] = Math.max(0, Math.min(1.0, val));
  }

  return result;
}
