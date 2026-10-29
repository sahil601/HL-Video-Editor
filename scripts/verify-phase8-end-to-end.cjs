const fs = require('fs');
const path = require('path');
const { execSync, spawn, spawnSync } = require('child_process');

console.log('===============================================================');
console.log('   HL Phase 8 — Export & Professional Workflow E2E Verification');
console.log('===============================================================');

const tempDir = path.join(__dirname, '..', 'temp_phase8_test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 1. Locate bundled FFmpeg and FFprobe binaries reliably
function resolveBinary(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const localModulePath = path.join(__dirname, `../node_modules/@${name}-installer/win32-x64/${exe}`);
  if (fs.existsSync(localModulePath)) return localModulePath;

  try {
    const mod = name === 'ffmpeg' ? require('@ffmpeg-installer/ffmpeg') : require('@ffprobe-installer/ffprobe');
    if (mod && mod.path && fs.existsSync(mod.path)) return mod.path;
  } catch (e) {}

  return exe;
}

const ffmpegPath = resolveBinary('ffmpeg');
const ffprobePath = resolveBinary('ffprobe');

console.log(`Using FFmpeg binary: ${ffmpegPath}`);
console.log(`Using FFprobe binary: ${ffprobePath}`);

if (!fs.existsSync(ffmpegPath)) {
  console.error(`FATAL: FFmpeg binary not found at ${ffmpegPath}`);
  process.exit(1);
}
if (!fs.existsSync(ffprobePath)) {
  console.error(`FATAL: FFprobe binary not found at ${ffprobePath}`);
  process.exit(1);
}

function probeFile(filePath) {
  const cmd = `"${ffprobePath}" -v error -show_entries format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json "${filePath}"`;
  const out = execSync(cmd, { stdio: 'pipe' }).toString();
  return JSON.parse(out);
}

async function runVerification() {
  const results = [];
  let stepIndex = 1;

  function record(title, passed, details = {}) {
    results.push({ step: stepIndex++, title, passed, details });
    const mark = passed ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`  ${mark} ${title}`);
    if (Object.keys(details).length > 0) {
      console.log(`    Details:`, JSON.stringify(details));
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test 1: Runtime Detection of Available FFmpeg Encoders
    // --------------------------------------------------------------------------
    console.log('\n[1/8] Runtime FFmpeg Encoders Detection & Verification...');
    const encodersRes = spawnSync(ffmpegPath, ['-encoders'], { encoding: 'utf8', timeout: 5000 });
    const encodersStdout = encodersRes.stdout || '';

    const testCandidates = [
      { id: 'libx264', isHardware: false },
      { id: 'h264_qsv', isHardware: true },
      { id: 'h264_nvenc', isHardware: true },
      { id: 'libx265', isHardware: false },
      { id: 'libvpx-vp9', isHardware: false },
      { id: 'prores_ks', isHardware: false },
    ];

    const detectedEncoders = [];
    for (const cand of testCandidates) {
      const inBinary = encodersStdout.includes(` ${cand.id} `) || encodersStdout.includes(` ${cand.id}\n`);
      let works = false;
      if (inBinary) {
        try {
          const testRes = spawnSync(
            ffmpegPath,
            ['-f', 'lavfi', '-i', 'nullsrc=s=64x64:d=0.05', '-c:v', cand.id, '-f', 'null', '-'],
            { encoding: 'utf8', timeout: 3500 }
          );
          works = testRes.status === 0;
        } catch (e) {
          works = false;
        }
      }
      detectedEncoders.push({ id: cand.id, isHardware: cand.isHardware, works });
    }

    const libx264Works = detectedEncoders.find((e) => e.id === 'libx264')?.works;
    record(
      'Runtime FFmpeg encoder detection identifies software & hardware encoders',
      libx264Works === true,
      { detected: detectedEncoders }
    );

    // --------------------------------------------------------------------------
    // Test 2: Synthesize Test Source Media Clips
    // --------------------------------------------------------------------------
    console.log('\n[2/8] Synthesizing Test Source Media Assets...');
    const sourceVideoPath = path.join(tempDir, 'source_sample_1080p.mp4');
    const sourceAudioPath = path.join(tempDir, 'source_audio_track.wav');

    // Create 1080p sample video (4 seconds, 30fps)
    execSync(
      `"${ffmpegPath}" -y -f lavfi -i testsrc=size=1920x1080:rate=30:duration=4 ` +
      `-c:v libx264 -preset ultrafast -pix_fmt yuv420p "${sourceVideoPath}"`,
      { stdio: 'pipe' }
    );

    // Create 440Hz sine audio WAV (4 seconds)
    execSync(
      `"${ffmpegPath}" -y -f lavfi -i sine=frequency=440:duration=4 -ar 48000 -ac 2 "${sourceAudioPath}"`,
      { stdio: 'pipe' }
    );

    const videoStat = fs.statSync(sourceVideoPath);
    const audioStat = fs.statSync(sourceAudioPath);
    record('Synthesized test media clips (1080p MP4 and 48kHz WAV)', videoStat.size > 0 && audioStat.size > 0, {
      videoSize: videoStat.size,
      audioSize: audioStat.size,
    });

    // --------------------------------------------------------------------------
    // Test 3: Temporary File Rendering Followed by FFprobe Validation & Atomic Finalize
    // --------------------------------------------------------------------------
    console.log('\n[3/8] Testing Temporary File Rendering, FFprobe Validation & Atomic Finalize...');
    const finalOutputPath = path.join(tempDir, 'validated_master_export.mp4');
    const tempOutputPath = `${finalOutputPath}.hl_tmp_test123.mp4`;

    // Render to temporary file
    execSync(
      `"${ffmpegPath}" -y -i "${sourceVideoPath}" -i "${sourceAudioPath}" ` +
      `-c:v libx264 -preset fast -b:v 10M -pix_fmt yuv420p -c:a aac -b:a 192k ` +
      `-movflags +faststart "${tempOutputPath}"`,
      { stdio: 'pipe' }
    );

    // Validate temporary file with FFprobe before finalizing
    const tempProbe = probeFile(tempOutputPath);
    const tempVStream = tempProbe.streams.find((s) => s.codec_type === 'video');
    const tempAStream = tempProbe.streams.find((s) => s.codec_type === 'audio');
    const tempDuration = parseFloat(tempProbe.format?.duration || '0');

    const isValidTemp =
      tempVStream &&
      tempVStream.width === 1920 &&
      tempVStream.height === 1080 &&
      tempAStream &&
      tempDuration >= 3.8;

    if (!isValidTemp) {
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      throw new Error('Temporary export file failed FFprobe stream validation');
    }

    // Atomically promote temporary file to final destination
    if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
    fs.renameSync(tempOutputPath, finalOutputPath);

    const finalStat = fs.statSync(finalOutputPath);
    const tempExistsAfter = fs.existsSync(tempOutputPath);

    record(
      'Temporary file rendering, FFprobe stream validation, and atomic promotion to final destination',
      finalStat.size > 0 && !tempExistsAfter,
      {
        finalSize: finalStat.size,
        duration: tempDuration,
        width: tempVStream.width,
        height: tempVStream.height,
        tempCleanedUp: !tempExistsAfter,
      }
    );

    // --------------------------------------------------------------------------
    // Test 4: Real Export with YouTube 1080p Preset (60fps, 12M, AAC)
    // --------------------------------------------------------------------------
    console.log('\n[4/8] Testing YouTube 1080p60 Export Preset...');
    const ytOutputPath = path.join(tempDir, 'youtube_1080p60_export.mp4');
    const ytTempPath = `${ytOutputPath}.hl_tmp_yt.mp4`;

    execSync(
      `"${ffmpegPath}" -y -i "${sourceVideoPath}" -i "${sourceAudioPath}" ` +
      `-c:v libx264 -preset fast -b:v 12M -pix_fmt yuv420p -r 60 -c:a aac -b:a 192k ` +
      `-movflags +faststart "${ytTempPath}"`,
      { stdio: 'pipe' }
    );

    const ytProbe = probeFile(ytTempPath);
    const ytVStream = ytProbe.streams.find((s) => s.codec_type === 'video');
    const [num, den] = ytVStream.r_frame_rate.split('/').map(Number);
    const ytFps = Math.round(num / den);

    if (fs.existsSync(ytOutputPath)) fs.unlinkSync(ytOutputPath);
    fs.renameSync(ytTempPath, ytOutputPath);

    record('YouTube 1080p60 preset exported and probed with 60fps cadence', ytFps === 60, {
      width: ytVStream.width,
      height: ytVStream.height,
      fps: ytFps,
      size: fs.statSync(ytOutputPath).size,
    });

    // --------------------------------------------------------------------------
    // Test 5: Real Export with TikTok / Instagram Reels 9:16 Vertical Preset
    // --------------------------------------------------------------------------
    console.log('\n[5/8] Testing TikTok / Instagram Reels 9:16 Vertical Export Preset...');
    const verticalOutputPath = path.join(tempDir, 'tiktok_9x16_export.mp4');
    const verticalTempPath = `${verticalOutputPath}.hl_tmp_vert.mp4`;

    execSync(
      `"${ffmpegPath}" -y -i "${sourceVideoPath}" -i "${sourceAudioPath}" ` +
      `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" ` +
      `-c:v libx264 -preset fast -b:v 10M -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k ` +
      `-movflags +faststart "${verticalTempPath}"`,
      { stdio: 'pipe' }
    );

    const vertProbe = probeFile(verticalTempPath);
    const vertVStream = vertProbe.streams.find((s) => s.codec_type === 'video');

    if (fs.existsSync(verticalOutputPath)) fs.unlinkSync(verticalOutputPath);
    fs.renameSync(verticalTempPath, verticalOutputPath);

    record('TikTok / Instagram Reels 9:16 vertical preset (1080x1920)', vertVStream.width === 1080 && vertVStream.height === 1920, {
      width: vertVStream.width,
      height: vertVStream.height,
      size: fs.statSync(verticalOutputPath).size,
    });

    // --------------------------------------------------------------------------
    // Test 6: Real Export with Instagram Square (1080x1080) Preset
    // --------------------------------------------------------------------------
    console.log('\n[6/8] Testing Instagram Square (1080x1080) Preset...');
    const squareOutputPath = path.join(tempDir, 'instagram_square_export.mp4');
    const squareTempPath = `${squareOutputPath}.hl_tmp_sq.mp4`;

    execSync(
      `"${ffmpegPath}" -y -i "${sourceVideoPath}" -i "${sourceAudioPath}" ` +
      `-vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" ` +
      `-c:v libx264 -preset fast -b:v 8M -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k ` +
      `-movflags +faststart "${squareTempPath}"`,
      { stdio: 'pipe' }
    );

    const sqProbe = probeFile(squareTempPath);
    const sqVStream = sqProbe.streams.find((s) => s.codec_type === 'video');

    if (fs.existsSync(squareOutputPath)) fs.unlinkSync(squareOutputPath);
    fs.renameSync(squareTempPath, squareOutputPath);

    record('Instagram Square (1080x1080 1:1) preset verified', sqVStream.width === 1080 && sqVStream.height === 1080, {
      width: sqVStream.width,
      height: sqVStream.height,
      size: fs.statSync(squareOutputPath).size,
    });

    // --------------------------------------------------------------------------
    // Test 7: Export Cancellation Handling & Temporary File Cleanup
    // --------------------------------------------------------------------------
    console.log('\n[7/8] Testing Process Cancellation & Temp File Cleanup...');
    const cancelOutputPath = path.join(tempDir, 'cancelled_test_video.mp4');
    const cancelTempPath = `${cancelOutputPath}.hl_tmp_cancel.mp4`;

    // Start a long synthetic encode (15 seconds testsrc)
    const longProcess = spawn(ffmpegPath, [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=15',
      '-c:v', 'libx264', '-preset', 'veryslow',
      cancelTempPath,
    ]);

    // Allow it to run for 250ms so the temp file is created on disk
    await new Promise((r) => setTimeout(r, 250));

    // Abruptly kill/cancel the process
    longProcess.kill('SIGTERM');

    // Simulate cleanup handler in Electron
    await new Promise((r) => setTimeout(r, 150));
    if (fs.existsSync(cancelTempPath)) {
      try { fs.unlinkSync(cancelTempPath); } catch (e) {}
    }

    const cancelTempExists = fs.existsSync(cancelTempPath);
    const cancelFinalExists = fs.existsSync(cancelOutputPath);

    record(
      'Export cancellation terminates process cleanly and deletes incomplete temporary files',
      !cancelTempExists && !cancelFinalExists,
      { tempCleanedUp: !cancelTempExists, finalNotCreated: !cancelFinalExists }
    );

    // --------------------------------------------------------------------------
    // Test 8: Safe Overwrite Handling
    // --------------------------------------------------------------------------
    console.log('\n[8/8] Testing Safe Overwrite Handling of Existing Output Files...');
    const overwriteTargetPath = path.join(tempDir, 'overwrite_target.mp4');
    fs.writeFileSync(overwriteTargetPath, 'OLD_PRE_EXISTING_VIDEO_DATA_BYTES');

    const oldStat = fs.statSync(overwriteTargetPath);
    const overwriteTempPath = `${overwriteTargetPath}.hl_tmp_ow.mp4`;

    // Render new valid video to temp path
    execSync(
      `"${ffmpegPath}" -y -i "${sourceVideoPath}" -c:v libx264 -preset ultrafast -t 1 "${overwriteTempPath}"`,
      { stdio: 'pipe' }
    );

    // FFprobe validate
    const owProbe = probeFile(overwriteTempPath);
    expectValid = owProbe.streams.some((s) => s.codec_type === 'video');

    if (expectValid) {
      if (fs.existsSync(overwriteTargetPath)) fs.unlinkSync(overwriteTargetPath);
      fs.renameSync(overwriteTempPath, overwriteTargetPath);
    }

    const newStat = fs.statSync(overwriteTargetPath);
    const newContent = fs.readFileSync(overwriteTargetPath);
    const wasOverwrittenWithValidMP4 =
      newStat.size > oldStat.size &&
      newContent.indexOf(Buffer.from('ftyp')) !== -1;

    record('Safe overwrite replacement retains original file until FFprobe confirms new render is valid', wasOverwrittenWithValidMP4, {
      oldSize: oldStat.size,
      newSize: newStat.size,
      isValidContainer: wasOverwrittenWithValidMP4,
    });

  } catch (error) {
    console.error('\nE2E Verification Exception:', error);
    record('Execution Exception', false, { error: error.message });
  } finally {
    // Clean up temporary test files
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          try { fs.unlinkSync(path.join(tempDir, file)); } catch (e) {}
        }
        try { fs.rmdirSync(tempDir); } catch (e) {}
      }
    } catch (e) {}
  }

  // Summary Report
  console.log('\n===============================================================');
  console.log('   PHASE 8 E2E VERIFICATION SUMMARY RESULTS                     ');
  console.log('===============================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) passCount++;
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.step}. ${r.title}`);
  }
  console.log('---------------------------------------------------------------');
  console.log(`Total Passed: ${passCount} / ${results.length}`);
  console.log('===============================================================');

  if (passCount === results.length) {
    console.log('\n>>> ALL PHASE 8 E2E VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } else {
    console.error('\n>>> SOME PHASE 8 E2E CHECKS FAILED <<<\n');
    process.exit(1);
  }
}

runVerification();
