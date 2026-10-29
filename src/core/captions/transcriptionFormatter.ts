import { CaptionSegment, CaptionWord } from './types';

export interface RawWhisperChunk {
  text: string;
  timestamp: [number, number];
}

/**
 * Formats raw Whisper output chunks into well-timed, readable CaptionSegments
 * supporting both word-level timestamps and phrase-level timestamps.
 */
export function formatWhisperToSegments(
  chunks: RawWhisperChunk[],
  options?: {
    maxWordsPerSegment?: number;
    maxDurationMs?: number;
  }
): CaptionSegment[] {
  if (!chunks || chunks.length === 0) return [];

  const maxWords = options?.maxWordsPerSegment ?? 7;
  const maxDurationMs = options?.maxDurationMs ?? 3500;

  // Detect whether chunks are single words or full phrases
  const isWordLevel = chunks.every((c) => c.text.trim().split(/\s+/).length <= 2);

  if (!isWordLevel) {
    // Phrase-level chunks
    return chunks
      .filter((c) => c.text && c.text.trim().length > 0)
      .map((c, idx) => {
        const startMs = Math.max(0, Math.round(c.timestamp[0] * 1000));
        const endMs = Math.max(startMs + 300, Math.round(c.timestamp[1] * 1000));
        return {
          id: `cap_seg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          startMs,
          endMs,
          text: c.text.trim(),
        };
      });
  }

  // Word-level chunks: Group into natural, readable subtitle lines
  const segments: CaptionSegment[] = [];
  let currentWords: CaptionWord[] = [];
  let segStartMs = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const wordText = chunk.text.trim();
    if (!wordText) continue;

    const wordStart = Math.max(0, Math.round(chunk.timestamp[0] * 1000));
    const wordEnd = Math.max(wordStart + 100, Math.round(chunk.timestamp[1] * 1000));

    if (currentWords.length === 0) {
      segStartMs = wordStart;
    }

    currentWords.push({
      word: wordText,
      startMs: wordStart,
      endMs: wordEnd,
    });

    const isPunctuationEnd = /[.!?]$/.test(wordText);
    const duration = wordEnd - segStartMs;
    const reachedWordLimit = currentWords.length >= maxWords;
    const reachedTimeLimit = duration >= maxDurationMs;
    const isLastWord = i === chunks.length - 1;

    if (isPunctuationEnd || reachedWordLimit || reachedTimeLimit || isLastWord) {
      const segEndMs = Math.max(segStartMs + 300, wordEnd);
      const text = currentWords.map((w) => w.word).join(' ');

      segments.push({
        id: `cap_seg_${Date.now()}_${segments.length}_${Math.random().toString(36).substring(2, 6)}`,
        startMs: segStartMs,
        endMs: segEndMs,
        text,
        words: [...currentWords],
      });

      currentWords = [];
    }
  }

  return segments;
}
