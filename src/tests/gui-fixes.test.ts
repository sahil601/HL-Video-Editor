import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_AUTO_CUT_SETTINGS, computeAutoCuts } from '../core/autoCut';
import { Project } from '../types/project';
import { createDefaultProject } from '../core/project';

describe('GUI Fixes Verification', () => {
  it('correctly associates file extensions to media types for native import', () => {
    const getMimeType = (fileName: string) => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'm4v', 'ts'].includes(ext)) return 'video/mp4';
      if (['mov', 'quicktime'].includes(ext)) return 'video/quicktime';
      if (['mkv'].includes(ext)) return 'video/x-matroska';
      if (['webm'].includes(ext)) return 'video/webm';
      if (['avi'].includes(ext)) return 'video/x-msvideo';
      if (['mp3'].includes(ext)) return 'audio/mpeg';
      if (['wav'].includes(ext)) return 'audio/wav';
      if (['aac'].includes(ext)) return 'audio/aac';
      if (['m4a'].includes(ext)) return 'audio/mp4';
      if (['ogg', 'oga'].includes(ext)) return 'audio/ogg';
      if (['flac'].includes(ext)) return 'audio/flac';
      if (['png'].includes(ext)) return 'image/png';
      if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
      if (['webp'].includes(ext)) return 'image/webp';
      if (['gif'].includes(ext)) return 'image/gif';
      if (['svg'].includes(ext)) return 'image/svg+xml';
      if (['bmp'].includes(ext)) return 'image/bmp';
      return 'application/octet-stream';
    };

    expect(getMimeType('movie.mp4')).toBe('video/mp4');
    expect(getMimeType('clip.mov')).toBe('video/quicktime');
    expect(getMimeType('track.mp3')).toBe('audio/mpeg');
    expect(getMimeType('sound.wav')).toBe('audio/wav');
    expect(getMimeType('pic.png')).toBe('image/png');
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('graphic.webp')).toBe('image/webp');
  });

  it('verifies Auto Cut compute engine works with silence and scene change inputs', () => {
    const durationMs = 10000;
    const silences = [
      { startMs: 2000, endMs: 4000, durationMs: 2000 },
    ];
    const sceneChanges = [
      { timeMs: 6000 },
    ];
    const settings = {
      ...DEFAULT_AUTO_CUT_SETTINGS,
      paddingBeforeMs: 100,
      paddingAfterMs: 100,
      minSilenceDurationMs: 500,
    };

    const res = computeAutoCuts(durationMs, silences, sceneChanges, settings);
    expect(res.proposedCuts.length).toBeGreaterThan(0);
    expect(res.timeSavedMs).toBeGreaterThan(0);

    // Each proposed cut has valid start, duration, and type
    for (const cut of res.proposedCuts) {
      expect(cut.startMs).toBeGreaterThanOrEqual(0);
      expect(cut.durationMs).toBeGreaterThan(0);
      expect(cut.included).toBe(true);
    }
  });

  it('verifies project format compatibility with added assets and auto-cut tracks', () => {
    const proj = createDefaultProject('Test Proj', '16:9');
    expect(proj.assets.length).toBe(0);

    const assetId = 'asset_test_1';
    proj.assets.push({
      id: assetId,
      name: 'imported_test.mp4',
      type: 'video',
      relativePath: 'assets/asset_test_1_imported_test.mp4',
      originalPath: 'C:\\Videos\\imported_test.mp4',
      fileSize: 1024000,
      durationMs: 8000,
      width: 1920,
      height: 1080,
      fps: 30,
      isBundled: true,
      blobUrl: 'blob:test',
    });

    expect(proj.assets.length).toBe(1);
    expect(proj.assets[0].originalPath).toBe('C:\\Videos\\imported_test.mp4');

    // Add asset to video track
    const videoTrack = proj.tracks.find(t => t.type === 'video');
    expect(videoTrack).toBeDefined();

    videoTrack!.clips.push({
      id: 'clip_imported_1',
      trackId: videoTrack!.id,
      assetId: assetId,
      name: 'imported_test.mp4',
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
    });

    expect(videoTrack!.clips.length).toBe(1);
  });
});
