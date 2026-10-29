import { Project, Clip, ProposedCut, AutoCutSettings, AspectRatio } from '../types/project';
import { calculateProjectDuration } from './project';

export const DEFAULT_AUTO_CUT_SETTINGS: AutoCutSettings = {
  sensitivity: 0.3,
  minSceneDurationMs: 1000,
  silenceThresholdDb: -30,
  minSilenceDurationMs: 500,
  speechPaddingBeforeMs: 200,
  speechPaddingAfterMs: 200,
  targetDurationSec: 'all',
};

export interface SilenceInterval {
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface SceneChange {
  timeMs: number;
}

export interface AutoCutCalculationResult {
  proposedCuts: ProposedCut[];
  originalDurationMs: number;
  projectedDurationMs: number;
  timeSavedMs: number;
  percentSaved: number;
  sceneCount: number;
  silenceCount: number;
}

/**
 * Parses raw FFmpeg silencedetect stderr output into structured silence intervals
 */
export function parseSilenceOutput(stderr: string): SilenceInterval[] {
  const silences: SilenceInterval[] = [];
  const lines = stderr.split(/\r?\n/);
  let currentStartSec: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (startMatch) {
      currentStartSec = parseFloat(startMatch[1]);
    }

    const endMatch = line.match(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\|\s*silence_duration:\s*([0-9]+(?:\.[0-9]+)?))?/);
    if (endMatch) {
      const endSec = parseFloat(endMatch[1]);
      const startSec = currentStartSec !== null ? currentStartSec : Math.max(0, endSec - (parseFloat(endMatch[2]) || 0));
      const durSec = endMatch[2] ? parseFloat(endMatch[2]) : Math.max(0, endSec - startSec);

      silences.push({
        startMs: Math.round(startSec * 1000),
        endMs: Math.round(endSec * 1000),
        durationMs: Math.round(durSec * 1000),
      });
      currentStartSec = null;
    }
  }

  return silences;
}

/**
 * Parses raw FFmpeg showinfo stderr output into structured scene change timestamps
 */
export function parseSceneOutput(stderr: string, minSceneDurationMs = 800): SceneChange[] {
  const sceneChanges: SceneChange[] = [];
  const lines = stderr.split(/\r?\n/);
  let lastTimeMs = -1;

  for (const line of lines) {
    if (!line.includes('showinfo')) continue;
    const match = line.match(/pts_time:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      const timeMs = Math.round(parseFloat(match[1]) * 1000);
      if (lastTimeMs < 0 || timeMs - lastTimeMs >= minSceneDurationMs) {
        sceneChanges.push({ timeMs });
        lastTimeMs = timeMs;
      }
    }
  }

  return sceneChanges;
}

/**
 * Inverts silence intervals to extract speech/activity intervals with customizable padding
 */
export function invertSilenceToSpeech(
  totalDurationMs: number,
  silences: SilenceInterval[],
  paddingBeforeMs = 200,
  paddingAfterMs = 200,
  minSpeechDurationMs = 150
): Array<{ startMs: number; endMs: number }> {
  if (totalDurationMs <= 0) return [];
  if (silences.length === 0) {
    return [{ startMs: 0, endMs: totalDurationMs }];
  }

  // Sort silences chronologically
  const sorted = [...silences].sort((a, b) => a.startMs - b.startMs);
  const speechSegments: Array<{ startMs: number; endMs: number }> = [];

  let pointerMs = 0;

  for (const s of sorted) {
    const rawSpeechStart = pointerMs;
    const rawSpeechEnd = Math.max(pointerMs, s.startMs);

    if (rawSpeechEnd > rawSpeechStart) {
      // Apply speech padding: expand start backward into previous silence and end forward into current silence
      const paddedStart = Math.max(0, rawSpeechStart - (rawSpeechStart > 0 ? paddingBeforeMs : 0));
      const paddedEnd = Math.min(totalDurationMs, rawSpeechEnd + paddingAfterMs);

      if (paddedEnd - paddedStart >= minSpeechDurationMs) {
        speechSegments.push({ startMs: paddedStart, endMs: paddedEnd });
      }
    }

    pointerMs = s.endMs;
  }

  // Trailing speech segment after final silence
  if (pointerMs < totalDurationMs) {
    const trailingStart = Math.max(0, pointerMs - paddingBeforeMs);
    const trailingEnd = totalDurationMs;
    if (trailingEnd - trailingStart >= minSpeechDurationMs) {
      speechSegments.push({ startMs: trailingStart, endMs: trailingEnd });
    }
  }

  // Merge overlapping or close adjacent segments (gap < 200ms)
  if (speechSegments.length <= 1) return speechSegments;

  const merged: Array<{ startMs: number; endMs: number }> = [speechSegments[0]];
  for (let i = 1; i < speechSegments.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = speechSegments[i];

    if (curr.startMs <= prev.endMs + 200) {
      prev.endMs = Math.max(prev.endMs, curr.endMs);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Computes rule-based proposed cuts from silence intervals and scene changes
 */
export function computeAutoCuts(
  clipDurationMs: number,
  silences: SilenceInterval[],
  sceneChanges: SceneChange[],
  settings: AutoCutSettings = DEFAULT_AUTO_CUT_SETTINGS
): AutoCutCalculationResult {
  const totalMs = Math.max(0, clipDurationMs);
  if (totalMs === 0) {
    return {
      proposedCuts: [],
      originalDurationMs: 0,
      projectedDurationMs: 0,
      timeSavedMs: 0,
      percentSaved: 0,
      sceneCount: 0,
      silenceCount: 0,
    };
  }

  const paddingBefore = settings.speechPaddingBeforeMs ?? 200;
  const paddingAfter = settings.speechPaddingAfterMs ?? 200;

  // 1. Calculate active speech segments
  let rawSegments = invertSilenceToSpeech(totalMs, silences, paddingBefore, paddingAfter, 150);

  // If no speech segments found (entire media is silence or error), keep full clip as fallback
  if (rawSegments.length === 0) {
    rawSegments = [{ startMs: 0, endMs: totalMs }];
  }

  // 2. Snap boundaries to scene changes if nearby (within 350ms)
  const sceneTimes = sceneChanges.map((sc) => sc.timeMs);
  const snappedSegments = rawSegments.map((seg) => {
    let s = seg.startMs;
    let e = seg.endMs;

    for (const scTime of sceneTimes) {
      if (Math.abs(scTime - s) <= 350) {
        s = scTime;
      }
      if (Math.abs(scTime - e) <= 350) {
        e = scTime;
      }
    }

    return {
      startMs: Math.max(0, s),
      endMs: Math.min(totalMs, Math.max(s + 150, e)),
    };
  });

  // 3. Construct proposed cuts
  let proposed: ProposedCut[] = snappedSegments
    .filter((seg) => seg.endMs - seg.startMs >= 150) // Zero-length protection (>150ms)
    .map((seg, idx) => {
      const dur = seg.endMs - seg.startMs;
      const nearScene = sceneTimes.some((t) => t >= seg.startMs - 200 && t <= seg.endMs + 200);

      return {
        id: `cut_${idx + 1}_${seg.startMs}_${seg.endMs}`,
        startMs: seg.startMs,
        endMs: seg.endMs,
        durationMs: dur,
        sourceStartMs: seg.startMs,
        sourceEndMs: seg.endMs,
        type: nearScene ? 'scene_change' : 'speech',
        confidence: nearScene ? 0.95 : 0.85,
        included: true,
        reason: nearScene ? 'Active speech aligned with scene transition' : 'Active speech segment',
      };
    });

  // 4. Target duration budget optimization for short-form video (15s, 30s, 60s)
  if (
    settings.targetDurationSec &&
    settings.targetDurationSec !== 'all' &&
    typeof settings.targetDurationSec === 'number'
  ) {
    const budgetMs = settings.targetDurationSec * 1000;
    let currentKeptMs = proposed.reduce((acc, c) => acc + c.durationMs, 0);

    if (currentKeptMs > budgetMs) {
      // Prioritize longest speech segments and segments aligned with scene changes
      const scored = proposed.map((p, index) => ({
        cut: p,
        index,
        score: p.durationMs * (p.type === 'scene_change' ? 1.3 : 1.0),
      }));

      // Sort by score descending to pick top highlights
      scored.sort((a, b) => b.score - a.score);

      let allocatedMs = 0;
      const includedIndices = new Set<number>();

      for (const item of scored) {
        if (allocatedMs + item.cut.durationMs <= budgetMs * 1.08) {
          includedIndices.add(item.index);
          allocatedMs += item.cut.durationMs;
        }
      }

      // If budget is still empty, include at least the top segment
      if (includedIndices.size === 0 && scored.length > 0) {
        includedIndices.add(scored[0].index);
      }

      proposed = proposed.map((p, idx) => ({
        ...p,
        included: includedIndices.has(idx),
        reason: includedIndices.has(idx)
          ? `${p.reason} (selected for ${settings.targetDurationSec}s target)`
          : `Excluded to fit ${settings.targetDurationSec}s target duration`,
      }));
    }
  }

  const projectedDurationMs = proposed.filter((c) => c.included).reduce((acc, c) => acc + c.durationMs, 0);
  const timeSavedMs = Math.max(0, totalMs - projectedDurationMs);
  const percentSaved = totalMs > 0 ? Math.round((timeSavedMs / totalMs) * 100) : 0;

  return {
    proposedCuts: proposed,
    originalDurationMs: totalMs,
    projectedDurationMs,
    timeSavedMs,
    percentSaved,
    sceneCount: sceneChanges.length,
    silenceCount: silences.length,
  };
}

/**
 * Applies approved cuts to the timeline, slicing the target clip safely without touching original media
 */
export function applyAutoCutsToTimeline(
  project: Project,
  targetClipId: string,
  approvedCuts: ProposedCut[],
  aspectRatioPreset?: AspectRatio
): Project {
  const activeCuts = approvedCuts.filter((c) => c.included && c.durationMs >= 150);
  if (activeCuts.length === 0) return project;

  // Find target clip and its track
  let foundClip: Clip | null = null;
  let targetTrackId: string | null = null;

  for (const track of project.tracks) {
    const c = track.clips.find((item) => item.id === targetClipId);
    if (c) {
      foundClip = c;
      targetTrackId = track.id;
      break;
    }
  }

  if (!foundClip || !targetTrackId) return project;

  const originalStartMs = foundClip.startMs;
  let currentOffsetMs = originalStartMs;

  const newClips: Clip[] = activeCuts.map((cut, idx) => {
    const slicedDurationMs = cut.durationMs;
    const sourceIn = foundClip!.sourceStartMs + cut.startMs;
    const sourceOut = sourceIn + slicedDurationMs;

    const childClip: Clip = {
      ...foundClip!,
      id: `autocut_${foundClip!.id}_${idx + 1}_${Date.now()}`,
      name: `${foundClip!.name} [Part ${idx + 1}]`,
      startMs: currentOffsetMs,
      durationMs: slicedDurationMs,
      sourceStartMs: sourceIn,
      sourceEndMs: sourceOut,
      // Clear transitions on sub-cuts to maintain clean flow
      transition: undefined,
    };

    currentOffsetMs += slicedDurationMs;
    return childClip;
  });

  const deltaDurationMs = (currentOffsetMs - originalStartMs) - foundClip.durationMs;

  // Update tracks immutably
  const updatedTracks = project.tracks.map((track) => {
    if (track.id !== targetTrackId) {
      // Shift downstream clips on other tracks if needed
      if (deltaDurationMs !== 0) {
        return {
          ...track,
          clips: track.clips.map((c) => {
            if (c.startMs >= originalStartMs + foundClip!.durationMs) {
              return { ...c, startMs: Math.max(0, c.startMs + deltaDurationMs) };
            }
            return c;
          }),
        };
      }
      return track;
    }

    // On target track: replace targetClip with new sliced clips and shift downstream clips
    const newTrackClips: Clip[] = [];
    for (const c of track.clips) {
      if (c.id === targetClipId) {
        newTrackClips.push(...newClips);
      } else if (c.startMs >= originalStartMs + foundClip!.durationMs) {
        newTrackClips.push({
          ...c,
          startMs: Math.max(0, c.startMs + deltaDurationMs),
        });
      } else {
        newTrackClips.push(c);
      }
    }

    return {
      ...track,
      clips: newTrackClips.sort((a, b) => a.startMs - b.startMs),
    };
  });

  // Aspect ratio preset adjustment if requested
  let updatedSettings = { ...project.settings };
  if (aspectRatioPreset) {
    let w = 1920;
    let h = 1080;
    if (aspectRatioPreset === '9:16') {
      w = 1080;
      h = 1920;
    } else if (aspectRatioPreset === '1:1') {
      w = 1080;
      h = 1080;
    } else if (aspectRatioPreset === '4:5') {
      w = 1080;
      h = 1350;
    } else if (aspectRatioPreset === '21:9') {
      w = 2560;
      h = 1080;
    }
    updatedSettings = {
      ...project.settings,
      aspectRatio: aspectRatioPreset,
      width: w,
      height: h,
    };
  }

  const updatedProject: Project = {
    ...project,
    settings: updatedSettings,
    tracks: updatedTracks,
    durationMs: calculateProjectDuration(updatedTracks),
    updatedAt: new Date().toISOString(),
  };

  return updatedProject;
}
