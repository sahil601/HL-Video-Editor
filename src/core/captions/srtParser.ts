import { CaptionSegment, CaptionWord } from './types';

/**
 * Formats milliseconds into standard SRT timecode: 00:00:00,000
 */
export function formatSrtTimecode(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  const msStr = String(millis).padStart(3, '0');

  return `${h}:${m}:${s},${msStr}`;
}

/**
 * Formats milliseconds into standard WebVTT timecode: 00:00:00.000
 */
export function formatVttTimecode(ms: number): string {
  return formatSrtTimecode(ms).replace(',', '.');
}

/**
 * Parses timecode string (00:01:23,456 or 00:01:23.456 or 01:23.456) to milliseconds
 */
export function parseTimecode(tc: string): number {
  const clean = tc.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  return 0;
}

/**
 * Converts CaptionSegment list to a standard SubRip (.srt) text string
 */
export function generateSrt(segments: CaptionSegment[]): string {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  return sorted
    .map((seg, idx) => {
      const start = formatSrtTimecode(seg.startMs);
      const end = formatSrtTimecode(seg.endMs);
      return `${idx + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Converts CaptionSegment list to standard WebVTT (.vtt) text string
 */
export function generateVtt(segments: CaptionSegment[]): string {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const cues = sorted.map((seg, idx) => {
    const start = formatVttTimecode(seg.startMs);
    const end = formatVttTimecode(seg.endMs);
    return `${idx + 1}\n${start} --> ${end}\n${seg.text.trim()}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/**
 * Parses an SRT file string into CaptionSegment items
 */
export function parseSrt(srtContent: string): CaptionSegment[] {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const segments: CaptionSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startPart, endPart] = timeLine.split('-->').map((p) => p.trim());
    const startMs = parseTimecode(startPart);
    const endMs = parseTimecode(endPart);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

    if (text) {
      segments.push({
        id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startMs,
        endMs: Math.max(startMs + 200, endMs),
        text,
      });
    }
  }

  return segments;
}

/**
 * Parses a WebVTT file string into CaptionSegment items
 */
export function parseVtt(vttContent: string): CaptionSegment[] {
  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const segments: CaptionSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startPart, endPartRaw] = timeLine.split('-->').map((p) => p.trim());
    const endPart = endPartRaw.split(' ')[0]; // Strip cue settings like align:start

    const startMs = parseTimecode(startPart);
    const endMs = parseTimecode(endPart);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

    if (text) {
      segments.push({
        id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startMs,
        endMs: Math.max(startMs + 200, endMs),
        text,
      });
    }
  }

  return segments;
}

/**
 * Splits a caption segment at a specific timestamp or word index
 */
export function splitCaptionSegment(
  segment: CaptionSegment,
  splitMs: number,
  splitWordIndex?: number
): [CaptionSegment, CaptionSegment] {
  const duration = segment.endMs - segment.startMs;
  const clampedSplitMs = Math.max(
    segment.startMs + 100,
    Math.min(segment.endMs - 100, Math.round(splitMs))
  );

  let textPart1 = '';
  let textPart2 = '';
  let wordsPart1: CaptionWord[] | undefined;
  let wordsPart2: CaptionWord[] | undefined;

  const words = segment.text.trim().split(/\s+/);

  if (segment.words && segment.words.length > 1) {
    // Split using word timing
    const idx = segment.words.findIndex((w) => w.endMs >= clampedSplitMs);
    const cutIdx = idx >= 1 ? idx : Math.floor(segment.words.length / 2);
    wordsPart1 = segment.words.slice(0, cutIdx);
    wordsPart2 = segment.words.slice(cutIdx);
    textPart1 = wordsPart1.map((w) => w.word).join(' ');
    textPart2 = wordsPart2.map((w) => w.word).join(' ');
  } else if (splitWordIndex !== undefined && splitWordIndex > 0 && splitWordIndex < words.length) {
    textPart1 = words.slice(0, splitWordIndex).join(' ');
    textPart2 = words.slice(splitWordIndex).join(' ');
  } else {
    // Split proportionally by time
    const ratio = (clampedSplitMs - segment.startMs) / duration;
    const cutWordIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
    textPart1 = words.slice(0, cutWordIdx).join(' ');
    textPart2 = words.slice(cutWordIdx).join(' ');
  }

  const seg1: CaptionSegment = {
    id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_1`,
    startMs: segment.startMs,
    endMs: clampedSplitMs,
    text: textPart1 || segment.text,
    words: wordsPart1,
  };

  const seg2: CaptionSegment = {
    id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_2`,
    startMs: clampedSplitMs,
    endMs: segment.endMs,
    text: textPart2 || '...',
    words: wordsPart2,
  };

  return [seg1, seg2];
}

/**
 * Merges two adjacent caption segments into a single segment
 */
export function mergeCaptionSegments(
  seg1: CaptionSegment,
  seg2: CaptionSegment
): CaptionSegment {
  const first = seg1.startMs <= seg2.startMs ? seg1 : seg2;
  const second = seg1.startMs <= seg2.startMs ? seg2 : seg1;

  let mergedWords: CaptionWord[] | undefined;
  if (first.words && second.words) {
    mergedWords = [...first.words, ...second.words];
  }

  return {
    id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    startMs: first.startMs,
    endMs: Math.max(first.endMs, second.endMs),
    text: `${first.text.trim()} ${second.text.trim()}`.trim(),
    words: mergedWords,
  };
}
