import { describe, it, expect } from 'vitest';
import { Project, Track, Clip, Keyframe } from '../types/project';
import { createDefaultProject, splitClipWithFeedback, trimClipBoundary, moveClip, deleteClip, duplicateClip } from '../core/project';
import { rippleTrimClip, rollEditAdjacentClips, slipClip, slideClip } from '../core/trimTools';
import { groupClips, ungroupClips, moveGroupClips, duplicateGroupClips, deleteGroupClips } from '../core/clipGrouping';
import { toggleTrackLock, toggleTrackMute, toggleTrackVisibility, toggleTrackSolo } from '../core/trackControls';
import { evaluateCubicBezier, evaluateEasing, interpolateKeyframes } from '../core/keyframes';
import { HistoryManager } from '../core/commands';

function createTestProject(): Project {
  const p = createDefaultProject('Phase 5 Test');
  // Track 0: video track with 2 adjacent clips
  p.tracks[0].clips = [
    {
      id: 'clip_a',
      trackId: p.tracks[0].id,
      name: 'Clip A',
      type: 'video',
      startMs: 0,
      durationMs: 4000,
      sourceStartMs: 1000,
      sourceEndMs: 5000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    },
    {
      id: 'clip_b',
      trackId: p.tracks[0].id,
      name: 'Clip B',
      type: 'video',
      startMs: 4000,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    },
    {
      id: 'clip_c',
      trackId: p.tracks[0].id,
      name: 'Clip C',
      type: 'video',
      startMs: 8000,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    },
  ];

  // Track 1: audio track
  p.tracks[1].clips = [
    {
      id: 'clip_audio',
      trackId: p.tracks[1].id,
      name: 'Audio 1',
      type: 'audio',
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

  return p;
}

describe('Phase 5 — Professional Trim Tools', () => {
  describe('Ripple Edit', () => {
    it('ripple trims tail and shifts subsequent clips automatically', () => {
      const p = createTestProject();
      // Trim clip_a tail by -1000ms (duration becomes 3000ms)
      const res = rippleTrimClip(p, 'clip_a', 'right', -1000);
      expect(res.success).toBe(true);

      const track = res.project.tracks[0];
      const clipA = track.clips.find((c) => c.id === 'clip_a')!;
      const clipB = track.clips.find((c) => c.id === 'clip_b')!;
      const clipC = track.clips.find((c) => c.id === 'clip_c')!;

      expect(clipA.durationMs).toBe(3000);
      expect(clipB.startMs).toBe(3000); // Shifted backward by 1000ms
      expect(clipC.startMs).toBe(7000); // Shifted backward by 1000ms
    });

    it('ripple trims head and moves clip start plus downstream clips', () => {
      const p = createTestProject();
      // Trim clip_a head by +1000ms (shortens clip from front)
      const res = rippleTrimClip(p, 'clip_a', 'left', 1000);
      expect(res.success).toBe(true);

      const track = res.project.tracks[0];
      const clipA = track.clips.find((c) => c.id === 'clip_a')!;
      const clipB = track.clips.find((c) => c.id === 'clip_b')!;

      expect(clipA.durationMs).toBe(3000);
      expect(clipA.sourceStartMs).toBe(2000); // Was 1000, added 1000
      expect(clipB.startMs).toBe(3000); // Shifted to maintain continuous sequence
    });

    it('enforces minimum clip duration of 100ms', () => {
      const p = createTestProject();
      // Attempt to trim clip_a tail by -5000ms (more than its 4000ms duration)
      const res = rippleTrimClip(p, 'clip_a', 'right', -5000);
      expect(res.success).toBe(false);
      expect(res.message).toContain('100ms');
    });

    it('rejects ripple edit on locked track', () => {
      const p = createTestProject();
      p.tracks[0].isLocked = true;
      const res = rippleTrimClip(p, 'clip_a', 'right', -500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('locked');
    });
  });

  describe('Roll Edit', () => {
    it('rolls cut point between adjacent clips while preserving total sequence duration', () => {
      const p = createTestProject();
      // Roll edit between clip_a and clip_b by +1000ms:
      // clip_a grows by 1000ms, clip_b shrinks by 1000ms
      const initialTotalDuration = p.tracks[0].clips[1].startMs + p.tracks[0].clips[1].durationMs;
      const res = rollEditAdjacentClips(p, 'clip_a', 'clip_b', 1000);
      expect(res.success).toBe(true);

      const track = res.project.tracks[0];
      const clipA = track.clips.find((c) => c.id === 'clip_a')!;
      const clipB = track.clips.find((c) => c.id === 'clip_b')!;

      expect(clipA.durationMs).toBe(5000);
      expect(clipB.startMs).toBe(5000);
      expect(clipB.durationMs).toBe(3000);
      expect(clipB.sourceStartMs).toBe(1000); // Offset into source

      const newTotalDuration = clipB.startMs + clipB.durationMs;
      expect(newTotalDuration).toBe(initialTotalDuration); // Sequence duration preserved!
    });

    it('rejects roll edit if clips are not on the same track', () => {
      const p = createTestProject();
      const res = rollEditAdjacentClips(p, 'clip_a', 'clip_audio', 500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('same track');
    });

    it('rejects roll edit on locked track', () => {
      const p = createTestProject();
      p.tracks[0].isLocked = true;
      const res = rollEditAdjacentClips(p, 'clip_a', 'clip_b', 500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('locked');
    });
  });

  describe('Slip Edit', () => {
    it('changes clip source in/out points without changing timeline start or duration', () => {
      const p = createTestProject();
      // clip_a has sourceStartMs=1000, sourceEndMs=5000, duration=4000
      // Slip by +500ms
      const res = slipClip(p, 'clip_a', 500);
      expect(res.success).toBe(true);

      const clipA = res.project.tracks[0].clips.find((c) => c.id === 'clip_a')!;
      expect(clipA.startMs).toBe(0); // Timeline position unchanged
      expect(clipA.durationMs).toBe(4000); // Duration unchanged
      expect(clipA.sourceStartMs).toBe(1500); // Slipped +500
      expect(clipA.sourceEndMs).toBe(5500); // Slipped +500
    });

    it('prevents slip edit before source beginning (sourceStartMs < 0)', () => {
      const p = createTestProject();
      // clip_b has sourceStartMs=0. Slipped by -500ms should be rejected
      const res = slipClip(p, 'clip_b', -500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('start boundary');
    });

    it('rejects slip edit on locked track', () => {
      const p = createTestProject();
      p.tracks[0].isLocked = true;
      const res = slipClip(p, 'clip_a', 500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('locked');
    });
  });

  describe('Slide Edit', () => {
    it('slides clip between neighbors while adjusting adjacent clips to preserve sequence continuity', () => {
      const p = createTestProject();
      // Slide clip_b (between clip_a and clip_c) by +1000ms:
      // clip_a (prev) extends by 1000ms
      // clip_b slides by 1000ms (startMs 4000 -> 5000, duration stays 4000)
      // clip_c (next) trims head by 1000ms (startMs 8000 -> 9000, duration 4000 -> 3000)
      const res = slideClip(p, 'clip_b', 1000);
      expect(res.success).toBe(true);

      const track = res.project.tracks[0];
      const clipA = track.clips.find((c) => c.id === 'clip_a')!;
      const clipB = track.clips.find((c) => c.id === 'clip_b')!;
      const clipC = track.clips.find((c) => c.id === 'clip_c')!;

      expect(clipA.durationMs).toBe(5000);
      expect(clipB.startMs).toBe(5000);
      expect(clipB.durationMs).toBe(4000);
      expect(clipC.startMs).toBe(9000);
      expect(clipC.durationMs).toBe(3000);

      // Sequence overall span remains 0 to 12000
      expect(clipC.startMs + clipC.durationMs).toBe(12000);
    });

    it('rejects slide edit if clip has no adjacent neighbors', () => {
      const p = createTestProject();
      const res = slideClip(p, 'clip_audio', 500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('adjacent neighbor');
    });

    it('rejects slide edit on locked track', () => {
      const p = createTestProject();
      p.tracks[0].isLocked = true;
      const res = slideClip(p, 'clip_b', 500);
      expect(res.success).toBe(false);
      expect(res.message).toContain('locked');
    });
  });
});

describe('Phase 5 — Clip Grouping', () => {
  it('groups multiple clips across tracks and assigns groupId', () => {
    const p = createTestProject();
    const res = groupClips(p, ['clip_a', 'clip_audio']);
    expect(res.success).toBe(true);
    expect(res.groupId).toBeDefined();

    const clipA = res.project.tracks[0].clips.find((c) => c.id === 'clip_a')!;
    const clipAudio = res.project.tracks[1].clips.find((c) => c.id === 'clip_audio')!;

    expect(clipA.groupId).toBe(res.groupId);
    expect(clipAudio.groupId).toBe(res.groupId);
  });

  it('rejects grouping fewer than 2 clips', () => {
    const p = createTestProject();
    const res = groupClips(p, ['clip_a']);
    expect(res.success).toBe(false);
    expect(res.message).toContain('at least 2');
  });

  it('rejects grouping if any clip is on a locked track', () => {
    const p = createTestProject();
    p.tracks[1].isLocked = true;
    const res = groupClips(p, ['clip_a', 'clip_audio']);
    expect(res.success).toBe(false);
    expect(res.message).toContain('locked');
  });

  it('ungroups grouped clips', () => {
    const p = createTestProject();
    const groupRes = groupClips(p, ['clip_a', 'clip_b']);
    expect(groupRes.success).toBe(true);

    const ungroupRes = ungroupClips(groupRes.project, ['clip_a']);
    expect(ungroupRes.success).toBe(true);

    const clipA = ungroupRes.project.tracks[0].clips.find((c) => c.id === 'clip_a')!;
    const clipB = ungroupRes.project.tracks[0].clips.find((c) => c.id === 'clip_b')!;
    expect(clipA.groupId).toBeUndefined();
    expect(clipB.groupId).toBeUndefined();
  });

  it('moves all clips in a group together preserving relative timing', () => {
    const p = createTestProject();
    const groupRes = groupClips(p, ['clip_a', 'clip_audio']);
    const res = moveGroupClips(groupRes.project, groupRes.groupId!, 2000);
    expect(res.success).toBe(true);

    const clipA = res.project.tracks[0].clips.find((c) => c.id === 'clip_a')!;
    const clipAudio = res.project.tracks[1].clips.find((c) => c.id === 'clip_audio')!;

    expect(clipA.startMs).toBe(2000);
    expect(clipAudio.startMs).toBe(2000);
  });

  it('duplicates all clips in a group with new ids and offset', () => {
    const p = createTestProject();
    const groupRes = groupClips(p, ['clip_a', 'clip_b']);
    const res = duplicateGroupClips(groupRes.project, groupRes.groupId!);
    expect(res.success).toBe(true);
    expect(res.newClipIds).toBeDefined();
    expect(res.newClipIds!.length).toBe(2);

    expect(res.project.tracks[0].clips.length).toBe(5); // Was 3, duplicated 2
  });

  it('deletes all clips in a group together', () => {
    const p = createTestProject();
    const groupRes = groupClips(p, ['clip_a', 'clip_audio']);
    const res = deleteGroupClips(groupRes.project, groupRes.groupId!);
    expect(res.success).toBe(true);

    expect(res.project.tracks[0].clips.find((c) => c.id === 'clip_a')).toBeUndefined();
    expect(res.project.tracks[1].clips.find((c) => c.id === 'clip_audio')).toBeUndefined();
  });
});

describe('Phase 5 — Keyframe Graph Editor & Bézier Curves', () => {
  it('correctly calculates cubic Bézier easing values at boundary and intermediate times', () => {
    // Easing curve from (0,0) to (1,1) with cp1=(0.25, 0.1) and cp2=(0.25, 1.0)
    expect(evaluateCubicBezier(0, 0.25, 0.1, 0.25, 1.0)).toBeCloseTo(0, 4);
    expect(evaluateCubicBezier(1, 0.25, 0.1, 0.25, 1.0)).toBeCloseTo(1, 4);

    const mid = evaluateCubicBezier(0.5, 0.25, 0.1, 0.25, 1.0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('evaluates easing with bezier handles in evaluateEasing', () => {
    const handles = { cp1x: 0.42, cp1y: 0, cp2x: 0.58, cp2y: 1.0 };
    const val = evaluateEasing(0.5, 'bezier', handles);
    expect(val).toBeCloseTo(0.5, 2);
  });

  it('interpolates keyframes with bezier curves between property values', () => {
    const kfs: Keyframe[] = [
      {
        id: 'kf1',
        offsetMs: 0,
        properties: { opacity: 0.0, scale: 1.0 },
        easing: 'bezier',
        bezierHandles: { cp1x: 0.4, cp1y: 0.0, cp2x: 0.2, cp2y: 1.0 },
      },
      {
        id: 'kf2',
        offsetMs: 1000,
        properties: { opacity: 1.0, scale: 2.0 },
        easing: 'linear',
      },
    ];

    const baseTransform = { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
    const valAt0 = interpolateKeyframes(baseTransform, 1.0, kfs, 0);
    const valAt500 = interpolateKeyframes(baseTransform, 1.0, kfs, 500);
    const valAt1000 = interpolateKeyframes(baseTransform, 1.0, kfs, 1000);

    expect(valAt0.opacity).toBe(0.0);
    expect(valAt1000.opacity).toBe(1.0);
    expect(valAt500.opacity).toBeGreaterThan(0.0);
    expect(valAt500.opacity).toBeLessThan(1.0);
  });
});

describe('Phase 5 — Track Controls & Lock Enforcement', () => {
  it('toggles track lock, mute, visibility, and solo', () => {
    let p = createTestProject();
    const trackId = p.tracks[0].id;

    p = toggleTrackLock(p, trackId);
    expect(p.tracks[0].isLocked).toBe(true);

    p = toggleTrackMute(p, trackId);
    expect(p.tracks[0].isMuted).toBe(true);

    p = toggleTrackVisibility(p, trackId);
    expect(p.tracks[0].isHidden).toBe(true);

    p = toggleTrackSolo(p, trackId);
    expect(p.tracks[0].isSolo).toBe(true);
  });

  it('prevents split on a locked track', () => {
    const p = createTestProject();
    p.tracks[0].isLocked = true;
    const res = splitClipWithFeedback(p, 'clip_a', 2000, 30);
    expect(res.success).toBe(false);
    expect(res.message).toContain('locked');
  });

  it('prevents trim on a locked track', () => {
    const p = createTestProject();
    p.tracks[0].isLocked = true;
    const updated = trimClipBoundary(p, 'clip_a', 'right', -500);
    // Clip duration should remain untouched
    expect(updated.tracks[0].clips.find((c) => c.id === 'clip_a')!.durationMs).toBe(4000);
  });

  it('prevents move on a locked track', () => {
    const p = createTestProject();
    p.tracks[0].isLocked = true;
    const updated = moveClip(p, 'clip_a', p.tracks[0].id, 1000);
    expect(updated.tracks[0].clips.find((c) => c.id === 'clip_a')!.startMs).toBe(0);
  });

  it('prevents delete on a locked track', () => {
    const p = createTestProject();
    p.tracks[0].isLocked = true;
    const updated = deleteClip(p, 'clip_a');
    expect(updated.tracks[0].clips.find((c) => c.id === 'clip_a')).toBeDefined();
  });

  it('prevents duplicate on a locked track', () => {
    const p = createTestProject();
    p.tracks[0].isLocked = true;
    const updated = duplicateClip(p, 'clip_a');
    expect(updated.tracks[0].clips.length).toBe(3); // No new clip added
  });
});

describe('Phase 5 — Undo/Redo & Project Serialization Compatibility', () => {
  it('integrates with HistoryManager for undo/redo of trim operations', () => {
    const history = new HistoryManager(10);
    let p = createTestProject();

    history.push(p, 'Initial State');
    const trimRes = rippleTrimClip(p, 'clip_a', 'right', -1000);
    p = trimRes.project;
    expect(p.tracks[0].clips.find((c) => c.id === 'clip_a')!.durationMs).toBe(3000);

    // Undo
    const undoRes = history.undo(p);
    expect(undoRes).toBeDefined();
    p = undoRes!.project;
    expect(p.tracks[0].clips.find((c) => c.id === 'clip_a')!.durationMs).toBe(4000);

    // Redo
    const redoRes = history.redo(p);
    expect(redoRes).toBeDefined();
    p = redoRes!.project;
    expect(p.tracks[0].clips.find((c) => c.id === 'clip_a')!.durationMs).toBe(3000);
  });

  it('serializes and deserializes projects preserving Phase 5 fields and legacy projects', () => {
    const p = createTestProject();
    p.tracks[0].isHidden = true;
    p.tracks[0].isSolo = false;
    p.tracks[0].clips[0].groupId = 'test_group_123';
    p.tracks[0].clips[0].keyframes = [
      {
        id: 'kf1',
        offsetMs: 0,
        properties: { opacity: 1 },
        easing: 'bezier',
        bezierHandles: { cp1x: 0.25, cp1y: 0.1, cp2x: 0.25, cp2y: 1.0 },
      },
    ];

    const json = JSON.stringify(p);
    const deserialized: Project = JSON.parse(json);

    expect(deserialized.tracks[0].isHidden).toBe(true);
    expect(deserialized.tracks[0].clips[0].groupId).toBe('test_group_123');
    expect(deserialized.tracks[0].clips[0].keyframes[0].easing).toBe('bezier');
    expect(deserialized.tracks[0].clips[0].keyframes[0].bezierHandles?.cp1x).toBe(0.25);
  });
});
