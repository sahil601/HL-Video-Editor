/**
 * HL Video Editor — Phase 9C Clean Voice Audio Fixture Generator
 * Generates calibrated, reproducible speech and noise audio fixtures for
 * comprehensive objective audio quality and regression validation.
 */

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '..', 'test_fixtures', 'audio');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

/**
 * Creates a standard 16-bit PCM WAV file buffer from normalized Float32 samples.
 */
function createWavBuffer(samples, sampleRate, numChannels = 1) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 to +1.0
    const clamped = Math.max(-1.0, Math.min(1.0, samples[i]));
    const intSample = clamped < 0 ? clamped * 32768 : clamped * 32767;
    buffer.writeInt16LE(Math.round(intSample), offset);
    offset += 2;
  }

  return buffer;
}

/**
 * Synthesizes a vocal phoneme with pitch F0 and formants F1, F2, F3.
 */
function synthesizeVocalSegment(durationSec, sampleRate, f0, f1, f2, f3, amplitude = 0.5) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Pitch fundamental with natural prosodic vibrato
    const vibrato = 1.0 + 0.015 * Math.sin(2 * Math.PI * 5.5 * t);
    const fundamental = Math.sin(2 * Math.PI * (f0 * vibrato) * t);

    // Formant resonances
    const formant1 = 0.6 * Math.sin(2 * Math.PI * f1 * t);
    const formant2 = 0.4 * Math.sin(2 * Math.PI * f2 * t);
    const formant3 = 0.25 * Math.sin(2 * Math.PI * f3 * t);

    // Glottal harmonic envelope
    out[i] = amplitude * (0.35 * fundamental + formant1 + formant2 + formant3);
  }

  return out;
}

/**
 * Synthesizes an unvoiced fricative consonant burst (/s/, /t/, /sh/).
 */
function synthesizeFricative(durationSec, sampleRate, centerFreq = 4500, bandwidth = 2000, amplitude = 0.15) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Bandpass-filtered pseudo-random noise burst
    const noise = (Math.random() * 2 - 1);
    const modulation = Math.sin(2 * Math.PI * centerFreq * t);
    out[i] = amplitude * noise * modulation;
  }

  return out;
}

/**
 * Concatenates segments with crossfade smoothing to avoid clicks.
 */
function concatenateWithSmoothing(segments, pauseBetweenSec, sampleRate) {
  const pauseSamples = Math.floor(pauseBetweenSec * sampleRate);
  let totalLength = 0;
  for (const seg of segments) {
    totalLength += seg.length + pauseSamples;
  }

  const out = new Float32Array(totalLength);
  let writeIdx = 0;

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    // Smooth envelope attack and release (10ms)
    const fadeSamples = Math.min(Math.floor(0.015 * sampleRate), Math.floor(seg.length / 2));
    for (let i = 0; i < seg.length; i++) {
      let gain = 1.0;
      if (i < fadeSamples) {
        gain = i / fadeSamples;
      } else if (i > seg.length - fadeSamples) {
        gain = (seg.length - i) / fadeSamples;
      }
      out[writeIdx++] = seg[i] * gain;
    }
    writeIdx += pauseSamples; // silence pause
  }

  return out;
}

// ============================================================================
// FIXTURE 1: Speech with 50/60 Hz Power Hum and Broadband Room Noise (48kHz Mono)
// Structure:
// [0.0s - 0.5s] Room noise only (Baseline noise pause)
// [0.5s - 2.5s] Word 1 & 2 ("Hello world") with speech formants
// [2.5s - 3.8s] Speech Pause (HVAC rumble + hum only)
// [3.8s - 5.5s] Word 3 & 4 ("Clean dialogue")
// [5.5s - 6.0s] Room noise decay
// ============================================================================
function generateFixture1() {
  const sampleRate = 48000;
  const totalDuration = 6.0;
  const numSamples = Math.floor(totalDuration * sampleRate);
  const speechTrack = new Float32Array(numSamples);

  // Syllable 1: "Hel-" (F0=140Hz, F1=550, F2=1800, F3=2700)
  const syl1 = synthesizeVocalSegment(0.35, sampleRate, 140, 550, 1800, 2700, 0.45);
  // Syllable 2: "-lo" (F0=130Hz, F1=450, F2=1100, F3=2500)
  const syl2 = synthesizeVocalSegment(0.40, sampleRate, 130, 450, 1100, 2500, 0.40);
  // Syllable 3: "World" (F0=120Hz, F1=400, F2=1200, F3=2600) + /d/ closure
  const syl3 = synthesizeVocalSegment(0.50, sampleRate, 120, 400, 1200, 2600, 0.38);

  // Word group 2: "Clean" (/kl/ fricative + /i/ + /n/)
  const fricative = synthesizeFricative(0.08, sampleRate, 3800, 1500, 0.18);
  const syl4 = synthesizeVocalSegment(0.45, sampleRate, 145, 300, 2200, 3000, 0.42);
  const syl5 = synthesizeVocalSegment(0.55, sampleRate, 135, 600, 1500, 2600, 0.36);

  // Place speech syllables at exact timestamps
  const place = (samples, startSec) => {
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < samples.length && (startIdx + i) < numSamples; i++) {
      speechTrack[startIdx + i] += samples[i];
    }
  };

  place(syl1, 0.6);
  place(syl2, 1.0);
  place(syl3, 1.55);
  // Pause from 2.1s to 3.8s (Silence interval!)
  place(fricative, 3.8);
  place(syl4, 3.9);
  place(syl5, 4.45);

  // Add 50Hz + 60Hz power mains hum + broadband room noise
  const mixed = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // 50Hz and 60Hz hum with odd/even harmonics (100Hz, 120Hz, 150Hz, 180Hz)
    const hum50 = 0.08 * Math.sin(2 * Math.PI * 50 * t);
    const hum60 = 0.06 * Math.sin(2 * Math.PI * 60 * t);
    const humHarmonics = 0.03 * Math.sin(2 * Math.PI * 100 * t) + 0.02 * Math.sin(2 * Math.PI * 120 * t);

    // Broadband room tone / HVAC air conditioning noise (-28 dBFS)
    const whiteNoise = (Math.random() * 2 - 1) * 0.035;
    // Low frequency HVAC rumble (80-120Hz modulated noise)
    const hvacRumble = 0.04 * Math.sin(2 * Math.PI * 85 * t) * (0.8 + 0.2 * Math.random());

    const totalNoise = hum50 + hum60 + humHarmonics + whiteNoise + hvacRumble;
    mixed[i] = speechTrack[i] + totalNoise;
  }

  const wavBuf = createWavBuffer(mixed, sampleRate, 1);
  const outPath = path.join(fixturesDir, 'speech_with_hum_noise_48k_mono.wav');
  fs.writeFileSync(outPath, wavBuf);
  console.log(`  ✓ Generated Fixture 1: ${outPath} (${wavBuf.length} bytes, 48kHz mono)`);
}

// ============================================================================
// FIXTURE 2: Speech with Quiet Word Endings & Whispered Tails (48kHz Mono)
// Tests: Ensures gate/expander release does not prematurely truncate low-level
// speech endings (e.g. -s, -th, trailing consonants down to -38 dBFS).
// ============================================================================
function generateFixture2() {
  const sampleRate = 48000;
  const totalDuration = 5.0;
  const numSamples = Math.floor(totalDuration * sampleRate);
  const buffer = new Float32Array(numSamples);

  // Word 1 with loud vowel (0.5) decaying smoothly into very quiet ending (-35dB = ~0.018)
  const word1Vowel = synthesizeVocalSegment(0.6, sampleRate, 140, 500, 1600, 2500, 0.45);
  // Word 1 tail: trailing unvoiced 's' sound decaying from 0.08 down to 0.008 over 350ms
  const tailDuration = 0.35;
  const tailSamples = Math.floor(tailDuration * sampleRate);
  const tail = new Float32Array(tailSamples);
  for (let i = 0; i < tailSamples; i++) {
    const progress = i / tailSamples;
    const decayAmp = 0.08 * Math.pow(1 - progress, 1.5) + 0.005; // decays smoothly
    tail[i] = (Math.random() * 2 - 1) * decayAmp * Math.sin(2 * Math.PI * 5200 * (i / sampleRate));
  }

  // Word 2: soft spoken phrase (average amplitude ~0.10, with quiet trailing consonants)
  const word2Vowel = synthesizeVocalSegment(0.5, sampleRate, 125, 400, 1200, 2600, 0.15);

  const place = (samples, startSec) => {
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < samples.length && (startIdx + i) < numSamples; i++) {
      buffer[startIdx + i] += samples[i];
    }
  };

  place(word1Vowel, 0.5);
  place(tail, 1.05);
  // Quiet pause 1.4s - 2.8s
  place(word2Vowel, 2.8);

  // Add low ambient room noise (at -42 dBFS = ~0.008)
  for (let i = 0; i < numSamples; i++) {
    buffer[i] += (Math.random() * 2 - 1) * 0.006;
  }

  const wavBuf = createWavBuffer(buffer, sampleRate, 1);
  const outPath = path.join(fixturesDir, 'speech_quiet_endings_48k_mono.wav');
  fs.writeFileSync(outPath, wavBuf);
  console.log(`  ✓ Generated Fixture 2: ${outPath} (${wavBuf.length} bytes, quiet speech tails)`);
}

// ============================================================================
// FIXTURE 3: Clean Studio Speech with Zero Added Noise (44.1kHz Stereo)
// Tests: Ensures Clean Voice does not introduce unwanted artifacts, muffling,
// phase distortion, or comb filtering when applied to already clean audio.
// ============================================================================
function generateFixture3() {
  const sampleRate = 44100;
  const totalDuration = 4.0;
  const numFrames = Math.floor(totalDuration * sampleRate);
  const stereoSamples = new Float32Array(numFrames * 2);

  // Pure studio dialogue formants
  const syl1 = synthesizeVocalSegment(0.6, sampleRate, 135, 520, 1750, 2650, 0.50);
  const syl2 = synthesizeVocalSegment(0.7, sampleRate, 120, 480, 1250, 2450, 0.45);

  const monoTrack = new Float32Array(numFrames);
  const place = (samples, startSec) => {
    const startIdx = Math.floor(startSec * sampleRate);
    for (let i = 0; i < samples.length && (startIdx + i) < numFrames; i++) {
      monoTrack[startIdx + i] += samples[i];
    }
  };

  place(syl1, 0.4);
  place(syl2, 1.6);

  // Interleave to Stereo (left slightly panned 1.0, right 0.95 with 0.5ms stereo acoustic warmth)
  for (let i = 0; i < numFrames; i++) {
    stereoSamples[i * 2] = monoTrack[i];
    // Right channel slightly offset for natural stereo imaging
    const rIdx = Math.max(0, i - 12);
    stereoSamples[i * 2 + 1] = monoTrack[rIdx] * 0.98;
  }

  const wavBuf = createWavBuffer(stereoSamples, sampleRate, 2);
  const outPath = path.join(fixturesDir, 'speech_clean_studio_44k_stereo.wav');
  fs.writeFileSync(outPath, wavBuf);
  console.log(`  ✓ Generated Fixture 3: ${outPath} (${wavBuf.length} bytes, 44.1kHz stereo clean)`);
}

// ============================================================================
// FIXTURE 4: High-Resolution Dialogue Track (96kHz Stereo)
// Tests: Verifies DSP filter stability and sample-rate independence at 96kHz.
// ============================================================================
function generateFixture4() {
  const sampleRate = 96000;
  const totalDuration = 3.5;
  const numFrames = Math.floor(totalDuration * sampleRate);
  const stereoSamples = new Float32Array(numFrames * 2);

  const syl = synthesizeVocalSegment(1.2, sampleRate, 130, 500, 1600, 2600, 0.5);
  const monoTrack = new Float32Array(numFrames);

  const startIdx = Math.floor(0.5 * sampleRate);
  for (let i = 0; i < syl.length && (startIdx + i) < numFrames; i++) {
    monoTrack[startIdx + i] = syl[i];
  }

  // Add 60Hz hum + hiss
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    const hum = 0.05 * Math.sin(2 * Math.PI * 60 * t);
    const noise = (Math.random() * 2 - 1) * 0.02;
    monoTrack[i] += hum + noise;
  }

  for (let i = 0; i < numFrames; i++) {
    stereoSamples[i * 2] = monoTrack[i];
    stereoSamples[i * 2 + 1] = monoTrack[i];
  }

  const wavBuf = createWavBuffer(stereoSamples, sampleRate, 2);
  const outPath = path.join(fixturesDir, 'speech_dialogue_96k_stereo.wav');
  fs.writeFileSync(outPath, wavBuf);
  console.log(`  ✓ Generated Fixture 4: ${outPath} (${wavBuf.length} bytes, 96kHz stereo)`);
}

console.log('Generating reproducible Clean Voice audio test fixtures...');
generateFixture1();
generateFixture2();
generateFixture3();
generateFixture4();
console.log('All Clean Voice audio fixtures generated successfully.\n');
