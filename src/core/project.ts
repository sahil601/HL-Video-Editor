import { AspectRatio, Clip, Project, ProjectSettings, Track } from '../types/project';
import { formatTimecode } from './time';

export function getResolutionForAspectRatio(ratio: AspectRatio): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '21:9':
      return { width: 2560, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}

export function createDefaultProject(name: string = 'Untitled Project', aspectRatio: AspectRatio = '16:9'): Project {
  const res = getResolutionForAspectRatio(aspectRatio);
  const now = new Date().toISOString();
  const projectId = 'proj_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

  const defaultSettings: ProjectSettings = {
    width: res.width,
    height: res.height,
    fps: 30,
    aspectRatio,
    sampleRate: 48000,
    backgroundColor: '#000000',
  };

  const tracks: Track[] = [
    {
      id: 'track_text_1',
      type: 'text',
      name: 'Text & Titles',
      order: 0,
      isMuted: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track_overlay_1',
      type: 'overlay',
      name: 'PIP & Overlays',
      order: 1,
      isMuted: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track_video_main',
      type: 'video',
      name: 'Main Video Track',
      order: 2,
      isMuted: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track_audio_1',
      type: 'audio',
      name: 'Audio & Music',
      order: 3,
      isMuted: false,
      isLocked: false,
      clips: [],
    },
  ];

  return {
    schemaVersion: '1.0.0',
    generator: 'HL Video Editor 1.0.0',
    id: projectId,
    name,
    createdAt: now,
    updatedAt: now,
    settings: defaultSettings,
    assets: [],
    tracks,
    durationMs: 0,
  };
}

/**
 * Calculates project duration based on the furthest ending clip across all tracks
 */
export function calculateProjectDuration(tracks: Track[]): number {
  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startMs + clip.durationMs;
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd;
      }
    }
  }
  return maxEnd;
}

/**
 * Validates a project manifest
 */
export function validateProjectManifest(raw: unknown): { isValid: boolean; errors: string[]; project?: Project } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['Manifest must be a JSON object'] };
  }

  const p = raw as Partial<Project>;

  if (p.schemaVersion !== '1.0.0') {
    errors.push(`Unsupported or missing schemaVersion: ${p.schemaVersion}`);
  }
  if (!p.id || typeof p.id !== 'string') {
    errors.push('Missing project ID');
  }
  if (!p.name || typeof p.name !== 'string') {
    errors.push('Missing project name');
  }
  if (!p.settings || typeof p.settings !== 'object') {
    errors.push('Missing or invalid project settings');
  } else {
    if (!p.settings.width || p.settings.width <= 0) errors.push('Invalid project width');
    if (!p.settings.height || p.settings.height <= 0) errors.push('Invalid project height');
    if (!p.settings.fps || p.settings.fps <= 0) errors.push('Invalid project fps');
  }

  if (!Array.isArray(p.tracks)) {
    errors.push('Missing tracks array');
  } else {
    for (const track of p.tracks) {
      if (!track.id || !track.type) {
        errors.push(`Invalid track definition: ${JSON.stringify(track)}`);
      }
      if (Array.isArray(track.clips)) {
        for (const clip of track.clips) {
          if (!clip.id || typeof clip.startMs !== 'number' || typeof clip.durationMs !== 'number') {
            errors.push(`Invalid clip in track ${track.id}: ${clip.id}`);
          }
          if (clip.durationMs <= 0) {
            errors.push(`Clip ${clip.id} has invalid non-positive duration: ${clip.durationMs}`);
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    project: errors.length === 0 ? (p as Project) : undefined,
  };
}

/**
 * Splits a clip at cutTimeMs into two distinct clips, returning rich feedback
 */
export function splitClipWithFeedback(
  project: Project,
  clipId: string | null,
  cutTimeMs: number,
  fps: number = 30
): {
  success: boolean;
  project: Project;
  message: string;
  newClipId?: string;
  originalClipName?: string;
  splitTimeMs?: number;
} {
  if (!clipId) {
    return {
      success: false,
      project,
      message: 'Cannot split: No clip is selected. Click a clip on the timeline first.',
    };
  }

  // Find target clip and track
  let targetClip: Clip | null = null;
  let targetTrack: Track | null = null;
  for (const track of project.tracks) {
    const c = track.clips.find((item) => item.id === clipId);
    if (c) {
      targetClip = c;
      targetTrack = track;
      break;
    }
  }

  if (!targetClip || !targetTrack) {
    return {
      success: false,
      project,
      message: 'Cannot split: Selected clip could not be found on any timeline track.',
    };
  }

  if (targetTrack.isLocked) {
    return {
      success: false,
      project,
      message: `Cannot split: Track "${targetTrack.name}" is locked. Unlock track to edit.`,
    };
  }


  const clipStart = targetClip.startMs;
  const clipEnd = targetClip.startMs + targetClip.durationMs;

  if (cutTimeMs <= clipStart) {
    return {
      success: false,
      project,
      message: `Cannot split: Playhead (${formatTimecode(cutTimeMs, fps)}) is before clip start (${formatTimecode(clipStart, fps)}).`,
    };
  }

  if (cutTimeMs >= clipEnd) {
    return {
      success: false,
      project,
      message: `Cannot split: Playhead (${formatTimecode(cutTimeMs, fps)}) is after clip end (${formatTimecode(clipEnd, fps)}).`,
    };
  }

  if (cutTimeMs <= clipStart + 50) {
    return {
      success: false,
      project,
      message: 'Cannot split: Playhead must be at least 50ms inside the clip start boundary.',
    };
  }

  if (cutTimeMs >= clipEnd - 50) {
    return {
      success: false,
      project,
      message: 'Cannot split: Playhead must be at least 50ms before the clip end boundary.',
    };
  }

  let generatedNewClipId = '';
  const newTracks = project.tracks.map((track) => {
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    const duration1 = cutTimeMs - clip.startMs;
    const duration2 = clip.durationMs - duration1;

    const sourceDuration1 = Math.round(duration1 * clip.speed);
    const newSourceSplit = clip.sourceStartMs + sourceDuration1;

    const clipA: Clip = {
      ...clip,
      id: clip.id, // keeps first half
      name: clip.name,
      durationMs: duration1,
      sourceEndMs: newSourceSplit,
      keyframes: clip.keyframes.filter((kf) => kf.offsetMs < duration1),
    };

    generatedNewClipId = 'clip_' + Math.random().toString(36).substring(2, 10);
    const clipBName = clip.name.includes('(Part ')
      ? clip.name.replace(/\(Part \d+\)/, '(Part 2)')
      : `${clip.name} (Part 2)`;

    const clipB: Clip = {
      ...clip,
      id: generatedNewClipId,
      name: clipBName,
      startMs: cutTimeMs,
      durationMs: duration2,
      sourceStartMs: newSourceSplit,
      sourceEndMs: clip.sourceEndMs,
      keyframes: clip.keyframes
        .filter((kf) => kf.offsetMs >= duration1)
        .map((kf) => ({
          ...kf,
          id: 'kf_' + Math.random().toString(36).substring(2, 8),
          offsetMs: kf.offsetMs - duration1,
        })),
    };

    const updatedClips = [...track.clips];
    updatedClips.splice(clipIndex, 1, clipA, clipB);

    return {
      ...track,
      clips: updatedClips,
    };
  });

  const updatedProject: Project = {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: newTracks,
    durationMs: calculateProjectDuration(newTracks),
  };

  return {
    success: true,
    project: updatedProject,
    message: `Clip split successfully into 2 clips at ${formatTimecode(cutTimeMs, fps)}.`,
    newClipId: generatedNewClipId,
    originalClipName: targetClip.name,
    splitTimeMs: cutTimeMs,
  };
}

/**
 * Splits a clip at cutTimeMs into two distinct clips
 */
export function splitClipAtTime(project: Project, clipId: string, cutTimeMs: number): Project {
  return splitClipWithFeedback(project, clipId, cutTimeMs).project;
}


/**
 * Trims a clip's start or end boundary
 */
export function trimClipBoundary(
  project: Project,
  clipId: string,
  side: 'left' | 'right',
  deltaMs: number,
  minDurationMs: number = 100
): Project {
  const targetTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  if (!targetTrack || targetTrack.isLocked) return project;

  let modified = false;

  const newTracks = project.tracks.map((track) => {
    if (track.id !== targetTrack.id) return track;
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    let newStart = clip.startMs;
    let newDuration = clip.durationMs;
    let newSourceStart = clip.sourceStartMs;
    let newSourceEnd = clip.sourceEndMs;

    if (side === 'left') {
      // Dragging left handle: deltaMs > 0 means trimming inward (shortening clip)
      const proposedStart = clip.startMs + deltaMs;
      const proposedDuration = clip.durationMs - deltaMs;
      const proposedSourceStart = clip.sourceStartMs + Math.round(deltaMs * clip.speed);

      if (proposedDuration >= minDurationMs && proposedSourceStart < clip.sourceEndMs && proposedSourceStart >= 0) {
        newStart = proposedStart;
        newDuration = proposedDuration;
        newSourceStart = proposedSourceStart;
        modified = true;
      }
    } else {
      // Dragging right handle: deltaMs > 0 means extending, deltaMs < 0 means shortening
      const proposedDuration = clip.durationMs + deltaMs;
      const proposedSourceEnd = clip.sourceStartMs + Math.round(proposedDuration * clip.speed);

      if (proposedDuration >= minDurationMs) {
        newDuration = proposedDuration;
        newSourceEnd = proposedSourceEnd;
        modified = true;
      }
    }

    if (!modified) return track;

    const updatedClip: Clip = {
      ...clip,
      startMs: Math.max(0, newStart),
      durationMs: newDuration,
      sourceStartMs: Math.max(0, newSourceStart),
      sourceEndMs: newSourceEnd,
    };

    const updatedClips = [...track.clips];
    updatedClips[clipIndex] = updatedClip;

    return {
      ...track,
      clips: updatedClips,
    };
  });

  if (!modified) return project;

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: newTracks,
    durationMs: calculateProjectDuration(newTracks),
  };
}

/**
 * Moves a clip to a new start time and optionally a new track
 */
export function moveClip(
  project: Project,
  clipId: string,
  targetTrackId: string,
  newStartMs: number
): Project {
  const safeStart = Math.max(0, Math.round(newStartMs));
  let sourceClip: Clip | null = null;
  let sourceTrack: Track | null = null;

  // Find clip and source track
  for (const track of project.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      sourceClip = found;
      sourceTrack = track;
      break;
    }
  }

  if (!sourceClip || !sourceTrack) return project;
  if (sourceTrack.isLocked) return project; // Locked source track

  const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
  if (!targetTrack || targetTrack.isLocked) return project; // Locked target track

  // Validate track compatibility (cannot move audio to video track, etc.)
  if (sourceClip.type === 'audio' && targetTrack.type !== 'audio') return project;
  if (sourceClip.type !== 'audio' && targetTrack.type === 'audio') return project;

  const updatedTracks = project.tracks.map((track) => {
    // Remove from source track
    const filteredClips = track.clips.filter((c) => c.id !== clipId);

    // If this is the target track, insert updated clip
    if (track.id === targetTrackId) {
      const movedClip: Clip = {
        ...sourceClip!,
        trackId: targetTrackId,
        startMs: safeStart,
      };
      return {
        ...track,
        clips: [...filteredClips, movedClip].sort((a, b) => a.startMs - b.startMs),
      };
    }

    return {
      ...track,
      clips: filteredClips,
    };
  });

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
    durationMs: calculateProjectDuration(updatedTracks),
  };
}

/**
 * Deletes a clip from project
 */
export function deleteClip(project: Project, clipId: string): Project {
  const clipTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  if (clipTrack && clipTrack.isLocked) return project; // Prevent deleting from locked track

  const newTracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: newTracks,
    durationMs: calculateProjectDuration(newTracks),
  };
}

/**
 * Duplicates a clip directly adjacent to the original
 */
export function duplicateClip(project: Project, clipId: string): Project {
  const clipTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  if (clipTrack && clipTrack.isLocked) return project; // Prevent duplicating on locked track

  const newTracks = project.tracks.map((track) => {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index === -1) return track;

    const original = track.clips[index];
    const newClip: Clip = {
      ...JSON.parse(JSON.stringify(original)),
      id: 'clip_' + Math.random().toString(36).substring(2, 10),
      name: `${original.name} (Copy)`,
      startMs: original.startMs + original.durationMs,
    };


    const clips = [...track.clips];
    clips.splice(index + 1, 0, newClip);
    return {
      ...track,
      clips: clips.sort((a, b) => a.startMs - b.startMs),
    };
  });

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: newTracks,
    durationMs: calculateProjectDuration(newTracks),
  };
}

/**
 * Inserts a freeze frame still block into a clip at the current playhead
 */
export function freezeFrameClip(
  project: Project,
  clipId: string,
  playheadMs: number,
  freezeDurationMs = 3000
): { project: Project; freezeClipId: string } | null {
  let targetTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  if (!targetTrack) return null;

  const clip = targetTrack.clips.find((c) => c.id === clipId);
  if (!clip) return null;

  // Verify playhead is within clip bounds
  if (playheadMs <= clip.startMs || playheadMs >= clip.startMs + clip.durationMs) {
    return null;
  }

  const offsetInClipMs = playheadMs - clip.startMs;
  const sourceFrameMs = clip.sourceStartMs + Math.round(offsetInClipMs * clip.speed);

  // Split into Part 1, Freeze Frame (durationMs), and Part 2
  const part1: Clip = {
    ...JSON.parse(JSON.stringify(clip)),
    id: clip.id,
    durationMs: offsetInClipMs,
    sourceEndMs: sourceFrameMs,
  };

  const freezeClipId = 'clip_freeze_' + Math.random().toString(36).substring(2, 9);
  const freezeClip: Clip = {
    ...JSON.parse(JSON.stringify(clip)),
    id: freezeClipId,
    name: `${clip.name} [Freeze]`,
    startMs: playheadMs,
    durationMs: freezeDurationMs,
    sourceStartMs: sourceFrameMs,
    sourceEndMs: sourceFrameMs + 50,
    speed: 1,
    volume: 0,
    isFrozen: true,
    freezeFrameSourceMs: sourceFrameMs,
  };

  const part2DurationMs = clip.durationMs - offsetInClipMs;
  const part2: Clip = {
    ...JSON.parse(JSON.stringify(clip)),
    id: 'clip_' + Math.random().toString(36).substring(2, 10),
    name: `${clip.name} (Part 2)`,
    startMs: playheadMs + freezeDurationMs,
    durationMs: part2DurationMs,
    sourceStartMs: sourceFrameMs,
    sourceEndMs: clip.sourceEndMs,
  };

  const newTracks = project.tracks.map((track) => {
    if (track.id !== targetTrack!.id) return track;

    const remainingClips = track.clips
      .filter((c) => c.id !== clipId)
      .map((c) => {
        // Shift any subsequent clips on this track forward by freezeDurationMs
        if (c.startMs >= playheadMs) {
          return { ...c, startMs: c.startMs + freezeDurationMs };
        }
        return c;
      });

    return {
      ...track,
      clips: [...remainingClips, part1, freezeClip, part2].sort((a, b) => a.startMs - b.startMs),
    };
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: newTracks,
      durationMs: calculateProjectDuration(newTracks),
    },
    freezeClipId,
  };
}

/**
 * Extracts embedded audio from a video/overlay clip onto an audio track
 */
export function extractAudioFromClip(
  project: Project,
  clipId: string
): { project: Project; audioClipId: string } | null {
  let sourceTrack = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  if (!sourceTrack) return null;

  const clip = sourceTrack.clips.find((c) => c.id === clipId);
  if (!clip || !clip.assetId) return null;

  // Find or target the primary audio track
  let audioTrack = project.tracks.find((t) => t.type === 'audio');
  if (!audioTrack) return null;

  const audioClipId = 'clip_audio_' + Math.random().toString(36).substring(2, 9);
  const newAudioClip: Clip = {
    id: audioClipId,
    trackId: audioTrack.id,
    assetId: clip.assetId,
    name: `${clip.name} (Extracted Audio)`,
    type: 'audio',
    startMs: clip.startMs,
    durationMs: clip.durationMs,
    sourceStartMs: clip.sourceStartMs,
    sourceEndMs: clip.sourceEndMs,
    speed: clip.speed,
    volume: clip.volume > 0 ? clip.volume : 1.0,
    fadeInMs: clip.fadeInMs,
    fadeOutMs: clip.fadeOutMs,
    transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: [],
  };

  const newTracks = project.tracks.map((track) => {
    // Mute the source video clip
    if (track.id === sourceTrack!.id) {
      return {
        ...track,
        clips: track.clips.map((c) => (c.id === clipId ? { ...c, volume: 0 } : c)),
      };
    }
    // Add the extracted audio clip onto the audio track
    if (track.id === audioTrack!.id) {
      return {
        ...track,
        clips: [...track.clips, newAudioClip].sort((a, b) => a.startMs - b.startMs),
      };
    }
    return track;
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: newTracks,
      durationMs: calculateProjectDuration(newTracks),
    },
    audioClipId,
  };
}
