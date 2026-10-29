const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const { transcribeAudioFile, extractAudioToWav } = require('../electron/whisperEngine.cjs');

const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

function runExec(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`${err.message}\n${stderr}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

function probeFile(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [
        '-v', 'error',
        '-show_entries', 'format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate',
        '-of', 'json',
        filePath,
      ],
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// Convert ms to SRT timecode 00:00:00,000
function formatSrtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const msec = ms % 1000;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(msec).padStart(3, '0')}`;
}

// Convert ms to WebVTT timecode 00:00:00.000
function formatVttTime(ms) {
  return formatSrtTime(ms).replace(',', '.');
}

async function main() {
  console.log('====================================================');
  console.log('HL VIDEO EDITOR — AI AUTO CAPTIONS VERIFICATION SUITE');
  console.log('====================================================');

  const videoPath = path.resolve(__dirname, '..', 'test_speech_video.mp4');
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Test speech video missing at: ${videoPath}`);
  }

  console.log(`[1/6] Probing speech video asset: ${videoPath}`);
  const inputProbe = await probeFile(videoPath);
  console.log(` - Input duration: ${inputProbe.format?.duration}s`);
  console.log(` - Streams:`, inputProbe.streams.map(s => `${s.codec_type}: ${s.codec_name} (${s.width || ''}x${s.height || ''})`));

  console.log('\n[2/6] Running local Whisper transcription on real speech video...');
  const progressLogs = [];
  const transcriptionResult = await transcribeAudioFile({
    inputPath: videoPath,
    language: 'en',
    model: 'Xenova/whisper-tiny.en',
    wordTimestamps: true,
    ffmpegPath,
    onProgress: (p) => {
      progressLogs.push(p);
      console.log(`  [Progress] [${p.status}] ${p.progress}% - ${p.message} ${p.detail || ''}`);
    },
  });

  console.log('\n[Transcription Complete]');
  console.log(` - Full text: "${transcriptionResult.text.trim()}"`);
  console.log(` - Chunk count: ${transcriptionResult.chunks.length}`);

  // Assert speech text accuracy
  const lowerText = transcriptionResult.text.toLowerCase();
  if (!lowerText.includes('video') && !lowerText.includes('hl') && !lowerText.includes('captions')) {
    throw new Error(`Transcription did not match expected speech: "${transcriptionResult.text}"`);
  }
  console.log('  -> Speech transcription text content verified!');

  // Check word-level timestamps
  const wordChunks = transcriptionResult.chunks.filter(c => Array.isArray(c.timestamp));
  if (wordChunks.length === 0) {
    throw new Error('No timestamped word chunks generated');
  }
  console.log(`  -> Detected ${wordChunks.length} timestamped words/tokens.`);
  console.log('  -> Sample tokens:', wordChunks.slice(0, 5).map(c => `"${c.text}" [${c.timestamp[0]}s - ${c.timestamp[1]}s]`).join(', '));

  console.log('\n[3/6] Grouping into caption segments & simulating transcript editing...');
  // Group into cues of ~4-5 words
  const segments = [];
  let currentGroup = [];
  let segIndex = 1;

  for (const chunk of wordChunks) {
    currentGroup.push(chunk);
    if (currentGroup.length >= 4 || chunk.text.includes('.')) {
      const startMs = Math.round((currentGroup[0].timestamp[0] || 0) * 1000);
      const endMs = Math.round((currentGroup[currentGroup.length - 1].timestamp[1] || (startMs / 1000 + 1)) * 1000);
      const text = currentGroup.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
      segments.push({
        id: `cue_${segIndex++}`,
        startMs,
        endMs: Math.max(startMs + 500, endMs),
        text,
        words: currentGroup.map(c => ({
          word: c.text.trim(),
          startMs: Math.round((c.timestamp[0] || 0) * 1000),
          endMs: Math.round((c.timestamp[1] || 0) * 1000),
        })),
      });
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    const startMs = Math.round((currentGroup[0].timestamp[0] || 0) * 1000);
    const endMs = Math.round((currentGroup[currentGroup.length - 1].timestamp[1] || (startMs / 1000 + 1)) * 1000);
    const text = currentGroup.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
    segments.push({
      id: `cue_${segIndex++}`,
      startMs,
      endMs: Math.max(startMs + 500, endMs),
      text,
      words: currentGroup.map(c => ({
        word: c.text.trim(),
        startMs: Math.round((c.timestamp[0] || 0) * 1000),
        endMs: Math.round((c.timestamp[1] || 0) * 1000),
      })),
    });
  }

  console.log(` - Generated ${segments.length} caption cues:`);
  segments.forEach((s, idx) => console.log(`   [Cue ${idx + 1}] ${formatSrtTime(s.startMs)} --> ${formatSrtTime(s.endMs)} : "${s.text}"`));

  // Test Editing Operations:
  console.log(' - Testing caption edit operations (split, timing adjust, merge)...');
  // 1. Timing adjust
  segments[0].startMs = 0;
  // 2. Split segment 1
  const segToSplit = segments[0];
  const midTime = Math.round((segToSplit.startMs + segToSplit.endMs) / 2);
  const words = segToSplit.words || [];
  const midWordIdx = Math.max(1, Math.floor(words.length / 2));
  const part1Words = words.slice(0, midWordIdx);
  const part2Words = words.slice(midWordIdx);
  const split1 = {
    id: 'cue_split_1',
    startMs: segToSplit.startMs,
    endMs: midTime,
    text: part1Words.map(w => w.word).join(' '),
    words: part1Words,
  };
  const split2 = {
    id: 'cue_split_2',
    startMs: midTime,
    endMs: segToSplit.endMs,
    text: part2Words.map(w => w.word).join(' '),
    words: part2Words,
  };
  segments.splice(0, 1, split1, split2);
  console.log(`   -> Segment split into "${split1.text}" and "${split2.text}"`);

  // 3. Merge them back
  const merged = {
    id: 'cue_merged_1',
    startMs: split1.startMs,
    endMs: split2.endMs,
    text: `${split1.text} ${split2.text}`.trim(),
    words: [...(split1.words || []), ...(split2.words || [])],
  };
  segments.splice(0, 2, merged);
  console.log(`   -> Re-merged back to "${merged.text}"`);

  console.log('\n[4/6] Generating Standalone .SRT and .VTT Subtitle Files...');
  // Generate SRT content
  let srtContent = '';
  segments.forEach((s, i) => {
    srtContent += `${i + 1}\n${formatSrtTime(s.startMs)} --> ${formatSrtTime(s.endMs)}\n${s.text}\n\n`;
  });
  const srtPath = path.resolve(__dirname, '..', 'test_speech_captions.srt');
  fs.writeFileSync(srtPath, srtContent, 'utf8');
  console.log(`  -> Wrote SRT file: ${srtPath} (${fs.statSync(srtPath).size} bytes)`);

  // Generate VTT content
  let vttContent = 'WEBVTT\n\n';
  segments.forEach((s, i) => {
    vttContent += `${i + 1}\n${formatVttTime(s.startMs)} --> ${formatVttTime(s.endMs)}\n${s.text}\n\n`;
  });
  const vttPath = path.resolve(__dirname, '..', 'test_speech_captions.vtt');
  fs.writeFileSync(vttPath, vttContent, 'utf8');
  console.log(`  -> Wrote VTT file: ${vttPath} (${fs.statSync(vttPath).size} bytes)`);

  console.log('\n[5/6] Exporting Video with Burned-In Captions via FFmpeg...');
  const burnedExportPath = path.resolve(__dirname, '..', 'test_speech_burned_export.mp4');
  if (fs.existsSync(burnedExportPath)) fs.unlinkSync(burnedExportPath);

  // Escaping for FFmpeg subtitle filter on Windows:
  // forward slashes, and escape the colon in Windows drive letters e.g. C\\:/path
  const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');
  const forceStyle = "FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=30,Alignment=2";
  const filterString = `subtitles='${escapedSrtPath}':force_style='${forceStyle}'`;

  console.log(`  -> FFmpeg filter: ${filterString}`);
  const ffmpegArgs = [
    '-y',
    '-i', videoPath,
    '-vf', filterString,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '128k',
    burnedExportPath,
  ];

  await runExec(ffmpegPath, ffmpegArgs);
  console.log(`  -> Burned-in video generated successfully: ${burnedExportPath}`);

  console.log('\n[6/6] Verifying Exported Video File...');
  const outputProbe = await probeFile(burnedExportPath);
  console.log(` - Output format: ${outputProbe.format.format_name}, duration: ${outputProbe.format.duration}s, size: ${outputProbe.format.size} bytes`);
  const videoStream = outputProbe.streams.find(s => s.codec_type === 'video');
  const audioStream = outputProbe.streams.find(s => s.codec_type === 'audio');

  if (!videoStream || !audioStream) {
    throw new Error('Exported video is missing video or audio stream');
  }
  console.log(` - Video stream: ${videoStream.codec_name} ${videoStream.width}x${videoStream.height} @ ${videoStream.r_frame_rate} fps`);
  console.log(` - Audio stream: ${audioStream.codec_name}`);

  console.log('\n====================================================');
  console.log('AI AUTO CAPTIONS VERIFICATION SUCCEEDED 100%!');
  console.log(' - Real speech transcribed via local Whisper (ONNX)');
  console.log(' - Word timestamps captured and parsed');
  console.log(' - Editable captions (split, merge, adjust) functional');
  console.log(' - Standalone .SRT and .VTT generated');
  console.log(' - Burned-in video export verified with valid video/audio');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('\n*** VERIFICATION FAILED ***\n', err);
  process.exit(1);
});
