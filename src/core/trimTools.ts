import { Project, Clip, Track } from '../types/project';
import { calculateProjectDuration } from './project';

export interface TrimResult {
  project: Project;
  success: boolean;
  message: string;
  deltaAppliedMs: number;
}

/**
 * Ripple edit: trims a clip's in-point or out-point and automatically
 * shifts all subsequent clips on the track to close or adjust the timeline gap.
 */
export function rippleTrimClip(
  project: Project,
  clipId: string,
  side: 'left' | 'right',
  deltaMs: number,
  options: { minDurationMs?: number } = {}
): TrimResult {
  const minDuration = options.minDurationMs ?? 100;

  // Find track and clip
  let targetTrack: Track | null = null;
  let targetClip: Clip | null = null;
  for (const track of project.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      targetTrack = track;
      targetClip = found;
      break;
    }
  }

  if (!targetTrack || !targetClip) {
    return {
      project,
      success: false,
      message: 'Cannot ripple edit: Clip not found.',
      deltaAppliedMs: 0,
    };
  }

  if (targetTrack.isLocked) {
    return {
      project,
      success: false,
      message: `Cannot ripple edit: Track "${targetTrack.name}" is locked.`,
      deltaAppliedMs: 0,
    };
  }

  const asset = targetClip.assetId
    ? project.assets.find((a) => a.id === targetClip!.assetId)
    : undefined;

  let newDuration = targetClip.durationMs;
  let newSourceStart = targetClip.sourceStartMs;
  let newSourceEnd = targetClip.sourceEndMs;
  let timelineShiftMs = 0; // Shift applied to all subsequent clips

  if (side === 'right') {
    // Trimming out-point: deltaMs > 0 extends, deltaMs < 0 contracts
    const proposedDuration = targetClip.durationMs + deltaMs;
    const proposedSourceEnd =
      targetClip.sourceStartMs + Math.round(proposedDuration * targetClip.speed);

    if (proposedDuration < minDuration) {
      return {
        project,
        success: false,
        message: `Cannot ripple edit: Clip duration cannot be less than ${minDuration}ms.`,
        deltaAppliedMs: 0,
      };
    }

    if (asset && asset.durationMs && proposedSourceEnd > asset.durationMs) {
      return {
        project,
        success: false,
        message: `Cannot ripple edit: Exceeds source media duration (${asset.durationMs}ms).`,
        deltaAppliedMs: 0,
      };
    }

    newDuration = proposedDuration;
    newSourceEnd = proposedSourceEnd;
    timelineShiftMs = deltaMs;
  } else {
    // Trimming in-point (side === 'left'):
    // deltaMs > 0 trims inward (shortens head), deltaMs < 0 extends outward
    const proposedDuration = targetClip.durationMs - deltaMs;
    const sourceDelta = Math.round(deltaMs * targetClip.speed);
    const proposedSourceStart = targetClip.sourceStartMs + sourceDelta;

    if (proposedDuration < minDuration) {
      return {
        project,
        success: false,
        message: `Cannot ripple edit: Clip duration cannot be less than ${minDuration}ms.`,
        deltaAppliedMs: 0,
      };
    }

    if (proposedSourceStart < 0) {
      return {
        project,
        success: false,
        message: 'Cannot ripple edit: Cannot extend beyond start of source media (0s).',
        deltaAppliedMs: 0,
      };
    }

    if (proposedSourceStart >= targetClip.sourceEndMs) {
      return {
        project,
        success: false,
        message: 'Cannot ripple edit: In-point cannot exceed out-point.',
        deltaAppliedMs: 0,
      };
    }

    newDuration = proposedDuration;
    newSourceStart = proposedSourceStart;
    // When trimming head inward (deltaMs > 0), subsequent clips shift backward by deltaMs to close gap
    timelineShiftMs = -deltaMs;
  }

  // Update tracks
  const updatedTracks = project.tracks.map((track) => {
    if (track.id !== targetTrack!.id) return track;

    const originalEndMs = targetClip!.startMs + targetClip!.durationMs;
    const updatedClips = track.clips.map((c) => {
      if (c.id === clipId) {
        return {
          ...c,
          durationMs: newDuration,
          sourceStartMs: newSourceStart,
          sourceEndMs: newSourceEnd,
          keyframes: c.keyframes.filter((kf) => kf.offsetMs < newDuration),
        };
      }

      // Ripple shift: shift clips that start after the trimmed clip's original end
      if (c.startMs >= originalEndMs - 10) {
        return {
          ...c,
          startMs: Math.max(0, c.startMs + timelineShiftMs),
        };
      }

      return c;
    });

    return {
      ...track,
      clips: updatedClips.sort((a, b) => a.startMs - b.startMs),
    };
  });

  const updatedProject: Project = {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
    durationMs: calculateProjectDuration(updatedTracks),
  };

  return {
    project: updatedProject,
    success: true,
    message: `Ripple edit applied: shifted subsequent clips by ${timelineShiftMs >= 0 ? '+' : ''}${timelineShiftMs}ms.`,
    deltaAppliedMs: timelineShiftMs,
  };
}

/**
 * Roll edit: adjusts the cut point between two adjacent clips on the same track
 * while strictly preserving the overall sequence duration.
 */
export function rollEditAdjacentClips(
  project: Project,
  clipIdA: string,
  clipIdB: string,
  deltaMs: number,
  options: { minDurationMs?: number } = {}
): TrimResult {
  const minDuration = options.minDurationMs ?? 100;

  let targetTrack: Track | null = null;
  let clipA: Clip | null = null;
  let clipB: Clip | null = null;

  for (const track of project.tracks) {
    const a = track.clips.find((c) => c.id === clipIdA);
    const b = track.clips.find((c) => c.id === clipIdB);
    if (a && b) {
      targetTrack = track;
      clipA = a;
      clipB = b;
      break;
    }
  }

  if (!targetTrack || !clipA || !clipB) {
    return {
      project,
      success: false,
      message: 'Cannot roll edit: Both clips must be on the same track.',
      deltaAppliedMs: 0,
    };
  }

  if (targetTrack.isLocked) {
    return {
      project,
      success: false,
      message: `Cannot roll edit: Track "${targetTrack.name}" is locked.`,
      deltaAppliedMs: 0,
    };
  }

  // Ensure clipA precedes clipB
  if (clipA.startMs > clipB.startMs) {
    const temp = clipA;
    clipA = clipB;
    clipB = temp;
    deltaMs = -deltaMs;
  }

  // Verify adjacency
  const editPointA = clipA.startMs + clipA.durationMs;
  if (Math.abs(editPointA - clipB.startMs) > 25) {
    return {
      project,
      success: false,
      message: 'Cannot roll edit: Selected clips are not immediately adjacent.',
      deltaAppliedMs: 0,
    };
  }

  const proposedDurationA = clipA.durationMs + deltaMs;
  const proposedDurationB = clipB.durationMs - deltaMs;

  if (proposedDurationA < minDuration || proposedDurationB < minDuration) {
    return {
      project,
      success: false,
      message: `Cannot roll edit: Neither clip may have a duration below ${minDuration}ms.`,
      deltaAppliedMs: 0,
    };
  }

  const assetA = clipA.assetId ? project.assets.find((a) => a.id === clipA!.assetId) : undefined;
  const assetB = clipB.assetId ? project.assets.find((a) => a.id === clipB!.assetId) : undefined;

  const proposedSourceEndA = clipA.sourceStartMs + Math.round(proposedDurationA * clipA.speed);
  const sourceShiftB = Math.round(deltaMs * clipB.speed);
  const proposedSourceStartB = clipB.sourceStartMs + sourceShiftB;

  if (assetA && assetA.durationMs && proposedSourceEndA > assetA.durationMs) {
    return {
      project,
      success: false,
      message: `Cannot roll edit: Clip "${clipA.name}" exceeds source duration limit.`,
      deltaAppliedMs: 0,
    };
  }

  if (proposedSourceStartB < 0) {
    return {
      project,
      success: false,
      message: `Cannot roll edit: Clip "${clipB.name}" in-point cannot be before media start (0s).`,
      deltaAppliedMs: 0,
    };
  }

  const updatedClips = targetTrack.clips.map((c) => {
    if (c.id === clipA!.id) {
      return {
        ...c,
        durationMs: proposedDurationA,
        sourceEndMs: proposedSourceEndA,
        keyframes: c.keyframes.filter((kf) => kf.offsetMs < proposedDurationA),
      };
    }
    if (c.id === clipB!.id) {
      return {
        ...c,
        startMs: clipA!.startMs + proposedDurationA,
        durationMs: proposedDurationB,
        sourceStartMs: proposedSourceStartB,
        keyframes: c.keyframes
          .filter((kf) => kf.offsetMs >= deltaMs)
          .map((kf) => ({ ...kf, offsetMs: kf.offsetMs - deltaMs })),
      };
    }
    return c;
  });

  const updatedTracks = project.tracks.map((t) =>
    t.id === targetTrack!.id ? { ...t, clips: updatedClips.sort((x, y) => x.startMs - y.startMs) } : t
  );

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
      durationMs: calculateProjectDuration(updatedTracks),
    },
    success: true,
    message: `Roll edit completed: shifted edit point by ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms. Sequence duration preserved.`,
    deltaAppliedMs: deltaMs,
  };
}

/**
 * Slip edit: changes a clip's source in/out points without moving its timeline position
 * or changing its duration.
 */
export function slipClip(
  project: Project,
  clipId: string,
  deltaMs: number
): TrimResult {
  let targetTrack: Track | null = null;
  let targetClip: Clip | null = null;

  for (const track of project.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      targetTrack = track;
      targetClip = found;
      break;
    }
  }

  if (!targetTrack || !targetClip) {
    return {
      project,
      success: false,
      message: 'Cannot slip edit: Clip not found.',
      deltaAppliedMs: 0,
    };
  }

  if (targetTrack.isLocked) {
    return {
      project,
      success: false,
      message: `Cannot slip edit: Track "${targetTrack.name}" is locked.`,
      deltaAppliedMs: 0,
    };
  }

  const asset = targetClip.assetId ? project.assets.find((a) => a.id === targetClip!.assetId) : undefined;
  const sourceDelta = Math.round(deltaMs * targetClip.speed);
  const proposedSourceStart = targetClip.sourceStartMs + sourceDelta;
  const proposedSourceEnd = targetClip.sourceEndMs + sourceDelta;

  if (proposedSourceStart < 0) {
    return {
      project,
      success: false,
      message: 'Cannot slip edit: Media start boundary reached (0s).',
      deltaAppliedMs: 0,
    };
  }

  if (asset && asset.durationMs && proposedSourceEnd > asset.durationMs) {
    return {
      project,
      success: false,
      message: `Cannot slip edit: Media end boundary reached (${asset.durationMs}ms).`,
      deltaAppliedMs: 0,
    };
  }

  const updatedTracks = project.tracks.map((t) => {
    if (t.id !== targetTrack!.id) return t;
    return {
      ...t,
      clips: t.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              sourceStartMs: proposedSourceStart,
              sourceEndMs: proposedSourceEnd,
            }
          : c
      ),
    };
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
      durationMs: calculateProjectDuration(updatedTracks),
    },
    success: true,
    message: `Slip edit applied: slipped source media by ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms (timeline position & duration preserved).`,
    deltaAppliedMs: deltaMs,
  };
}

/**
 * Slide edit: moves a clip along the timeline while adjusting its adjacent neighbors
 * to preserve sequence continuity and overall timeline duration.
 */
export function slideClip(
  project: Project,
  clipId: string,
  deltaMs: number,
  options: { minDurationMs?: number } = {}
): TrimResult {
  const minDuration = options.minDurationMs ?? 100;

  let targetTrack: Track | null = null;
  let targetClip: Clip | null = null;
  let clipIndex = -1;

  for (const track of project.tracks) {
    const idx = track.clips.findIndex((c) => c.id === clipId);
    if (idx !== -1) {
      targetTrack = track;
      targetClip = track.clips[idx];
      clipIndex = idx;
      break;
    }
  }

  if (!targetTrack || !targetClip) {
    return {
      project,
      success: false,
      message: 'Cannot slide edit: Clip not found.',
      deltaAppliedMs: 0,
    };
  }

  if (targetTrack.isLocked) {
    return {
      project,
      success: false,
      message: `Cannot slide edit: Track "${targetTrack.name}" is locked.`,
      deltaAppliedMs: 0,
    };
  }

  const sortedClips = [...targetTrack.clips].sort((a, b) => a.startMs - b.startMs);
  const curIdx = sortedClips.findIndex((c) => c.id === clipId);

  const prevClip = curIdx > 0 ? sortedClips[curIdx - 1] : null;
  const nextClip = curIdx < sortedClips.length - 1 ? sortedClips[curIdx + 1] : null;

  const hasAdjacentPrev = !!(prevClip && Math.abs((prevClip.startMs + prevClip.durationMs) - targetClip.startMs) <= 25);
  const hasAdjacentNext = !!(nextClip && Math.abs((targetClip.startMs + targetClip.durationMs) - nextClip.startMs) <= 25);

  if (!hasAdjacentPrev && !hasAdjacentNext) {
    return {
      project,
      success: false,
      message: 'Cannot slide edit: Clip must have at least one adjacent neighbor on the timeline.',
      deltaAppliedMs: 0,
    };
  }

  const proposedStart = targetClip.startMs + deltaMs;
  if (proposedStart < 0) {
    return {
      project,
      success: false,
      message: 'Cannot slide edit: Timeline start boundary reached (0s).',
      deltaAppliedMs: 0,
    };
  }

  // Validate previous neighbor
  if (hasAdjacentPrev && prevClip) {
    const proposedPrevDuration = prevClip.durationMs + deltaMs;
    if (proposedPrevDuration < minDuration) {
      return {
        project,
        success: false,
        message: `Cannot slide edit: Previous clip "${prevClip.name}" would shrink below ${minDuration}ms.`,
        deltaAppliedMs: 0,
      };
    }
    const prevAsset = prevClip.assetId ? project.assets.find((a) => a.id === prevClip.assetId) : undefined;
    const proposedPrevSourceEnd = prevClip.sourceStartMs + Math.round(proposedPrevDuration * prevClip.speed);
    if (prevAsset && prevAsset.durationMs && proposedPrevSourceEnd > prevAsset.durationMs) {
      return {
        project,
        success: false,
        message: `Cannot slide edit: Previous clip "${prevClip.name}" exceeds source media duration.`,
        deltaAppliedMs: 0,
      };
    }
  }

  // Validate next neighbor
  if (nextClip && Math.abs((targetClip.startMs + targetClip.durationMs) - nextClip.startMs) <= 25) {
    const proposedNextDuration = nextClip.durationMs - deltaMs;
    if (proposedNextDuration < minDuration) {
      return {
        project,
        success: false,
        message: `Cannot slide edit: Next clip "${nextClip.name}" would shrink below ${minDuration}ms.`,
        deltaAppliedMs: 0,
      };
    }
    const nextSourceDelta = Math.round(deltaMs * nextClip.speed);
    const proposedNextSourceStart = nextClip.sourceStartMs + nextSourceDelta;
    if (proposedNextSourceStart < 0) {
      return {
        project,
        success: false,
        message: `Cannot slide edit: Next clip "${nextClip.name}" source start cannot be before 0s.`,
        deltaAppliedMs: 0,
      };
    }
  }

  const updatedClips = sortedClips.map((c, i) => {
    if (c.id === clipId) {
      return {
        ...c,
        startMs: proposedStart,
      };
    }
    // Update previous adjacent clip
    if (prevClip && c.id === prevClip.id && Math.abs((prevClip.startMs + prevClip.durationMs) - targetClip!.startMs) <= 25) {
      const newPrevDur = prevClip.durationMs + deltaMs;
      return {
        ...c,
        durationMs: newPrevDur,
        sourceEndMs: prevClip.sourceStartMs + Math.round(newPrevDur * prevClip.speed),
      };
    }
    // Update next adjacent clip
    if (nextClip && c.id === nextClip.id && Math.abs((targetClip!.startMs + targetClip!.durationMs) - nextClip.startMs) <= 25) {
      const newNextDur = nextClip.durationMs - deltaMs;
      const nextShift = Math.round(deltaMs * nextClip.speed);
      return {
        ...c,
        startMs: nextClip.startMs + deltaMs,
        durationMs: newNextDur,
        sourceStartMs: nextClip.sourceStartMs + nextShift,
      };
    }
    return c;
  });

  const updatedTracks = project.tracks.map((t) =>
    t.id === targetTrack!.id ? { ...t, clips: updatedClips.sort((a, b) => a.startMs - b.startMs) } : t
  );

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
      durationMs: calculateProjectDuration(updatedTracks),
    },
    success: true,
    message: `Slide edit applied: moved clip by ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms (neighboring clips adjusted).`,
    deltaAppliedMs: deltaMs,
  };
}
