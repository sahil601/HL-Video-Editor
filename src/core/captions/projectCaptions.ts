import { Clip, Project, Track } from '../../types/project';
import { CaptionSegment, CaptionStyle, DEFAULT_CAPTION_STYLE } from './types';
import { generateSrt, generateVtt } from './srtParser';

/**
 * Extracts caption and text clips from a project into CaptionSegment list
 */
export function extractProjectCaptions(project: Project): CaptionSegment[] {
  const textTracks = project.tracks.filter((t) => t.type === 'text' && !t.isMuted);
  const segments: CaptionSegment[] = [];

  for (const track of textTracks) {
    for (const clip of track.clips) {
      if (clip.textProperties?.text) {
        segments.push({
          id: clip.id,
          startMs: clip.startMs,
          endMs: clip.startMs + clip.durationMs,
          text: clip.textProperties.text,
          words: clip.textProperties.words,
        });
      }
    }
  }

  return segments.sort((a, b) => a.startMs - b.startMs);
}

/**
 * Inserts or updates caption segments on the project's text track
 */
export function applyCaptionsToProject(
  project: Project,
  segments: CaptionSegment[],
  style: Partial<CaptionStyle> = DEFAULT_CAPTION_STYLE,
  replaceExisting: boolean = true
): Project {
  const resolvedStyle: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, ...style };

  // Find or create text track
  let textTrack = project.tracks.find((t) => t.type === 'text');
  let updatedTracks = [...project.tracks];

  if (!textTrack) {
    textTrack = {
      id: 'track_text_1',
      type: 'text',
      name: 'Text & Captions',
      order: 0,
      isMuted: false,
      isLocked: false,
      clips: [],
    };
    updatedTracks.unshift(textTrack);
  }

  const newClips: Clip[] = segments.map((seg, idx) => {
    const durationMs = Math.max(200, seg.endMs - seg.startMs);
    return {
      id: seg.id || `cap_clip_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      trackId: textTrack!.id,
      name: seg.text.length > 24 ? seg.text.substring(0, 24) + '...' : seg.text,
      type: 'text',
      startMs: seg.startMs,
      durationMs,
      sourceStartMs: 0,
      sourceEndMs: durationMs,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: {
        positionX: resolvedStyle.positionX ?? 0,
        positionY: resolvedStyle.positionY ?? 35, // default bottom position
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
      },
      keyframes: [],
      textProperties: {
        text: seg.text,
        fontFamily: resolvedStyle.fontFamily,
        fontSize: resolvedStyle.fontSize,
        color: resolvedStyle.color,
        strokeColor: resolvedStyle.strokeColor,
        strokeWidth: resolvedStyle.strokeWidth,
        backgroundColor: resolvedStyle.backgroundColor,
        backgroundPadding: resolvedStyle.backgroundPadding,
        borderRadius: resolvedStyle.borderRadius,
        textAlign: resolvedStyle.textAlign,
        isCaption: true,
        highlightWord: resolvedStyle.highlightWord,
        highlightColor: resolvedStyle.highlightColor,
        words: seg.words,
      },
    };
  });

  const finalTracks = updatedTracks.map((t) => {
    if (t.id === textTrack!.id) {
      return {
        ...t,
        clips: replaceExisting ? newClips : [...t.clips, ...newClips],
      };
    }
    return t;
  });

  // Calculate new project duration
  let maxEnd = project.durationMs;
  for (const t of finalTracks) {
    for (const c of t.clips) {
      const end = c.startMs + c.durationMs;
      if (end > maxEnd) maxEnd = end;
    }
  }

  return {
    ...project,
    tracks: finalTracks,
    durationMs: maxEnd,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generates SubRip (.srt) file content from all text/caption clips in project
 */
export function generateProjectSrt(project: Project): string {
  const segments = extractProjectCaptions(project);
  return generateSrt(segments);
}

/**
 * Generates WebVTT (.vtt) file content from all text/caption clips in project
 */
export function generateProjectVtt(project: Project): string {
  const segments = extractProjectCaptions(project);
  return generateVtt(segments);
}
