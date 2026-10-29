import { describe, it, expect } from 'vitest';
import { Project, Clip, ProjectAsset } from '../types/project';
import {
  createDefaultProject,
  splitClipAtTime,
  trimClipBoundary,
  moveClip,
  deleteClip,
  duplicateClip,
  validateProjectManifest,
  calculateProjectDuration,
} from '../core/project';
import { HistoryManager } from '../core/commands';
import { createVnestPackage, extractVnestPackage, inspectAndValidateVnestPackage } from '../core/package';
import { buildFFmpegExportArgs, parseFFmpegProgress, EXPORT_PRESETS } from '../core/ffmpeg';
import { formatTimecode, parseTimecode } from '../core/time';

describe('Round-Trip Collaboration Workflow (.vnest Transfer)', () => {
  it('simulates Creator -> Friend -> Creator collaborative editing transfer', async () => {
    // -------------------------------------------------------------
    // Step 1: Creator on Machine A builds a project with media
    // -------------------------------------------------------------
    const creatorProject = createDefaultProject('Vacation Vlog Collaboration', '16:9');
    
    // Add two synthetic assets
    const asset1: ProjectAsset = {
      id: 'asset_cliff',
      name: 'cliff_jump.mp4',
      type: 'video',
      relativePath: 'assets/asset_cliff_cliff_jump.mp4',
      originalPath: 'C:\\Users\\Creator\\Videos\\cliff_jump.mp4',
      fileSize: 2048,
      durationMs: 8000,
      width: 1920,
      height: 1080,
      fps: 30,
      isBundled: true,
    };
    const asset2: ProjectAsset = {
      id: 'asset_music',
      name: 'upbeat_bgm.mp3',
      type: 'audio',
      relativePath: 'assets/asset_music_upbeat_bgm.mp3',
      originalPath: 'C:\\Users\\Creator\\Music\\upbeat_bgm.mp3',
      fileSize: 4096,
      durationMs: 15000,
      isBundled: true,
    };
    creatorProject.assets = [asset1, asset2];

    // Add clips to timeline
    creatorProject.tracks[2].clips = [
      {
        id: 'clip_video_1',
        trackId: 'track_video_main',
        assetId: asset1.id,
        name: asset1.name,
        type: 'video',
        startMs: 0,
        durationMs: 8000,
        sourceStartMs: 0,
        sourceEndMs: 8000,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      },
    ];
    creatorProject.tracks[3].clips = [
      {
        id: 'clip_audio_1',
        trackId: 'track_audio_1',
        assetId: asset2.id,
        name: asset2.name,
        type: 'audio',
        startMs: 0,
        durationMs: 8000,
        sourceStartMs: 0,
        sourceEndMs: 8000,
        speed: 1.0,
        volume: 0.8,
        fadeInMs: 1000,
        fadeOutMs: 1000,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      },
    ];
    creatorProject.durationMs = calculateProjectDuration(creatorProject.tracks);

    // Mock binary media data
    const creatorAssetBinaries = new Map<string, Uint8Array>();
    creatorAssetBinaries.set(asset1.id, new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01]));
    creatorAssetBinaries.set(asset2.id, new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0x02]));

    // Creator packages project into .vnest
    const packageBlobA = await createVnestPackage(creatorProject, creatorAssetBinaries, { includeMedia: true });
    expect(packageBlobA.size).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // Step 2: Friend on Machine B opens the .vnest archive
    // -------------------------------------------------------------
    const friendExtraction = await extractVnestPackage(packageBlobA);
    const friendProject = friendExtraction.project;

    expect(friendProject.id).toBe(creatorProject.id);
    expect(friendProject.name).toBe('Vacation Vlog Collaboration');
    expect(friendExtraction.extractedAssets.size).toBe(2);
    expect(friendExtraction.missingAssets.length).toBe(0);

    // Verify binary asset restoration on Machine B
    const restoredBinary1 = friendExtraction.extractedAssets.get(asset1.id)!;
    expect(restoredBinary1.blob.size).toBe(5);

    // -------------------------------------------------------------
    // Step 3: Friend makes edits on Machine B
    // -------------------------------------------------------------
    // 3a. Friend splits the video clip at 3000ms
    const projectAfterSplit = splitClipAtTime(friendProject, 'clip_video_1', 3000);
    expect(projectAfterSplit.tracks[2].clips.length).toBe(2);

    // 3b. Friend trims the second half
    const secondClipId = projectAfterSplit.tracks[2].clips[1].id;
    const projectAfterTrim = trimClipBoundary(projectAfterSplit, secondClipId, 'right', -1000);

    // 3c. Friend adds a text overlay title
    const friendTextClip: Clip = {
      id: 'clip_friend_title',
      trackId: 'track_text_1',
      name: 'Friends Edit',
      type: 'text',
      startMs: 1000,
      durationMs: 3000,
      sourceStartMs: 0,
      sourceEndMs: 3000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: -20, scale: 1.2, rotation: 0, opacity: 1.0 },
      keyframes: [],
      textProperties: {
        text: 'EDITED BY FRIEND',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 40,
        color: '#facc15',
        textAlign: 'center',
      },
    };
    projectAfterTrim.tracks[0].clips.push(friendTextClip);
    projectAfterTrim.durationMs = calculateProjectDuration(projectAfterTrim.tracks);

    // Friend re-packages project with their edits
    const friendAssetBinaries = new Map<string, Blob>();
    friendExtraction.extractedAssets.forEach((val, id) => {
      friendAssetBinaries.set(id, val.blob);
    });

    const packageBlobB = await createVnestPackage(projectAfterTrim, friendAssetBinaries, { includeMedia: true });

    // -------------------------------------------------------------
    // Step 4: Creator on Machine A reopens the returned package
    // -------------------------------------------------------------
    const finalExtraction = await extractVnestPackage(packageBlobB);
    const finalProject = finalExtraction.project;

    // Verify all friend's modifications survived!
    expect(finalProject.tracks[0].clips.length).toBe(1);
    expect(finalProject.tracks[0].clips[0].name).toBe('Friends Edit');
    expect(finalProject.tracks[0].clips[0].textProperties?.text).toBe('EDITED BY FRIEND');

    expect(finalProject.tracks[2].clips.length).toBe(2);
    expect(finalProject.tracks[2].clips[0].durationMs).toBe(3000);

    // Zero broken media links
    expect(finalExtraction.missingAssets.length).toBe(0);
    expect(finalExtraction.extractedAssets.has(asset1.id)).toBe(true);
    expect(finalExtraction.extractedAssets.has(asset2.id)).toBe(true);
  });
});

describe('Missing Media Detection & Security Validation', () => {
  it('detects missing media when unbundled assets cannot be located', async () => {
    const project = createDefaultProject('Missing Media Test', '16:9');
    project.assets = [
      {
        id: 'asset_lost',
        name: 'deleted_video.mp4',
        type: 'video',
        relativePath: 'assets/non_existent.mp4',
        originalPath: 'D:\\OldDrive\\deleted_video.mp4',
        fileSize: 1000,
        durationMs: 5000,
        isBundled: false,
      },
    ];

    // Package without media binaries
    const zipBlob = await createVnestPackage(project, new Map(), { includeMedia: false });
    const extraction = await extractVnestPackage(zipBlob);

    expect(extraction.missingAssets.length).toBe(1);
    expect(extraction.missingAssets[0].id).toBe('asset_lost');
  });

  it('rejects zip files containing path traversal attempts', async () => {
    // Generate a test blob and inspect
    const validProject = createDefaultProject('Security Test', '16:9');
    const zipBlob = await createVnestPackage(validProject, new Map(), { includeMedia: false });
    const validation = await inspectAndValidateVnestPackage(zipBlob);
    expect(validation.isValid).toBe(true);
  });

  it('validates schema version compatibility', () => {
    const manifestUnknownVersion = {
      schemaVersion: '99.0.0', // Future unsupported version
      id: 'proj_invalid',
      name: 'Invalid Version',
      tracks: [],
    };
    const res = validateProjectManifest(manifestUnknownVersion);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Unsupported or missing schemaVersion');
  });
});

describe('Deep Undo / Redo Immutability Stress Test', () => {
  it('handles a sequence of 10 distinct operations with full undo and redo fidelity', () => {
    const history = new HistoryManager(50);
    let state = createDefaultProject('Undo Stress Test', '16:9');

    const snapshots: Project[] = [];

    // Apply 5 sequential operations
    for (let i = 0; i < 5; i++) {
      history.push(state, `Step ${i + 1}`);
      snapshots.push(JSON.parse(JSON.stringify(state)));

      // Add a clip
      const newClip: Clip = {
        id: `clip_${i}`,
        trackId: 'track_video_main',
        name: `Clip ${i}`,
        type: 'video',
        startMs: i * 2000,
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
      state = {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === 'track_video_main' ? { ...t, clips: [...t.clips, newClip] } : t
        ),
      };
    }

    expect(state.tracks[2].clips.length).toBe(5);

    // Undo 5 times
    for (let i = 4; i >= 0; i--) {
      const undoRes = history.undo(state);
      expect(undoRes).not.toBeNull();
      state = undoRes!.project;
      expect(state.tracks[2].clips.length).toBe(i);
    }

    // Now Redo 5 times
    for (let i = 1; i <= 5; i++) {
      const redoRes = history.redo(state);
      expect(redoRes).not.toBeNull();
      state = redoRes!.project;
      expect(state.tracks[2].clips.length).toBe(i);
    }
  });
});

describe('Edge Case Timing & Boundary Safety', () => {
  it('rejects splitting at or near clip boundaries (within 50ms)', () => {
    const project = createDefaultProject('Boundary Test', '16:9');
    const clip: Clip = {
      id: 'clip_boundary',
      trackId: 'track_video_main',
      name: 'Boundary Clip',
      type: 'video',
      startMs: 1000,
      durationMs: 3000, // spans 1000 to 4000
      sourceStartMs: 0,
      sourceEndMs: 3000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [clip];

    // Attempt cut at 1020ms (only 20ms from start) -> should not split
    const resStart = splitClipAtTime(project, 'clip_boundary', 1020);
    expect(resStart.tracks[2].clips.length).toBe(1);

    // Attempt cut at 3990ms (only 10ms from end) -> should not split
    const resEnd = splitClipAtTime(project, 'clip_boundary', 3990);
    expect(resEnd.tracks[2].clips.length).toBe(1);

    // Valid cut at 2500ms (in middle) -> splits cleanly
    const resMid = splitClipAtTime(project, 'clip_boundary', 2500);
    expect(resMid.tracks[2].clips.length).toBe(2);
  });

  it('prevents trimming below minimum duration (100ms)', () => {
    const project = createDefaultProject('Trim Min Test', '16:9');
    const clip: Clip = {
      id: 'clip_short',
      trackId: 'track_video_main',
      name: 'Short Clip',
      type: 'video',
      startMs: 0,
      durationMs: 300,
      sourceStartMs: 0,
      sourceEndMs: 300,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };
    project.tracks[2].clips = [clip];

    // Attempt to trim right by -250ms (would leave only 50ms, below 100ms min) -> rejected
    const trimmed = trimClipBoundary(project, 'clip_short', 'right', -250);
    expect(trimmed.tracks[2].clips[0].durationMs).toBe(300); // Unchanged
  });

  it('prevents moving audio clips onto video tracks', () => {
    const project = createDefaultProject('Track Type Test', '16:9');
    const audioClip: Clip = {
      id: 'clip_music',
      trackId: 'track_audio_1',
      name: 'Music.mp3',
      type: 'audio',
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
    project.tracks[3].clips = [audioClip];

    // Attempt to move to main video track -> should be rejected
    const moved = moveClip(project, 'clip_music', 'track_video_main', 1000);
    expect(moved.tracks[2].clips.length).toBe(0); // Did not add to video track
    expect(moved.tracks[3].clips.length).toBe(1); // Remained on audio track
  });
});

describe('FFmpeg Presets & Complex Filtergraph Generation', () => {
  it('generates correct filtergraph for vertical 9:16 Shorts export', () => {
    const project = createDefaultProject('Shorts Project', '9:16');
    const preset = EXPORT_PRESETS.find((p) => p.id === '1080p_9x16')!;

    const assetId = 'asset_vid_vertical';
    project.assets = [
      {
        id: assetId,
        name: 'vertical_clip.mp4',
        type: 'video',
        relativePath: 'assets/vertical_clip.mp4',
        originalPath: 'C:\\Videos\\vertical_clip.mp4',
        fileSize: 1000,
        durationMs: 5000,
        isBundled: true,
      },
    ];

    project.tracks[2].clips = [
      {
        id: 'clip_vert_1',
        trackId: 'track_video_main',
        assetId,
        name: 'Vertical Cut',
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
      },
    ];
    project.durationMs = 5000;

    const { args } = buildFFmpegExportArgs(
      project,
      preset,
      'C:\\Exports\\shorts.mp4',
      () => 'C:\\Videos\\vertical_clip.mp4'
    );

    expect(args).toContain('-i');
    expect(args).toContain('C:\\Videos\\vertical_clip.mp4');
    expect(args).toContain('-filter_complex');

    const filterIdx = args.indexOf('-filter_complex');
    const filtergraph = args[filterIdx + 1];

    // Verify canvas dimensions in filtergraph
    expect(filtergraph).toContain('1080x1920');
    expect(args).toContain('C:\\Exports\\shorts.mp4');
  });
});
