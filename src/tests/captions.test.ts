import { describe, it, expect } from 'vitest';
import {
  formatSrtTimecode,
  formatVttTimecode,
  parseTimecode,
  generateSrt,
  parseSrt,
  generateVtt,
  parseVtt,
  splitCaptionSegment,
  mergeCaptionSegments,
} from '../core/captions/srtParser';
import { CaptionSegment } from '../core/captions/types';
import { formatWhisperToSegments } from '../core/captions/transcriptionFormatter';
import { createDefaultProject } from '../core/project';
import {
  applyCaptionsToProject,
  extractProjectCaptions,
  generateProjectSrt,
  generateProjectVtt,
} from '../core/captions/projectCaptions';
import { createVnestPackage, extractVnestPackage, inspectAndValidateVnestPackage } from '../core/package';


describe('Auto Captions - SRT & VTT Parsers and Generators', () => {
  it('formats SRT timecodes accurately with comma delimiter', () => {
    expect(formatSrtTimecode(0)).toBe('00:00:00,000');
    expect(formatSrtTimecode(1500)).toBe('00:00:01,500');
    expect(formatSrtTimecode(65432)).toBe('00:01:05,432');
    expect(formatSrtTimecode(3661234)).toBe('01:01:01,234');
  });

  it('formats WebVTT timecodes accurately with dot delimiter', () => {
    expect(formatVttTimecode(0)).toBe('00:00:00.000');
    expect(formatVttTimecode(1500)).toBe('00:00:01.500');
    expect(formatVttTimecode(65432)).toBe('00:01:05.432');
  });

  it('parses timecodes from strings to milliseconds', () => {
    expect(parseTimecode('00:00:01,500')).toBe(1500);
    expect(parseTimecode('00:01:05.432')).toBe(65432);
    expect(parseTimecode('01:05.432')).toBe(65432);
    expect(parseTimecode('01:01:01,234')).toBe(3661234);
  });

  it('generates standard SubRip (.srt) and parses it back faithfully', () => {
    const original: CaptionSegment[] = [
      {
        id: 'cap_1',
        startMs: 1000,
        endMs: 3500,
        text: 'Welcome to HL Video Editor with AI captions.',
      },
      {
        id: 'cap_2',
        startMs: 3600,
        endMs: 6200,
        text: 'This video demonstrates automated speech-to-text.',
      },
    ];

    const srt = generateSrt(original);
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:03,500\nWelcome to HL Video Editor with AI captions.');
    expect(srt).toContain('2\n00:00:03,600 --> 00:00:06,200\nThis video demonstrates automated speech-to-text.');

    const parsed = parseSrt(srt);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].startMs).toBe(1000);
    expect(parsed[0].endMs).toBe(3500);
    expect(parsed[0].text).toBe('Welcome to HL Video Editor with AI captions.');
    expect(parsed[1].startMs).toBe(3600);
    expect(parsed[1].endMs).toBe(6200);
    expect(parsed[1].text).toBe('This video demonstrates automated speech-to-text.');
  });

  it('generates standard WebVTT (.vtt) and parses it back faithfully', () => {
    const original: CaptionSegment[] = [
      {
        id: 'cap_1',
        startMs: 500,
        endMs: 2500,
        text: 'Subtitles synced to audio track.',
      },
    ];

    const vtt = generateVtt(original);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.500 --> 00:00:02.500');
    expect(vtt).toContain('Subtitles synced to audio track.');

    const parsed = parseVtt(vtt);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].startMs).toBe(500);
    expect(parsed[0].endMs).toBe(2500);
    expect(parsed[0].text).toBe('Subtitles synced to audio track.');
  });

  it('splits a caption segment into two with adjusted timestamps and partitioned text', () => {
    const segment: CaptionSegment = {
      id: 'cap_split_test',
      startMs: 1000,
      endMs: 5000,
      text: 'First half of sentence second half of speech',
    };

    const [part1, part2] = splitCaptionSegment(segment, 3000);
    expect(part1.startMs).toBe(1000);
    expect(part1.endMs).toBe(3000);
    expect(part2.startMs).toBe(3000);
    expect(part2.endMs).toBe(5000);
    expect(part1.text).toBeTruthy();
    expect(part2.text).toBeTruthy();
    expect(`${part1.text} ${part2.text}`).toBe(segment.text);
  });

  it('splits caption segment respecting word-level timestamps when available', () => {
    const segment: CaptionSegment = {
      id: 'cap_word_test',
      startMs: 1000,
      endMs: 3000,
      text: 'Hello world from HL',
      words: [
        { word: 'Hello', startMs: 1000, endMs: 1400 },
        { word: 'world', startMs: 1400, endMs: 1900 },
        { word: 'from', startMs: 2000, endMs: 2400 },
        { word: 'HL', startMs: 2400, endMs: 3000 },
      ],
    };

    const [part1, part2] = splitCaptionSegment(segment, 2000);
    expect(part1.text).toBe('Hello world');
    expect(part2.text).toBe('from HL');
    expect(part1.words).toHaveLength(2);
    expect(part2.words).toHaveLength(2);
  });

  it('merges two adjacent caption segments correctly', () => {
    const seg1: CaptionSegment = {
      id: 'seg_1',
      startMs: 1000,
      endMs: 2500,
      text: 'Part one of the message,',
    };
    const seg2: CaptionSegment = {
      id: 'seg_2',
      startMs: 2600,
      endMs: 4500,
      text: 'and part two continues.',
    };

    const merged = mergeCaptionSegments(seg1, seg2);
    expect(merged.startMs).toBe(1000);
    expect(merged.endMs).toBe(4500);
    expect(merged.text).toBe('Part one of the message, and part two continues.');
  });

  it('formats raw Whisper phrase chunks into CaptionSegments correctly', () => {
    const rawChunks = [
      { text: 'Hello and welcome to HL.', timestamp: [0, 2.5] as [number, number] },
      { text: 'We are editing video today.', timestamp: [2.6, 5.2] as [number, number] },
    ];
    const segments = formatWhisperToSegments(rawChunks);
    expect(segments).toHaveLength(2);
    expect(segments[0].startMs).toBe(0);
    expect(segments[0].endMs).toBe(2500);
    expect(segments[0].text).toBe('Hello and welcome to HL.');
    expect(segments[1].startMs).toBe(2600);
    expect(segments[1].endMs).toBe(5200);
    expect(segments[1].text).toBe('We are editing video today.');
  });

  it('groups word-level chunks into natural caption segments with word timing preserved', () => {
    const wordChunks = [
      { text: 'Hello', timestamp: [0, 0.5] as [number, number] },
      { text: 'and', timestamp: [0.5, 0.8] as [number, number] },
      { text: 'welcome.', timestamp: [0.8, 1.5] as [number, number] },
      { text: 'This', timestamp: [1.6, 1.9] as [number, number] },
      { text: 'is', timestamp: [1.9, 2.1] as [number, number] },
      { text: 'HL.', timestamp: [2.1, 2.8] as [number, number] },
    ];
    const segments = formatWhisperToSegments(wordChunks, { maxWordsPerSegment: 4 });
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe('Hello and welcome.');
    expect(segments[0].words).toHaveLength(3);
    expect(segments[0].startMs).toBe(0);
    expect(segments[0].endMs).toBe(1500);

    expect(segments[1].text).toBe('This is HL.');
    expect(segments[1].words).toHaveLength(3);
    expect(segments[1].startMs).toBe(1600);
    expect(segments[1].endMs).toBe(2800);
  });

  it('applies captions to project timeline and extracts them back with SRT/VTT export', () => {
    const defaultProject = createDefaultProject('Caption Test Project', '16:9');
    const segments: CaptionSegment[] = [
      {
        id: 'cap_test_1',
        startMs: 500,
        endMs: 2500,
        text: 'This is the first caption block on timeline.',
        words: [
          { word: 'This', startMs: 500, endMs: 800 },
          { word: 'is', startMs: 800, endMs: 1100 },
          { word: 'the', startMs: 1100, endMs: 1300 },
          { word: 'first', startMs: 1300, endMs: 1700 },
          { word: 'caption', startMs: 1700, endMs: 2100 },
          { word: 'block', startMs: 2100, endMs: 2500 },
        ],
      },
      {
        id: 'cap_test_2',
        startMs: 3000,
        endMs: 5500,
        text: 'Second subtitle with custom styling and highlight.',
      },
    ];

    const updated = applyCaptionsToProject(defaultProject, segments);
    const textTrack = updated.tracks.find((t) => t.type === 'text')!;
    expect(textTrack.clips).toHaveLength(2);
    expect(textTrack.clips[0].textProperties?.isCaption).toBe(true);
    expect(textTrack.clips[0].textProperties?.words).toHaveLength(6);
    expect(textTrack.clips[0].textProperties?.highlightWord).toBe(true);
    expect(updated.durationMs).toBe(5500);

    const extracted = extractProjectCaptions(updated);
    expect(extracted).toHaveLength(2);
    expect(extracted[0].text).toBe('This is the first caption block on timeline.');
    expect(extracted[1].text).toBe('Second subtitle with custom styling and highlight.');

    const srt = generateProjectSrt(updated);
    expect(srt).toContain('00:00:00,500 --> 00:00:02,500');
    expect(srt).toContain('This is the first caption block on timeline.');

    const vtt = generateProjectVtt(updated);
    expect(vtt).toContain('00:00:03.000 --> 00:00:05.500');
    expect(vtt).toContain('Second subtitle with custom styling and highlight.');
  });

  it('persists captions through .vnest package export and import without data loss', async () => {
    const project = createDefaultProject('Persisted Captions Project', '16:9');
    const segments: CaptionSegment[] = [
      {
        id: 'cap_persisted_1',
        startMs: 200,
        endMs: 2200,
        text: 'Automated subtitles stay intact across machines.',
        words: [
          { word: 'Automated', startMs: 200, endMs: 700 },
          { word: 'subtitles', startMs: 700, endMs: 1200 },
          { word: 'stay', startMs: 1200, endMs: 1500 },
          { word: 'intact', startMs: 1500, endMs: 1800 },
          { word: 'across', startMs: 1800, endMs: 2000 },
          { word: 'machines.', startMs: 2000, endMs: 2200 },
        ],
      },
      {
        id: 'cap_persisted_2',
        startMs: 2500,
        endMs: 4800,
        text: 'Karaoke word highlighting is also preserved.',
        words: [
          { word: 'Karaoke', startMs: 2500, endMs: 3000 },
          { word: 'word', startMs: 3000, endMs: 3300 },
          { word: 'highlighting', startMs: 3300, endMs: 4000 },
          { word: 'is', startMs: 4000, endMs: 4200 },
          { word: 'also', startMs: 4200, endMs: 4400 },
          { word: 'preserved.', startMs: 4400, endMs: 4800 },
        ],
      },
    ];

    const projectWithCaptions = applyCaptionsToProject(project, segments, {
      fontFamily: 'Montserrat',
      fontSize: 26,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 3,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backgroundPadding: 10,
      borderRadius: 8,
      positionY: 82,
      highlightWord: true,
      highlightColor: '#facc15',
    });

    // Package into .vnest zip buffer
    const emptyMap = new Map<string, Blob>();
    const vnestBlob = await createVnestPackage(projectWithCaptions, emptyMap);
    expect(vnestBlob.size).toBeGreaterThan(0);
    const vnestBuffer = await vnestBlob.arrayBuffer();

    // Validate the package structure
    const validation = await inspectAndValidateVnestPackage(vnestBuffer);
    expect(validation.isValid).toBe(true);

    // Extract the project from .vnest
    const { project: extractedProject } = await extractVnestPackage(vnestBuffer);
    const textTrack = extractedProject.tracks.find((t) => t.type === 'text')!;
    expect(textTrack.clips).toHaveLength(2);

    const clip1 = textTrack.clips[0];
    expect(clip1.textProperties?.text).toBe('Automated subtitles stay intact across machines.');
    expect(clip1.textProperties?.isCaption).toBe(true);
    expect(clip1.textProperties?.fontFamily).toBe('Montserrat');
    expect(clip1.textProperties?.fontSize).toBe(26);
    expect(clip1.textProperties?.strokeColor).toBe('#000000');
    expect(clip1.textProperties?.strokeWidth).toBe(3);
    expect(clip1.textProperties?.backgroundColor).toBe('rgba(0, 0, 0, 0.75)');
    expect(clip1.textProperties?.highlightWord).toBe(true);
    expect(clip1.textProperties?.highlightColor).toBe('#facc15');
    expect(clip1.textProperties?.words).toHaveLength(6);
    expect(clip1.textProperties?.words?.[0].word).toBe('Automated');

    const clip2 = textTrack.clips[1];
    expect(clip2.textProperties?.text).toBe('Karaoke word highlighting is also preserved.');
    expect(clip2.textProperties?.words).toHaveLength(6);

    // Ensure extracted captions match original segments
    const extractedSegments = extractProjectCaptions(extractedProject);
    expect(extractedSegments).toHaveLength(2);
    expect(extractedSegments[0].text).toBe(segments[0].text);
    expect(extractedSegments[1].text).toBe(segments[1].text);
  });
});


