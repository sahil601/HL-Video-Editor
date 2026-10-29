import { describe, it, expect } from 'vitest';
import {
  extractWaveformPeaksFromFloat32,
  extractWaveformPeaksFromWavBuffer,
  getSliceWaveformPeaks,
} from '../core/waveform';
import {
  ELEMENT_PRESETS,
  generateElementSvg,
  getElementSvgDataUrl,
} from '../core/elements/elementDefinitions';
import {
  PIP_PRESET_DEFINITIONS,
  applyPipPreset,
  assignQuadrantLayout,
} from '../core/pipPresets';
import { Clip, ProjectAsset, Project } from '../types/project';
import { createDefaultProject, splitClipAtTime, splitClipWithFeedback, validateProjectManifest } from '../core/project';
import { buildFFmpegExportArgs, EXPORT_PRESETS } from '../core/ffmpeg';

describe('Phase 1 Feature 1: Audio Waveforms', () => {
  it('extracts normalized waveform peaks from Float32 PCM samples', () => {
    // Generate synthetic audio sine wave
    const sampleRate = 44100;
    const durationSec = 1.0;
    const totalSamples = sampleRate * durationSec;
    const channelData = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
    }

    const peaks = extractWaveformPeaksFromFloat32(channelData, 100);
    expect(peaks).toHaveLength(100);
    expect(peaks.every((p) => p >= 0 && p <= 1.0)).toBe(true);
    // Normalized peaks should reach 1.0 for the highest peak
    const maxPeak = Math.max(...peaks);
    expect(maxPeak).toBeCloseTo(1.0, 2);
  });

  it('extracts peaks directly from 16-bit PCM WAV buffer', () => {
    // Construct small valid 16-bit mono WAV buffer (1000 samples)
    const numSamples = 1000;
    const sampleRate = 16000;
    const byteRate = sampleRate * 2;
    const blockAlign = 2;
    const bitsPerSample = 16;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // "fmt " subchunk
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // "data" subchunk
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, dataSize, true);

    // Fill sample values
    for (let i = 0; i < numSamples; i++) {
      const val = Math.round(Math.sin((i / 50) * Math.PI) * 20000);
      view.setInt16(44 + i * 2, val, true);
    }

    const peaks = extractWaveformPeaksFromWavBuffer(buffer, 50);
    expect(peaks).toHaveLength(50);
    expect(peaks.every((p) => p >= 0 && p <= 1.0)).toBe(true);
    expect(Math.max(...peaks)).toBeGreaterThan(0.5);
  });

  it('slices waveform peaks accurately accounting for in-point, duration, and zoom', () => {
    // 100 peaks representing 10 seconds (10,000ms), 1 peak per 100ms
    const fullPeaks = Array.from({ length: 100 }, (_, i) => i / 100);
    const assetDurationMs = 10000;

    // A: Full duration slice
    const fullSlice = getSliceWaveformPeaks(fullPeaks, assetDurationMs, 0, 10000, 50);
    expect(fullSlice).toHaveLength(50);
    expect(fullSlice[0]).toBeCloseTo(0, 1);
    expect(fullSlice[fullSlice.length - 1]).toBeCloseTo(0.98, 1);

    // B: Second half slice (in-point = 5000ms, duration = 5000ms)
    const secondHalfSlice = getSliceWaveformPeaks(fullPeaks, assetDurationMs, 5000, 5000, 50);
    expect(secondHalfSlice).toHaveLength(50);
    expect(secondHalfSlice[0]).toBeGreaterThanOrEqual(0.48);
    expect(secondHalfSlice[secondHalfSlice.length - 1]).toBeCloseTo(0.98, 1);

    // C: Zoom adjustment (higher target peak count)
    const zoomedSlice = getSliceWaveformPeaks(fullPeaks, assetDurationMs, 2000, 4000, 120);
    expect(zoomedSlice).toHaveLength(120);
    expect(zoomedSlice[0]).toBeGreaterThanOrEqual(0.18);
  });

  it('handles missing or corrupt peak data gracefully without throwing', () => {
    expect(getSliceWaveformPeaks(undefined, 5000, 0, 5000)).toEqual([]);
    expect(getSliceWaveformPeaks([], 5000, 0, 5000)).toEqual([]);
    expect(getSliceWaveformPeaks([0.5], 0, 0, 0)).toEqual([]);
  });
});

describe('Phase 1 Feature 2: Voice-Over Recording Integration', () => {
  it('creates and attaches valid voiceover asset and clip to audio track', () => {
    const project = createDefaultProject('VoiceOver Test');
    const audioTrack = project.tracks.find((t) => t.type === 'audio')!;
    expect(audioTrack).toBeDefined();

    const voAsset: ProjectAsset = {
      id: 'asset_vo_123',
      name: 'Voiceover_Take1.webm',
      type: 'audio',
      relativePath: 'assets/asset_vo_123_Voiceover_Take1.webm',
      originalPath: 'assets/asset_vo_123_Voiceover_Take1.webm',
      fileSize: 45000,
      durationMs: 4000,
      waveformPeaks: [0.1, 0.4, 0.8, 0.6, 0.2],
      isBundled: true,
    };

    const voClip: Clip = {
      id: 'clip_vo_456',
      trackId: audioTrack.id,
      assetId: voAsset.id,
      name: 'Voiceover Take 1',
      type: 'audio',
      startMs: 1500,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 50,
      fadeOutMs: 50,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };

    project.assets.push(voAsset);
    audioTrack.clips.push(voClip);

    // Validate manifest schema
    const validation = validateProjectManifest(project);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Verify waveform slice can be extracted for this clip
    const slice = getSliceWaveformPeaks(voAsset.waveformPeaks, voAsset.durationMs, voClip.sourceStartMs, voClip.durationMs, 10);
    expect(slice).toHaveLength(10);
  });
});

describe('Phase 1 Feature 3: Elements & Graphics Library', () => {
  it('defines all requested element types across 4 categories', () => {
    const elementIds = ELEMENT_PRESETS.map((p) => p.id);
    expect(elementIds).toContain('rectangle');
    expect(elementIds).toContain('circle');
    expect(elementIds).toContain('star');
    expect(elementIds).toContain('triangle');
    expect(elementIds).toContain('arrow_right');
    expect(elementIds).toContain('arrow_curved');
    expect(elementIds).toContain('frame_cinema');
    expect(elementIds).toContain('frame_border');
    expect(elementIds).toContain('bubble_speech');
    expect(elementIds).toContain('bubble_thought');

    expect(ELEMENT_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it('generates scalable SVG markup for shapes with custom colors and properties', () => {
    const starPreset = ELEMENT_PRESETS.find((p) => p.id === 'star')!;
    const svg = generateElementSvg({
      ...starPreset.defaultProperties,
      color: '#ffd700',
      secondaryColor: '#b8860b',
      strokeWidth: 4,
      opacity: 0.9,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 400 300"');
    expect(svg).toContain('fill="#ffd700"');
    expect(svg).toContain('stroke="#b8860b"');
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('opacity="0.9"');
  });

  it('renders speech bubbles with escaped text and pointers', () => {
    const speechPreset = ELEMENT_PRESETS.find((p) => p.id === 'bubble_speech')!;
    const svg = generateElementSvg({
      ...speechPreset.defaultProperties,
      text: 'Hello & Welcome <HL>!',
    });

    expect(svg).toContain('Hello &amp; Welcome &lt;HL&gt;!');
    expect(svg).toContain('dominant-baseline="middle"');
  });

  it('returns valid data URL for direct canvas / image consumption', () => {
    const rectPreset = ELEMENT_PRESETS.find((p) => p.id === 'rectangle')!;
    const dataUrl = getElementSvgDataUrl(rectPreset.defaultProperties);
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  });
});

describe('Phase 1 Feature 4: PIP & Split-Screen Presets', () => {
  const baseClip: Clip = {
    id: 'test_clip_1',
    trackId: 'track_v1',
    name: 'Camera 1',
    type: 'video',
    startMs: 0,
    durationMs: 5000,
    sourceStartMs: 0,
    sourceEndMs: 5000,
    speed: 1.0,
    volume: 0.8,
    fadeInMs: 100,
    fadeOutMs: 100,
    transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
    keyframes: [],
  };

  it('applies top-right PIP layout correctly while preserving timing and audio', () => {
    const pipClip = applyPipPreset(baseClip, 'pip_top_right');
    expect(pipClip.transform.scale).toBe(0.35);
    expect(pipClip.transform.positionX).toBe(28);
    expect(pipClip.transform.positionY).toBe(-28);

    // Audio volume and duration must be strictly preserved
    expect(pipClip.volume).toBe(0.8);
    expect(pipClip.durationMs).toBe(5000);
    expect(pipClip.startMs).toBe(0);
  });

  it('applies 50/50 vertical and horizontal split screen layouts with crops', () => {
    const leftSplit = applyPipPreset(baseClip, 'split_left_50');
    expect(leftSplit.transform.positionX).toBe(-25);
    expect(leftSplit.transform.crop?.right).toBe(50);

    const rightSplit = applyPipPreset(baseClip, 'split_right_50');
    expect(rightSplit.transform.positionX).toBe(25);
    expect(rightSplit.transform.crop?.left).toBe(50);

    const topSplit = applyPipPreset(baseClip, 'split_top_50');
    expect(topSplit.transform.positionY).toBe(-25);
    expect(topSplit.transform.crop?.bottom).toBe(50);

    const bottomSplit = applyPipPreset(baseClip, 'split_bottom_50');
    expect(bottomSplit.transform.positionY).toBe(25);
    expect(bottomSplit.transform.crop?.top).toBe(50);
  });

  it('assigns 4 distinct quadrants for 4-way multi-track split screen', () => {
    const clips = [
      { ...baseClip, id: 'c1' },
      { ...baseClip, id: 'c2' },
      { ...baseClip, id: 'c3' },
      { ...baseClip, id: 'c4' },
    ];

    const arranged = assignQuadrantLayout(clips);
    expect(arranged).toHaveLength(4);
    // All 4 clips should have 0.5 scale
    expect(arranged.every((c) => c.transform.scale === 0.5)).toBe(true);

    // Check positions: TL, TR, BL, BR
    expect(arranged[0].transform.positionX).toBe(-25);
    expect(arranged[0].transform.positionY).toBe(-25);

    expect(arranged[1].transform.positionX).toBe(25);
    expect(arranged[1].transform.positionY).toBe(-25);

    expect(arranged[2].transform.positionX).toBe(-25);
    expect(arranged[2].transform.positionY).toBe(25);

    expect(arranged[3].transform.positionX).toBe(25);
    expect(arranged[3].transform.positionY).toBe(25);
  });

  it('resets clip back to 100% full screen with no cropping', () => {
    const modifiedClip: Clip = {
      ...baseClip,
      transform: {
        positionX: 30,
        positionY: -30,
        scale: 0.35,
        rotation: 15,
        opacity: 0.9,
        crop: { top: 10, bottom: 10, left: 10, right: 10 },
      },
    };

    const resetClip = applyPipPreset(modifiedClip, 'reset_fullscreen');
    expect(resetClip.transform.scale).toBe(1.0);
    expect(resetClip.transform.positionX).toBe(0);
    expect(resetClip.transform.positionY).toBe(0);
    expect(resetClip.transform.crop).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('generates matching crop and overlay FFmpeg filter args for PIP and split-screen clips', () => {
    const project = createDefaultProject('Export PIP Test');
    const videoTrack = project.tracks.find((t) => t.type === 'video')!;
    const overlayTrack = project.tracks.find((t) => t.type === 'overlay')!;

    const mainAsset: ProjectAsset = {
      id: 'asset_bg',
      name: 'Background.mp4',
      type: 'video',
      relativePath: 'assets/Background.mp4',
      originalPath: 'C:/Media/Background.mp4',
      fileSize: 1000000,
      durationMs: 10000,
      isBundled: true,
    };
    const pipAsset: ProjectAsset = {
      id: 'asset_fg',
      name: 'Foreground.mp4',
      type: 'video',
      relativePath: 'assets/Foreground.mp4',
      originalPath: 'C:/Media/Foreground.mp4',
      fileSize: 1000000,
      durationMs: 10000,
      isBundled: true,
    };
    project.assets.push(mainAsset, pipAsset);

    const bgClip: Clip = {
      ...baseClip,
      id: 'clip_bg',
      trackId: videoTrack.id,
      assetId: mainAsset.id,
      durationMs: 10000,
      sourceEndMs: 10000,
    };
    const overlayClip: Clip = applyPipPreset({
      ...baseClip,
      id: 'clip_pip',
      trackId: overlayTrack.id,
      assetId: pipAsset.id,
      durationMs: 10000,
      sourceEndMs: 10000,
    }, 'pip_top_right');

    videoTrack.clips.push(bgClip);
    overlayTrack.clips.push(overlayClip);

    const resolver = (id: string) => {
      const a = project.assets.find((item) => item.id === id);
      return a ? a.originalPath : null;
    };

    const { args } = buildFFmpegExportArgs(project, EXPORT_PRESETS[0], 'C:/Exports/pip_output.mp4', resolver);
    const filterArg = args[args.indexOf('-filter_complex') + 1];

    // Verify overlay filter has correct top-right offset
    expect(filterArg).toContain('overlay=');
    expect(filterArg).toContain('scale=w=672:h=378'); // 1920 * 0.35 = 672
  });

  it('verifies split audio clip receives continuous slices of asset waveform peaks', () => {
    const project = createDefaultProject('Waveform Split Test');
    const audioTrack = project.tracks.find((t) => t.type === 'audio')!;

    // 100 peaks for a 10s audio asset
    const peaks = Array.from({ length: 100 }, (_, i) => Math.sin((i / 100) * Math.PI));
    const audioAsset: ProjectAsset = {
      id: 'asset_full_audio',
      name: 'Track.wav',
      type: 'audio',
      relativePath: 'assets/Track.wav',
      originalPath: 'C:/Media/Track.wav',
      fileSize: 500000,
      durationMs: 10000,
      waveformPeaks: peaks,
      isBundled: true,
    };
    project.assets.push(audioAsset);

    const originalAudioClip: Clip = {
      ...baseClip,
      id: 'clip_orig_audio',
      trackId: audioTrack.id,
      assetId: audioAsset.id,
      type: 'audio',
      startMs: 0,
      durationMs: 10000,
      sourceStartMs: 0,
      sourceEndMs: 10000,
    };
    audioTrack.clips.push(originalAudioClip);

    // Split clip at 4000ms (4 seconds)
    const splitResult = splitClipWithFeedback(project, 'clip_orig_audio', 4000, 30);
    expect(splitResult.success).toBe(true);

    const updatedAudioTrack = splitResult.project.tracks.find((t) => t.type === 'audio')!;
    expect(updatedAudioTrack.clips).toHaveLength(2);

    const firstHalf = updatedAudioTrack.clips[0];
    const secondHalf = updatedAudioTrack.clips[1];

    expect(firstHalf.durationMs).toBe(4000);
    expect(firstHalf.sourceStartMs).toBe(0);
    expect(firstHalf.sourceEndMs).toBe(4000);

    expect(secondHalf.durationMs).toBe(6000);
    expect(secondHalf.sourceStartMs).toBe(4000);
    expect(secondHalf.sourceEndMs).toBe(10000);

    // Calculate waveform slices for both halves
    const sliceA = getSliceWaveformPeaks(audioAsset.waveformPeaks, audioAsset.durationMs, firstHalf.sourceStartMs, firstHalf.durationMs, 40);
    const sliceB = getSliceWaveformPeaks(audioAsset.waveformPeaks, audioAsset.durationMs, secondHalf.sourceStartMs, secondHalf.durationMs, 60);

    expect(sliceA).toHaveLength(40);
    expect(sliceB).toHaveLength(60);
    // Continuity test: the end of slice A should match the start of slice B
    expect(sliceA[sliceA.length - 1]).toBeCloseTo(sliceB[0], 1);
  });

  it('updates SVG and attributes live when element properties are customized', () => {
    const bubbleProps = {
      elementType: 'bubble_speech' as const,
      category: 'bubble' as const,
      color: '#ffffff',
      secondaryColor: '#1e293b',
      strokeWidth: 4,
      cornerRadius: 16,
      text: 'Initial Speech',
      opacity: 0.95,
    };

    const initialSvg = generateElementSvg(bubbleProps, 400, 300);
    expect(initialSvg).toContain('Initial Speech');
    expect(initialSvg).toContain('stroke="#1e293b"');
    expect(initialSvg).toContain('stroke-width="4"');

    // Simulate user customization in PropertiesPanel
    const customizedProps = {
      ...bubbleProps,
      color: '#fef08a', // Yellow fill
      secondaryColor: '#dc2626', // Red outline
      strokeWidth: 8,
      text: 'Updated Dialogue Text!',
    };

    const updatedSvg = generateElementSvg(customizedProps, 400, 300);
    expect(updatedSvg).toContain('Updated Dialogue Text!');
    expect(updatedSvg).toContain('fill="#fef08a"');
    expect(updatedSvg).toContain('stroke="#dc2626"');
    expect(updatedSvg).toContain('stroke-width="8"');
  });

  it('generates valid FFmpeg crop filter for all 50/50 split screen directions', () => {
    const project = createDefaultProject('Split 50 Test');
    const videoTrack = project.tracks.find((t) => t.type === 'video')!;
    const overlayTrack = project.tracks.find((t) => t.type === 'overlay')!;

    const vidAsset: ProjectAsset = {
      id: 'asset_v1',
      name: 'Video1.mp4',
      type: 'video',
      relativePath: 'assets/Video1.mp4',
      originalPath: 'C:/Media/Video1.mp4',
      fileSize: 1000000,
      durationMs: 5000,
      isBundled: true,
    };
    project.assets.push(vidAsset);

    // Left split
    const leftClip = applyPipPreset({
      ...baseClip,
      id: 'clip_left',
      trackId: videoTrack.id,
      assetId: vidAsset.id,
    }, 'split_left_50');

    // Right split
    const rightClip = applyPipPreset({
      ...baseClip,
      id: 'clip_right',
      trackId: overlayTrack.id,
      assetId: vidAsset.id,
    }, 'split_right_50');

    videoTrack.clips.push(leftClip);
    overlayTrack.clips.push(rightClip);

    const { args } = buildFFmpegExportArgs(project, EXPORT_PRESETS[0], 'C:/Exports/split_out.mp4', (id) => 'C:/Media/Video1.mp4');
    const filterArg = args[args.indexOf('-filter_complex') + 1];

    // Crop right 50% for left clip
    expect(filterArg).toContain('crop=w=iw*0.500:h=ih*1.000:x=iw*0.000:y=ih*0.000');
    // Crop left 50% for right clip
    expect(filterArg).toContain('crop=w=iw*0.500:h=ih*1.000:x=iw*0.500:y=ih*0.000');
  });
});
