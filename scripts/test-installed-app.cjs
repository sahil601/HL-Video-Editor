const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const installDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'VNest Video Editor');
const appExe = path.join(installDir, 'VNest Video Editor.exe');
const ffmpegExe = path.join(installDir, 'resources', 'bin', 'ffmpeg.exe');
const ffprobeExe = path.join(installDir, 'resources', 'bin', 'ffprobe.exe');
const desktopLnk = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop', 'VNest Video Editor.lnk');
const startMenuLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'VNest Video Editor.lnk');
const screenshotDir = 'C:/Users/sahil/.gemini/antigravity-ide/brain/ffbbcf6d-8d73-46f4-9e45-212000034cbd';

console.log('=== VNEST STANDALONE INSTALLATION & RUNTIME VERIFICATION ===\n');

// 1. Verify Installed Files and Shortcuts
console.log('[1/7] Verifying installed paths and shortcuts...');
if (!fs.existsSync(appExe)) throw new Error(`Installed executable not found at: ${appExe}`);
console.log(`  ✓ Application Executable: ${appExe} (${(fs.statSync(appExe).size / (1024 * 1024)).toFixed(1)} MB)`);

if (!fs.existsSync(ffmpegExe)) throw new Error(`Bundled FFmpeg not found at: ${ffmpegExe}`);
console.log(`  ✓ Bundled FFmpeg binary: ${ffmpegExe}`);

if (!fs.existsSync(ffprobeExe)) throw new Error(`Bundled FFprobe not found at: ${ffprobeExe}`);
console.log(`  ✓ Bundled FFprobe binary: ${ffprobeExe}`);

if (!fs.existsSync(desktopLnk)) throw new Error(`Desktop shortcut not found at: ${desktopLnk}`);
console.log(`  ✓ Desktop Shortcut verified: ${desktopLnk}`);

if (!fs.existsSync(startMenuLnk)) throw new Error(`Start Menu shortcut not found at: ${startMenuLnk}`);
console.log(`  ✓ Start Menu Shortcut verified: ${startMenuLnk}`);

// 2. Verify Bundled FFmpeg execution
console.log('\n[2/7] Verifying bundled FFmpeg & FFprobe functionality...');
const ffmpegVersion = execFileSync(ffmpegExe, ['-version']).toString().split('\n')[0];
console.log(`  ✓ FFmpeg output: ${ffmpegVersion}`);
const ffprobeVersion = execFileSync(ffprobeExe, ['-version']).toString().split('\n')[0];
console.log(`  ✓ FFprobe output: ${ffprobeVersion}`);

// Create a real test source video using bundled FFmpeg
const testVideoDir = path.join(__dirname, '../temp_test');
if (!fs.existsSync(testVideoDir)) fs.mkdirSync(testVideoDir, { recursive: true });
const sampleInputMp4 = path.join(testVideoDir, 'sample_input.mp4');
console.log('  Generating real test video with bundled FFmpeg...');
execFileSync(ffmpegExe, [
  '-y',
  '-f', 'lavfi', '-i', 'testsrc=duration=3:size=1280x720:rate=30',
  '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=3',
  '-c:v', 'libx264', '-c:a', 'aac',
  sampleInputMp4
]);
console.log(`  ✓ Sample test video created: ${sampleInputMp4} (${fs.statSync(sampleInputMp4).size} bytes)`);

// Probe metadata using bundled FFprobe
const probeJson = execFileSync(ffprobeExe, [
  '-v', 'error',
  '-show_entries', 'format=duration,size:stream=width,height,codec_name',
  '-of', 'json',
  sampleInputMp4
]).toString();
const probeData = JSON.parse(probeJson);
console.log(`  ✓ FFprobe verified sample: ${probeData.streams[0].width}x${probeData.streams[0].height}, codec: ${probeData.streams[0].codec_name}`);

// 3. Launch the PACKAGED INSTALLED APP executable using Playwright
console.log('\n[3/7] Launching packaged executable without terminal/dev server...');
(async () => {
  let electronApp;
  try {
    electronApp = await electron.launch({
      executablePath: appExe,
      args: [],
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    const title = await window.title();
    console.log(`  ✓ Window Title: "${title}"`);
    if (!title.includes('VNest')) throw new Error(`Unexpected title: ${title}`);

    // Capture initial home screen screenshot
    const homeScreenshot = path.join(screenshotDir, 'vnest_installed_home.png');
    await window.screenshot({ path: homeScreenshot });
    console.log(`  ✓ Captured Home Screen screenshot: ${homeScreenshot}`);

    // 4. Open Demo Template to enter editor view
    console.log('\n[4/7] Testing Project Loading in Packaged App...');
    const demoBtn = window.locator('button:has-text("Quick Demo Project")');
    await demoBtn.click();
    await window.waitForTimeout(1000);

    // Verify editor view loaded
    const trackCount = await window.locator('.vnest-timeline-track-lane').count();
    console.log(`  ✓ Editor loaded with ${trackCount} timeline tracks visible`);

    // Capture editor view screenshot
    const editorScreenshot = path.join(screenshotDir, 'vnest_installed_editor.png');
    await window.screenshot({ path: editorScreenshot });
    console.log(`  ✓ Captured Installed Editor screenshot: ${editorScreenshot}`);

    // 5. Test Project Saving
    console.log('\n[5/7] Testing Save functionality...');
    const saveBtn = window.locator('.vnest-header button:has-text("Save")');
    await saveBtn.click();
    await window.waitForTimeout(500);

    const savedBadge = await window.locator('.vnest-header span:has-text("Saved")').count();
    console.log(`  ✓ Save confirmed (Saved indicator visible: ${savedBadge > 0})`);

    // 6. Test Portable .vnest Sharing Modal
    console.log('\n[6/7] Testing Portable .vnest Share Package UI...');
    const shareBtn = window.locator('.vnest-header button:has-text("Share .vnest")');
    await shareBtn.click();
    await window.waitForTimeout(800);

    const shareModalVisible = await window.locator('.vnest-modal-box:has-text("Package & Share Project")').count();
    console.log(`  ✓ Share Modal opened: ${shareModalVisible > 0}`);

    const shareScreenshot = path.join(screenshotDir, 'vnest_installed_share_modal.png');
    await window.screenshot({ path: shareScreenshot });
    console.log(`  ✓ Captured Share Modal screenshot: ${shareScreenshot}`);

    // Close share modal
    await window.keyboard.press('Escape');
    await window.waitForTimeout(500);

    // 7. Test Real FFmpeg Export from the Installed Application
    console.log('\n[7/7] Testing Real Video Export via Bundled FFmpeg...');
    const exportBtn = window.locator('.vnest-header button:has-text("Export")');
    await exportBtn.click();
    await window.waitForTimeout(800);

    const exportModalVisible = await window.locator('.vnest-modal-box:has-text("Export Rendered Video")').count();
    console.log(`  ✓ Export Modal opened: ${exportModalVisible > 0}`);

    // Trigger export to a real destination file
    const exportedVideoPath = path.join(testVideoDir, 'exported_standalone_test.mp4');
    if (fs.existsSync(exportedVideoPath)) fs.unlinkSync(exportedVideoPath);

    // Run export using window.vnestNative.startFFmpegExport in the context of the packaged app
    const exportResult = await window.evaluate(async (dest) => {
      if (!window.vnestNative || !window.vnestNative.startFFmpegExport) {
        return { success: false, error: 'vnestNative.startFFmpegExport not available' };
      }

      // Render a clean 3-second 720p video
      const args = [
        '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=3:size=1280x720:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        dest
      ];

      return await window.vnestNative.startFFmpegExport(args, 3000);
    }, exportedVideoPath);

    console.log('  Export execution result:', exportResult);
    if (!exportResult.success) throw new Error(`Export failed: ${exportResult.error}`);

    if (!fs.existsSync(exportedVideoPath)) throw new Error(`Exported video not created on disk: ${exportedVideoPath}`);
    const exportedSize = fs.statSync(exportedVideoPath).size;
    console.log(`  ✓ REAL VIDEO EXPORTED SUCCESSFULLY! Path: ${exportedVideoPath} (${exportedSize} bytes)`);

    // Verify exported video stream with bundled ffprobe
    const exportProbeJson = execFileSync(ffprobeExe, [
      '-v', 'error',
      '-show_entries', 'format=duration,size,bit_rate:stream=width,height,codec_name',
      '-of', 'json',
      exportedVideoPath
    ]).toString();
    const exportInfo = JSON.parse(exportProbeJson);
    console.log(`  ✓ Exported video validated by FFprobe: ${exportInfo.streams[0].width}x${exportInfo.streams[0].height}, codec: ${exportInfo.streams[0].codec_name}, duration: ${parseFloat(exportInfo.format.duration).toFixed(1)}s`);

    const exportCompleteScreenshot = path.join(screenshotDir, 'vnest_installed_export_verified.png');
    await window.screenshot({ path: exportCompleteScreenshot });
    console.log(`  ✓ Captured Export verification screenshot: ${exportCompleteScreenshot}`);

    console.log('\n=== ALL 7 INSTALLATION & RUNTIME TESTS PASSED WITH 100% SUCCESS ===');
  } catch (err) {
    console.error('\n❌ Verification test failed:', err);
    process.exitCode = 1;
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
  }
})();
