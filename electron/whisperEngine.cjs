const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Reads a 16kHz 16-bit mono WAV file from disk into a Float32Array suitable for Whisper
 */
function readWavToFloat32(filePath) {
  const buf = fs.readFileSync(filePath);
  let dataOffset = 12;
  while (dataOffset < buf.length - 8) {
    const chunkId = buf.toString('ascii', dataOffset, dataOffset + 4);
    const chunkSize = buf.readUInt32LE(dataOffset + 4);
    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  const samples = Math.floor((buf.length - dataOffset) / 2);
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float32[i] = buf.readInt16LE(dataOffset + i * 2) / 32768.0;
  }
  return float32;
}

/**
 * Formats raw Whisper output chunks into well-timed CaptionSegments
 */
function formatRawChunks(chunks, options = {}) {
  if (!chunks || chunks.length === 0) return [];
  const maxWords = options.maxWordsPerSegment || 7;
  const maxDurationMs = options.maxDurationMs || 3500;

  const isWordLevel = chunks.every((c) => c.text.trim().split(/\s+/).length <= 2);

  if (!isWordLevel) {
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

  const segments = [];
  let currentWords = [];
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

/**
 * Executes local Whisper speech-to-text inference
 */
async function transcribeAudioFile({
  inputPath,
  language = 'auto',
  model = 'Xenova/whisper-tiny.en',
  wordTimestamps = true,
  ffmpegPath,
  cacheDir,
  onProgress = () => {},
}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Media file not found: ${inputPath}`);
  }

  onProgress({
    status: 'extracting-audio',
    progress: 5,
    message: 'Extracting 16kHz audio track via FFmpeg...',
  });

  const tempWav = path.join(os.tmpdir(), `hl_stt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.wav`);

  // Convert input video/audio to 16kHz 16-bit mono PCM WAV
  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      tempWav,
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempWav)) {
        resolve();
      } else {
        reject(new Error(`Audio extraction failed with code ${code}: ${stderr.slice(-300)}`));
      }
    });
    proc.on('error', reject);
  });

  onProgress({
    status: 'downloading-model',
    progress: 15,
    message: 'Loading Whisper model (downloading on first run)...',
  });

  // Ensure bridge for onnxruntime-node
  try {
    const ort = require('onnxruntime-web');
    require.cache[require.resolve('onnxruntime-node')] = {
      id: require.resolve('onnxruntime-node'),
      filename: require.resolve('onnxruntime-node'),
      loaded: true,
      exports: ort.default || ort,
    };
  } catch (e) {
    // Continue
  }

  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = false;
  if (cacheDir) {
    env.cacheDir = cacheDir;
  }
  env.backends.onnx.wasm.numThreads = 1;

  const selectedModel = model || 'Xenova/whisper-tiny.en';

  const transcriber = await pipeline('automatic-speech-recognition', selectedModel, {
    progress_callback: (p) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const pct = Math.min(100, Math.round(p.progress));
        onProgress({
          status: 'downloading-model',
          progress: pct,
          message: `Downloading Whisper model (${pct}%)...`,
          detail: p.file || '',
        });
      } else if (p.status === 'ready' || p.status === 'done') {
        onProgress({
          status: 'downloading-model',
          progress: 100,
          message: 'Whisper model ready in memory.',
        });
      }
    },
  });

  onProgress({
    status: 'transcribing',
    progress: 50,
    message: 'Transcribing speech with AI...',
  });

  const audioFloat32 = readWavToFloat32(tempWav);
  const audioDurationSec = audioFloat32.length / 16000;

  const langParam = language && language !== 'auto' ? language.toLowerCase() : undefined;

  const inferenceOptions = {
    return_timestamps: wordTimestamps ? 'word' : true,
  };

  // Only pass language token for multilingual models (not .en models)
  if (langParam && !selectedModel.endsWith('.en')) {
    inferenceOptions.language = langParam;
  }

  // Only apply chunking/stride on audio longer than 30s to prevent empty short-form outputs
  if (audioDurationSec > 30) {
    inferenceOptions.chunk_length_s = 30;
    inferenceOptions.stride_length_s = 5;
  }

  const result = await transcriber(audioFloat32, inferenceOptions);

  // Clean up temporary WAV
  try {
    if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
  } catch (e) {}

  onProgress({
    status: 'completed',
    progress: 100,
    message: 'Transcription completed successfully.',
  });

  const rawChunks = result.chunks || [];
  const segments = formatRawChunks(rawChunks);

  return {
    success: true,
    text: (result.text || '').trim(),
    segments,
    chunks: rawChunks,
  };
}

module.exports = {
  transcribeAudioFile,
};
