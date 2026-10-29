import { Project, Track, TrackType } from '../types/project';
import { calculateProjectDuration } from './project';

/**
 * Toggles the lock status of a track.
 */
export function toggleTrackLock(project: Project, trackId: string): Project {
  const updatedTracks = project.tracks.map((t) =>
    t.id === trackId ? { ...t, isLocked: !t.isLocked } : t
  );
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Toggles audio muting for a track.
 */
export function toggleTrackMute(project: Project, trackId: string): Project {
  const updatedTracks = project.tracks.map((t) =>
    t.id === trackId ? { ...t, isMuted: !t.isMuted } : t
  );
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Toggles video/visual visibility for a track (hide/show in preview & export).
 */
export function toggleTrackVisibility(project: Project, trackId: string): Project {
  const updatedTracks = project.tracks.map((t) =>
    t.id === trackId ? { ...t, isHidden: !t.isHidden } : t
  );
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Toggles solo mode for a track.
 */
export function toggleTrackSolo(project: Project, trackId: string): Project {
  const target = project.tracks.find((t) => t.id === trackId);
  const nowSolo = !target?.isSolo;

  const updatedTracks = project.tracks.map((t) => {
    if (t.id === trackId) {
      return { ...t, isSolo: nowSolo };
    }
    // If turning on solo, other tracks of same domain might be un-soloed or left
    return t;
  });

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Renames a track.
 */
export function renameTrack(project: Project, trackId: string, newName: string): Project {
  const trimmed = newName.trim();
  if (!trimmed) return project;

  const updatedTracks = project.tracks.map((t) =>
    t.id === trackId ? { ...t, name: trimmed } : t
  );
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Adds a new track to the project.
 */
export function addTrack(project: Project, type: TrackType, customName?: string): Project {
  const existingSameType = project.tracks.filter((t) => t.type === type).length;
  const defaultNames: Record<TrackType, string> = {
    video: `Video Track ${existingSameType + 1}`,
    overlay: `Overlay Track ${existingSameType + 1}`,
    audio: `Audio Track ${existingSameType + 1}`,
    text: `Text Track ${existingSameType + 1}`,
  };

  const name = customName || defaultNames[type];
  const newTrack: Track = {
    id: `track_${type}_${Date.now().toString(36)}`,
    type,
    name,
    order: project.tracks.length,
    isMuted: false,
    isLocked: false,
    isHidden: false,
    clips: [],
  };

  const updatedTracks = [...project.tracks, newTrack];
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: updatedTracks,
  };
}

/**
 * Deletes an empty or unlocked track.
 */
export function deleteTrack(
  project: Project,
  trackId: string
): { project: Project; success: boolean; message: string } {
  const target = project.tracks.find((t) => t.id === trackId);
  if (!target) {
    return { project, success: false, message: 'Track not found.' };
  }

  if (target.isLocked) {
    return { project, success: false, message: `Cannot delete locked track "${target.name}".` };
  }

  // Prevent deleting if it's the last track of its kind
  const sameTypeCount = project.tracks.filter((t) => t.type === target.type).length;
  if (sameTypeCount <= 1) {
    return {
      project,
      success: false,
      message: `Cannot delete: Project must contain at least one ${target.type} track.`,
    };
  }

  const updatedTracks = project.tracks
    .filter((t) => t.id !== trackId)
    .map((t, idx) => ({ ...t, order: idx }));

  return {
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: updatedTracks,
      durationMs: calculateProjectDuration(updatedTracks),
    },
    success: true,
    message: `Deleted track "${target.name}".`,
  };
}
