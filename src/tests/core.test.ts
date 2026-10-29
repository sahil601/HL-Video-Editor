import { describe, it, expect } from 'vitest';
import { formatTimecode, parseTimecode, stepFrame, calculateSnap, clamp } from '../core/time';
import { interpolateKeyframes } from '../core/keyframes';
import { evaluateSpeedCurve, SPEED_CURVE_PRESETS } from '../core/speedCurves';
import {
  createDefaultProject,
  splitClipAtTime,
  splitClipWithFeedback,
  trimClipBoundary,
  moveClip,
  deleteClip,
  duplicateClip,
  validateProjectManifest,
  freezeFrameClip,
  extractAudioFromClip,
} from '../core/project';
import { createVnestPackage, inspectAndValidateVnestPackage, extractVnestPackage } from '../core/package';
import { buildFFmpegExportArgs, parseFFmpegProgress, EXPORT_PRESETS } from '../core/ffmpeg';
import { Clip } from '../types/project';

describe('Time Engine', () => {
  it('formats timecode correctly at 30 fps', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00');
    expect(formatTimecode(1000, 30)).toBe('00:01:00');
    expect(formatTimecode(61000, 30)).toBe('01:01:00');
    expect(formatTimecode(3661000, 30)).toBe('01:01:01:00');
  });

  it('steps frames forward and backward', () => {
    const frameMs = 1000 / 30; // ~33.33ms
    const steppedNext = stepFrame(0, 30, 1);
    expect(steppedNext).toBe(Math.round(frameMs));

    const steppedPrev = stepFrame(steppedNext, 30, -1);
    expect(steppedPrev).toBe(0);
  });

  it('snaps within threshold and ignores points outside threshold', () => {
    const snapPoints = [0, 1000, 2500, 5000];
    const snapNear = calculateSnap(1050, snapPoints, 100);
    expect(snapNear.snapped).toBe(true);
    expect(snapNear.snappedTimeMs).toBe(1000);

    const snapFar = calculateSnap(1200, snapPoints, 100);
    expect(snapFar.snapped).toBe(false);
    expect(snapFar.snappedTimeMs).toBe(1200);
  });
});

describe('Keyframes Interpolation', () => {
  const baseTransform = { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
  const baseVolume = 1.0;

  it('returns base values when keyframes are empty', () => {
    const res = interpolateKeyframes(baseTransform, baseVolume, [], 500);
    expect(res.scale).toBe(1.0);
    expect(res.volume).toBe(1.0);
  });

  it('interpolates linearly between two keyframes', () => {
    const kfs = [
      { id: '1', offsetMs: 0, properties: { scale: 1.0, opacity: 1.0 }, easing: 'linear' as const },
      { id: '2', offsetMs: 1000, properties: { scale: 2.0, opacity: 0.0 }, easing: 'linear' as const },
    ];
    const mid = interpolateKeyframes(baseTransform, baseVolume, kfs, 500);
    expect(mid.scale).toBeCloseTo(1.5, 2);
    expect(mid.opacity).toBeCloseTo(0.5, 2);
  });
});

describe('Speed Curves', () => {
  it('evaluates speed curve presets cleanly', () => {
    const hero = SPEED_CURVE_PRESETS.find((p) => p.id === 'hero')!;
    const startSpeed = evaluateSpeedCurve(hero.points, 0.0);
    const midSpeed = evaluateSpeedCurve(hero.points, 0.5);
    const endSpeed = evaluateSpeedCurve(hero.points, 1.0);

    expect(startSpeed).toBe(1.0);
    expect(midSpeed).toBeLessThan(1.0); // Hero slows down in center
    expect(endSpeed).toBe(1.0);
  });
});

describe('Project & Timeline Operations', () => {
  it('creates a default valid project', () => {
    const project = createDefaultProject('My Test Edit', '16:9');
    expect(project.name).toBe('My Test Edit');
    expect(project.tracks.length).toBe(4);
    expect(project.settings.width).toBe(1920);
    expect(project.settings.height).toBe(1080);

    const validation = validateProjectManifest(project);
    expect(validation.isValid).toBe(true);
  });

  it('splits a clip cleanly at playhead position', () => {
    const project = createDefaultProject('Split Test', '16:9');
    const testClip: Clip = {
      id: 'clip_orig',
      trackId: 'track_video_main',
      name: 'Test Clip',
      type: 'video',
      startMs: 0,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };

    project.tracks[2].clips = [testClip];
    project.durationMs = 4000;

    // Split at 1500ms
    const updated = splitClipAtTime(project, 'clip_orig', 1500);
    const clips = updated.tracks[2].clips;

    expect(clips.length).toBe(2);
    expect(clips[0].id).toBe('clip_orig');
    expect(clips[0].startMs).toBe(0);
    expect(clips[0].durationMs).toBe(1500);
    expect(clips[0].sourceEndMs).toBe(1500);

    expect(clips[1].startMs).toBe(1500);
    expect(clips[1].durationMs).toBe(2500);
    expect(clips[1].sourceStartMs).toBe(1500);
    expect(clips[1].sourceEndMs).toBe(4000);
  });

  it('trims clip boundaries', () => {
    const project = createDefaultProject('Trim Test', '16:9');
    const testClip: Clip = {
      id: 'clip_trim',
      trackId: 'track_video_main',
      name: 'Trim Clip',
      type: 'video',
      startMs: 1000,
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
    project.tracks[2].clips = [testClip];

    // Trim left by 500ms
    const trimmedLeft = trimClipBoundary(project, 'clip_trim', 'left', 500);
    const c1 = trimmedLeft.tracks[2].clips[0];
    expect(c1.startMs).toBe(1500);
    expect(c1.durationMs).toBe(4500);
    expect(c1.sourceStartMs).toBe(500);

    // Trim right by -1000ms (shortening)
    const trimmedRight = trimClipBoundary(trimmedLeft, 'clip_trim', 'right', -1000);
    const c2 = trimmedRight.tracks[2].clips[0];
    expect(c2.durationMs).toBe(3500);
    expect(c2.sourceEndMs).toBe(4000);
  });

  it('moves and duplicates clips', () => {
    const project = createDefaultProject('Move Test', '16:9');
    const testClip: Clip = {
      id: 'clip_1',
      trackId: 'track_video_main',
      name: 'Moving Clip',
      type: 'video',
      startMs: 0,
      durationMs: 2000,
      sourceStartMs: 0,
      sourceEndMs: 2000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [testClip];

    const moved = moveClip(project, 'clip_1', 'track_video_main', 3000);
    expect(moved.tracks[2].clips[0].startMs).toBe(3000);

    const duped = duplicateClip(moved, 'clip_1');
    expect(duped.tracks[2].clips.length).toBe(2);
    expect(duped.tracks[2].clips[1].startMs).toBe(5000); // Placed at 3000 + 2000
  });
});

describe('Portable .vnest Packaging Engine', () => {
  it('creates and extracts a portable .vnest package cleanly', async () => {
    const project = createDefaultProject('Portable Vlog', '16:9');
    const assetId = 'asset_sample_1';
    project.assets = [
      {
        id: assetId,
        name: 'drone.mp4',
        type: 'video',
        relativePath: 'assets/asset_sample_1_drone.mp4',
        originalPath: 'C:\\Videos\\drone.mp4',
        fileSize: 1024,
        durationMs: 5000,
        isBundled: true,
      },
    ];

    const mockBinary = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
    const assetMap = new Map<string, Uint8Array>();
    assetMap.set(assetId, mockBinary);

    // Package into .vnest blob
    const zipBlob = await createVnestPackage(project, assetMap, { includeMedia: true });
    expect(zipBlob.size).toBeGreaterThan(0);

    // Validate archive
    const validation = await inspectAndValidateVnestPackage(zipBlob);
    expect(validation.isValid).toBe(true);
    expect(validation.manifest?.name).toBe('Portable Vlog');
    expect(validation.assetFileCount).toBe(1);

    // Extract archive
    const extracted = await extractVnestPackage(zipBlob);
    expect(extracted.project.id).toBe(project.id);
    expect(extracted.extractedAssets.has(assetId)).toBe(true);
    expect(extracted.missingAssets.length).toBe(0);
  });
});

describe('FFmpeg Command Builder', () => {
  it('constructs valid export arguments and progress parser', () => {
    const project = createDefaultProject('Render Test', '16:9');
    const preset = EXPORT_PRESETS[0]; // 1080p

    const { args } = buildFFmpegExportArgs(
      project,
      preset,
      'C:\\Exports\\output.mp4',
      () => null
    );

    expect(args).toContain('-y');
    expect(args).toContain('C:\\Exports\\output.mp4');

    // Progress parsing
    const sampleLine = 'frame=  120 fps= 60 q=28.0 size=    1280kB time=00:00:05.00 bitrate=2097.2kbits/s speed=2.0x';
    const progress = parseFFmpegProgress(sampleLine, 10000); // 10s total
    expect(progress).toBe(50); // 5s out of 10s = 50%
  });
});

describe('Split Operations & Feedback Engine', () => {
  it('provides detailed feedback when split fails', () => {
    const project = createDefaultProject('Fail Split Test', '16:9');
    const clip: Clip = {
      id: 'clip_sample',
      trackId: 'track_video_main',
      name: 'Sample Video.mp4',
      type: 'video',
      startMs: 2000,
      durationMs: 8000, // 2s to 10s
      sourceStartMs: 0,
      sourceEndMs: 8000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [clip];

    // 1. No clip selected
    const resNoClip = splitClipWithFeedback(project, null, 5000);
    expect(resNoClip.success).toBe(false);
    expect(resNoClip.message).toContain('No clip is selected');

    // 2. Playhead before clip (1000ms < 2000ms)
    const resBefore = splitClipWithFeedback(project, 'clip_sample', 1000);
    expect(resBefore.success).toBe(false);
    expect(resBefore.message).toContain('before clip start');

    // 3. Playhead after clip (12000ms > 10000ms)
    const resAfter = splitClipWithFeedback(project, 'clip_sample', 12000);
    expect(resAfter.success).toBe(false);
    expect(resAfter.message).toContain('after clip end');

    // 4. Playhead within 50ms of edge (2020ms)
    const resEdge = splitClipWithFeedback(project, 'clip_sample', 2020);
    expect(resEdge.success).toBe(false);
    expect(resEdge.message).toContain('50ms');
  });


  it('splits imported video at 5000ms with continuous source playback', () => {
    const project = createDefaultProject('Video Split Test', '16:9');
    const importedVideoClip: Clip = {
      id: 'clip_real_video',
      trackId: 'track_video_main',
      name: '4K_Drone_Flight.mp4',
      type: 'video',
      startMs: 0,
      durationMs: 12000, // 12 seconds
      sourceStartMs: 2000, // started 2s into source
      sourceEndMs: 14000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [importedVideoClip];
    project.durationMs = 12000;

    // Split at 5000ms
    const res = splitClipWithFeedback(project, 'clip_real_video', 5000);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Clip split successfully');
    expect(res.newClipId).toBeDefined();

    const clips = res.project.tracks[2].clips;
    expect(clips.length).toBe(2);

    const [part1, part2] = clips;

    // First part: 0 -> 5000ms
    expect(part1.id).toBe('clip_real_video');
    expect(part1.startMs).toBe(0);
    expect(part1.durationMs).toBe(5000);
    expect(part1.sourceStartMs).toBe(2000);
    expect(part1.sourceEndMs).toBe(7000); // 2000 + 5000

    // Second part: 5000ms -> 12000ms
    expect(part2.id).toBe(res.newClipId);
    expect(part2.name).toBe('4K_Drone_Flight.mp4 (Part 2)');
    expect(part2.startMs).toBe(5000);
    expect(part2.durationMs).toBe(7000);
    expect(part2.sourceStartMs).toBe(7000); // exactly matches part1's sourceEndMs!
    expect(part2.sourceEndMs).toBe(14000);

    // Verify source frame continuity:
    // Frame at 4999ms in part1:
    const frameBeforeCut = part1.sourceStartMs + (4999 - part1.startMs);
    expect(frameBeforeCut).toBe(6999);

    // Frame at 5000ms in part2:
    const frameAtCut = part2.sourceStartMs + (5000 - part2.startMs);
    expect(frameAtCut).toBe(7000); // seamlessly 1ms later!
  });

  it('freezeFrameClip inserts a 3s frozen clip with exact source offset', () => {
    const project = createDefaultProject('Freeze Test', '16:9');
    const clip: Clip = {
      id: 'clip_v_freeze',
      trackId: 'track_video_main',
      name: 'Skate_Trick.mp4',
      type: 'video',
      startMs: 0,
      durationMs: 10000,
      sourceStartMs: 1000,
      sourceEndMs: 11000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [clip];
    project.durationMs = 10000;

    // Freeze frame at 4000ms
    const res = freezeFrameClip(project, 'clip_v_freeze', 4000, 3000);
    expect(res).toBeDefined();
    const clips = res!.project.tracks[2].clips;
    expect(clips.length).toBe(3);

    const [before, frozen, after] = clips;
    // Clip before: 0 to 4000ms
    expect(before.durationMs).toBe(4000);

    // Frozen clip: 4000 to 7000ms (3s duration)
    expect(frozen.isFrozen).toBe(true);
    expect(frozen.durationMs).toBe(3000);
    expect(frozen.startMs).toBe(4000);
    expect(frozen.freezeFrameSourceMs).toBe(5000); // 1000 sourceStart + 4000 offset
    expect(frozen.name).toContain('[Freeze]');

    // Clip after: 7000 to 13000ms (shifted forward by 3000ms)
    expect(after.startMs).toBe(7000);
    expect(after.durationMs).toBe(6000);
  });

  it('extractAudioFromClip separates audio onto audio track and mutes video', () => {
    const project = createDefaultProject('Audio Extract Test', '16:9');
    const videoClip: Clip = {
      id: 'clip_vid',
      trackId: 'track_video_main',
      assetId: 'asset_1',
      name: 'Interview.mp4',
      type: 'video',
      startMs: 2000,
      durationMs: 8000,
      sourceStartMs: 500,
      sourceEndMs: 8500,
      speed: 1.0,
      volume: 0.8,
      fadeInMs: 500,
      fadeOutMs: 500,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [videoClip];

    const res = extractAudioFromClip(project, 'clip_vid');
    expect(res).toBeDefined();

    // Video clip should be muted to 0 volume
    const updatedVideo = res!.project.tracks[2].clips.find((c) => c.id === 'clip_vid')!;
    expect(updatedVideo.volume).toBe(0);

    // Audio track (track_audio_1) should now have the extracted audio clip
    const audioTrack = res!.project.tracks.find((t) => t.id === 'track_audio_1')!;
    expect(audioTrack.clips.length).toBe(1);

    const audioClip = audioTrack.clips[0];
    expect(audioClip.type).toBe('audio');
    expect(audioClip.name).toContain('(Extracted Audio)');
    expect(audioClip.startMs).toBe(2000);
    expect(audioClip.durationMs).toBe(8000);
    expect(audioClip.sourceStartMs).toBe(500);
    expect(audioClip.volume).toBe(0.8);
  });
});

describe('Advanced FFmpeg Filtergraph Engine', () => {
  it('generates filtergraph with crop, flip, rotation, chroma key, and color grading', () => {
    const project = createDefaultProject('Export Transform Test', '16:9');
    const assetId = 'asset_green_screen';
    project.assets = [
      {
        id: assetId,
        name: 'dancer_greenscreen.mp4',
        type: 'video',
        relativePath: 'assets/dancer.mp4',
        originalPath: 'C:/media/dancer.mp4',
        fileSize: 1024,
        durationMs: 5000,
        isBundled: true,
      },
    ];

    const clip: Clip = {
      id: 'clip_greenscreen',
      trackId: 'track_video_main',
      assetId,
      name: 'Dancer Green Screen',
      type: 'video',
      startMs: 0,
      durationMs: 5000,
      sourceStartMs: 0,
      sourceEndMs: 5000,
      speed: 1.0,
      volume: 0.9,
      fadeInMs: 300,
      fadeOutMs: 300,
      transform: {
        positionX: 10,
        positionY: -5,
        scale: 1.2,
        rotation: 45,
        opacity: 0.85,
        flipH: true,
        flipV: false,
        crop: { top: 10, bottom: 5, left: 15, right: 10 },
      },
      chromaKey: {
        enabled: true,
        color: '#00FF00',
        similarity: 0.38,
        smoothness: 0.12,
      },
      colorAdjustments: {
        brightness: 10,
        contrast: 15,
        saturation: 20,
        temperature: 25,
        tint: -10,
        vignette: 30,
        sharpen: 20,
        presetName: 'Custom',
      },
      keyframes: [],
    };
    project.tracks[2].clips = [clip];
    project.durationMs = 5000;

    const preset = EXPORT_PRESETS[0];
    const { args } = buildFFmpegExportArgs(
      project,
      preset,
      'C:/exports/test_render.mp4',
      (id) => (id === assetId ? 'C:/media/dancer.mp4' : null)
    );

    const filterArgIdx = args.indexOf('-filter_complex');
    expect(filterArgIdx).toBeGreaterThan(-1);
    const filtergraph = args[filterArgIdx + 1];

    // Crop filter
    expect(filtergraph).toContain('crop=');

    // Flip horizontal
    expect(filtergraph).toContain('hflip');

    // Rotation
    expect(filtergraph).toContain('rotate=');

    // Chroma key (colorkey)
    expect(filtergraph).toContain('colorkey=color=0x00FF00:similarity=0.38:blend=0.12');

    // Color grading (eq, colorbalance, vignette, unsharp)
    expect(filtergraph).toContain('eq=brightness=');
    expect(filtergraph).toContain('colorbalance=');
    expect(filtergraph).toContain('vignette=');
    expect(filtergraph).toContain('unsharp=');

    // Opacity
    expect(filtergraph).toContain('colorchannelmixer=aa=0.85');

    // Audio fade in and fade out
    expect(filtergraph).toContain('afade=t=in:ss=0:d=0.30');
    expect(filtergraph).toContain('afade=t=out:st=4.70:d=0.30');
  });
});


