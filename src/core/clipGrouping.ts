import { Project, Clip } from '../types/project';
import { calculateProjectDuration } from './project';

export interface GroupOperationResult {
  project: Project;
  success: boolean;
  message: string;
  groupId?: string;
  affectedCount: number;
  newClipIds?: string[];
}

/**
 * Groups multiple clips across tracks so they move, duplicate, and delete together.
 */
export function groupClips(project: Project, clipIds: string[]): GroupOperationResult {
  const uniqueIds = Array.from(new Set(clipIds));
  if (uniqueIds.length < 2) {
    return {
      project,
      success: false,
      message: 'Select at least 2 clips to create a group.',
      affectedCount: 0,
    };
  }

  // Check if any track containing a target clip is locked
  for (const track of project.tracks) {
    if (track.isLocked && track.clips.some((c) => uniqueIds.includes(c.id))) {
      return {
        project,
        success: false,
        message: `Cannot group clips: Track "${track.name}" is locked.`,
        affectedCount: 0,
      };
    }
  }

  const groupId = 'group_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  let count = 0;

  const updatedTracks = project.tracks.map((track) => {
    const updatedClips = track.clips.map((c) => {
      if (uniqueIds.includes(c.id)) {
        count++;
        return { ...c, groupId };
      }
      return c;
    });
    return { ...track, clips: updatedClips };
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
    },
    success: true,
    message: `Grouped ${count} clips together.`,
    groupId,
    affectedCount: count,
  };
}

/**
 * Removes group association from specified clips or an entire group.
 */
export function ungroupClips(project: Project, clipIdsOrGroupId: string[] | string): GroupOperationResult {
  const targetGroupIds = new Set<string>();
  const explicitClipIds = new Set<string>();

  if (typeof clipIdsOrGroupId === 'string') {
    if (clipIdsOrGroupId.startsWith('group_')) {
      targetGroupIds.add(clipIdsOrGroupId);
    } else {
      explicitClipIds.add(clipIdsOrGroupId);
    }
  } else {
    for (const id of clipIdsOrGroupId) {
      if (id.startsWith('group_')) {
        targetGroupIds.add(id);
      } else {
        explicitClipIds.add(id);
      }
    }
  }

  // Find all groupIds associated with the explicit clip IDs
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (explicitClipIds.has(clip.id) && clip.groupId) {
        targetGroupIds.add(clip.groupId);
      }
    }
  }

  // Check if any track with affected clips is locked
  for (const track of project.tracks) {
    if (track.isLocked && track.clips.some((c) => (c.groupId && targetGroupIds.has(c.groupId)) || explicitClipIds.has(c.id))) {
      return {
        project,
        success: false,
        message: `Cannot ungroup clips: Track "${track.name}" is locked.`,
        affectedCount: 0,
      };
    }
  }

  let count = 0;
  const updatedTracks = project.tracks.map((track) => {
    const updatedClips = track.clips.map((c) => {
      const isTargeted = (c.groupId && targetGroupIds.has(c.groupId)) || explicitClipIds.has(c.id);
      if (isTargeted && c.groupId) {
        count++;
        const { groupId, ...rest } = c;
        return rest as Clip;
      }
      return c;
    });
    return { ...track, clips: updatedClips };
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
    },
    success: true,
    message: count > 0 ? `Ungrouped ${count} clips.` : 'No grouped clips found.',
    affectedCount: count,
  };
}

/**
 * Moves all clips belonging to a group by deltaMs, preserving relative timing across tracks.
 */
export function moveGroupClips(project: Project, groupId: string, deltaMs: number): GroupOperationResult {
  // Collect all grouped clips
  const groupedClips: Clip[] = [];
  const trackIdsWithGroup = new Set<string>();

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.groupId === groupId) {
        if (track.isLocked) {
          return {
            project,
            success: false,
            message: `Cannot move group: Track "${track.name}" is locked.`,
            affectedCount: 0,
          };
        }
        groupedClips.push(clip);
        trackIdsWithGroup.add(track.id);
      }
    }
  }

  if (groupedClips.length === 0) {
    return {
      project,
      success: false,
      message: 'No clips found in group.',
      affectedCount: 0,
    };
  }

  // Prevent moving group before 0ms
  const minStart = Math.min(...groupedClips.map((c) => c.startMs));
  const safeDelta = minStart + deltaMs < 0 ? -minStart : deltaMs;

  const updatedTracks = project.tracks.map((track) => {
    if (!trackIdsWithGroup.has(track.id)) return track;

    const updatedClips = track.clips.map((c) => {
      if (c.groupId === groupId) {
        return {
          ...c,
          startMs: Math.max(0, c.startMs + safeDelta),
        };
      }
      return c;
    });

    return {
      ...track,
      clips: updatedClips.sort((a, b) => a.startMs - b.startMs),
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
    message: `Moved group of ${groupedClips.length} clips by ${safeDelta >= 0 ? '+' : ''}${safeDelta}ms.`,
    affectedCount: groupedClips.length,
    groupId,
  };
}

/**
 * Duplicates all clips in a group, offsets them directly after the group, and creates a new group.
 */
export function duplicateGroupClips(project: Project, groupId: string): GroupOperationResult {
  const groupedClips: Clip[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.groupId === groupId) {
        if (track.isLocked) {
          return {
            project,
            success: false,
            message: `Cannot duplicate group: Track "${track.name}" is locked.`,
            affectedCount: 0,
          };
        }
        groupedClips.push(clip);
      }
    }
  }

  if (groupedClips.length === 0) {
    return {
      project,
      success: false,
      message: 'Group not found for duplication.',
      affectedCount: 0,
    };
  }

  const minStart = Math.min(...groupedClips.map((c) => c.startMs));
  const maxEnd = Math.max(...groupedClips.map((c) => c.startMs + c.durationMs));
  const spanMs = maxEnd - minStart;
  const newGroupId = 'group_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  const createdClipIds: string[] = [];

  const updatedTracks = project.tracks.map((track) => {
    const clipsToDuplicate = track.clips.filter((c) => c.groupId === groupId);
    if (clipsToDuplicate.length === 0) return track;

    const newClips = clipsToDuplicate.map((orig) => {
      const copy: Clip = JSON.parse(JSON.stringify(orig));
      copy.id = 'clip_' + Math.random().toString(36).substring(2, 10);
      copy.name = `${orig.name} (Copy)`;
      copy.startMs = orig.startMs + spanMs;
      copy.groupId = newGroupId;
      createdClipIds.push(copy.id);
      return copy;
    });

    return {
      ...track,
      clips: [...track.clips, ...newClips].sort((a, b) => a.startMs - b.startMs),
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
    message: `Duplicated group (${groupedClips.length} clips).`,
    groupId: newGroupId,
    affectedCount: groupedClips.length,
    newClipIds: createdClipIds,
  };
}

/**
 * Deletes all clips belonging to a group.
 */
export function deleteGroupClips(project: Project, groupId: string): GroupOperationResult {
  let count = 0;
  for (const track of project.tracks) {
    if (track.isLocked && track.clips.some((c) => c.groupId === groupId)) {
      return {
        project,
        success: false,
        message: `Cannot delete group: Track "${track.name}" is locked.`,
        affectedCount: 0,
      };
    }
  }

  const updatedTracks = project.tracks.map((track) => {
    const remaining = track.clips.filter((c) => {
      if (c.groupId === groupId) {
        count++;
        return false;
      }
      return true;
    });
    return { ...track, clips: remaining };
  });

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
      durationMs: calculateProjectDuration(updatedTracks),
    },
    success: true,
    message: `Deleted group of ${count} clips.`,
    affectedCount: count,
  };
}
