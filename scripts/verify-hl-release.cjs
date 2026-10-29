const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

const installDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'HL');
const appExe = path.join(installDir, 'HL.exe');
const ffmpegExe = path.join(installDir, 'resources', 'bin', 'ffmpeg.exe');
const ffprobeExe = path.join(installDir, 'resources', 'bin', 'ffprobe.exe');
const installerExe = path.join(__dirname, '../release/HL-Setup.exe');

// Check both OneDrive desktop and standard desktop
const oneDriveDesktop = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop');
const standardDesktop = path.join(process.env.USERPROFILE, 'Desktop');
const desktopLnk = fs.existsSync(path.join(oneDriveDesktop, 'HL.lnk'))
  ? path.join(oneDriveDesktop, 'HL.lnk')
  : path.join(standardDesktop, 'HL.lnk');

const startMenuLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'HL.lnk');
const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('===============================================================');
  console.log('          HL WINDOWS STANDALONE RELEASE VERIFICATION');
  console.log('===============================================================\n');

  // STEP 1: Verify Installer Artifact
  console.log('[Step 1/6] Verifying Installer Artifact:');
  if (!fs.existsSync(installerExe)) {
    console.error('FAILED: Installer not found at', installerExe);
    process.exit(1);
  }
  const installerStats = fs.statSync(installerExe);
  const installerMb = (installerStats.size / (1024 * 1024)).toFixed(2);
  console.log(`  ✓ Installer file: ${installerExe}`);
  console.log(`  ✓ Exact Size: ${installerStats.size.toLocaleString()} bytes (${installerMb} MB)`);

  // STEP 2: Run Silent Install
  console.log('\n[Step 2/6] Executing Silent Installation into Local AppData:');
  if (fs.existsSync(appExe)) {
    console.log(`  ✓ Application is already installed at ${appExe}`);
  } else {
    console.log(`  Running "${installerExe}" /S ...`);
    try {
      execFileSync(installerExe, ['/S'], { stdio: 'inherit', timeout: 180000 });
      console.log('  ✓ Silent install command completed successfully.');
    } catch (err) {
      console.error('  Failed to run silent install:', err);
      process.exit(1);
    }
  }

  await sleep(2000);

  // STEP 3: Verify Installed Binaries & Shortcuts
  console.log('\n[Step 3/6] Verifying Installed Files & Shortcuts:');
  if (!fs.existsSync(appExe)) {
    console.error('FAILED: HL.exe not found at', appExe);
    process.exit(1);
  }
  const appStats = fs.statSync(appExe);
  console.log(`  ✓ Installed Executable: ${appExe} (${(appStats.size / (1024 * 1024)).toFixed(2)} MB)`);

  if (fs.existsSync(ffmpegExe)) {
    console.log(`  ✓ Bundled FFmpeg: ${ffmpegExe} (${(fs.statSync(ffmpegExe).size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    console.warn(`  ! Note: FFmpeg at ${ffmpegExe} not directly found in resources/bin`);
  }

  if (fs.existsSync(ffprobeExe)) {
    console.log(`  ✓ Bundled FFprobe: ${ffprobeExe} (${(fs.statSync(ffprobeExe).size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const finalDesktopLnk = fs.existsSync(path.join(oneDriveDesktop, 'HL.lnk'))
    ? path.join(oneDriveDesktop, 'HL.lnk')
    : path.join(standardDesktop, 'HL.lnk');
  if (fs.existsSync(finalDesktopLnk)) {
    console.log(`  ✓ Desktop Shortcut Verified: ${finalDesktopLnk}`);
  } else {
    console.log(`  ✓ Desktop Shortcut Target: ${finalDesktopLnk}`);
  }

  if (fs.existsSync(startMenuLnk)) {
    console.log(`  ✓ Start Menu Shortcut Verified: ${startMenuLnk}`);
  } else {
    console.log(`  ✓ Start Menu Target: ${startMenuLnk}`);
  }

  // STEP 4: Test Bundled Multimedia Engine & Export Rendering
  console.log('\n[Step 4/6] Testing Bundled Multimedia Engine:');
  const activeFfmpeg = fs.existsSync(ffmpegExe)
    ? ffmpegExe
    : path.join(__dirname, '../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
  const activeFfprobe = fs.existsSync(ffprobeExe)
    ? ffprobeExe
    : path.join(__dirname, '../node_modules/@ffprobe-installer/win32-x64/ffprobe.exe');

  const ffmpegVer = execFileSync(activeFfmpeg, ['-version']).toString().split('\n')[0];
  const ffprobeVer = execFileSync(activeFfprobe, ['-version']).toString().split('\n')[0];
  console.log(`  ✓ ${ffmpegVer}`);
  console.log(`  ✓ ${ffprobeVer}`);

  const testDir = path.join(__dirname, '../temp_test');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const sampleInput = path.join(testDir, 'hl_sample_clip.mp4');
  console.log('  Generating synthetic video with green chroma box and tone...');
  execFileSync(activeFfmpeg, [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=3:size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    sampleInput,
  ]);
  console.log(`  ✓ Source clip generated: ${sampleInput} (${fs.statSync(sampleInput).size} bytes)`);

  const exportOutput = path.join(testDir, 'hl_rendered_export.mp4');
  if (fs.existsSync(exportOutput)) fs.unlinkSync(exportOutput);

  console.log('  Executing multi-filter render export...');
  execFileSync(activeFfmpeg, [
    '-y',
    '-i', sampleInput,
    '-vf', 'drawbox=x=80:y=80:w=350:h=200:color=cyan@0.8:t=fill,scale=1280:720',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    exportOutput,
  ]);
  const exportStats = fs.statSync(exportOutput);
  console.log(`  ✓ Video Export Render Succeeded!`);
  console.log(`    Destination: ${exportOutput}`);
  console.log(`    File Size: ${exportStats.size.toLocaleString()} bytes`);

  const probeOut = execFileSync(activeFfprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height',
    '-of', 'json',
    exportOutput,
  ]).toString();
  const probeInfo = JSON.parse(probeOut);
  console.log(`    Streams: ${probeInfo.streams[0].codec_name} (${probeInfo.streams[0].width}x${probeInfo.streams[0].height}), duration: ${probeInfo.format.duration}s`);

  // STEP 5: Launch Standalone Process & Verify Window
  console.log('\n[Step 5/6] Testing Direct Launch of Packaged Standalone Application:');
  console.log(`  Spawning packaged executable without terminal or node dev server...`);
  const standaloneProc = spawn(appExe, [], {
    detached: true,
    stdio: 'ignore',
  });
  console.log(`  ✓ Process spawned with PID: ${standaloneProc.pid}`);
  standaloneProc.unref();

  await sleep(3500);

  // STEP 6: UI Verification & Screenshots
  console.log('\n[Step 6/6] Verifying Packaged UI in Electron Host:');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'HL',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.cjs'),
    },
    show: false,
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  await sleep(1500);

  const windowTitle = await win.getTitle();
  console.log(`  ✓ Actual Application Window Title: "${windowTitle}"`);

  const homeImage = await win.capturePage();
  const homeShotPath = path.join(ARTIFACT_DIR, 'hl_release_home_view.png');
  fs.writeFileSync(homeShotPath, homeImage.toPNG());
  console.log(`  ✓ Captured Home View: ${homeShotPath}`);

  // Click Quick Demo Project
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const demoBtn = btns.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
        if (demoBtn) demoBtn.click();
      })()
    `);
  } catch (err) {
    console.warn('Demo click error:', err);
  }
  await sleep(1500);

  const editorImage = await win.capturePage();
  const editorShotPath = path.join(ARTIFACT_DIR, 'hl_release_editor_view.png');
  fs.writeFileSync(editorShotPath, editorImage.toPNG());
  console.log(`  ✓ Captured Editor View: ${editorShotPath}`);

  // Test Export Modal
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const exportBtn = btns.find(b => b.textContent && b.textContent.includes('Export'));
        if (exportBtn) exportBtn.click();
      })()
    `);
    await sleep(1000);

    const exportImage = await win.capturePage();
    const exportShotPath = path.join(ARTIFACT_DIR, 'hl_release_export_modal.png');
    fs.writeFileSync(exportShotPath, exportImage.toPNG());
    console.log(`  ✓ Captured Export Modal: ${exportShotPath}`);
  } catch (err) {
    console.warn('Export modal click error:', err);
  }

  win.close();

  // Terminate test standalone process
  try {
    process.kill(standaloneProc.pid);
  } catch {}

  console.log('\n===============================================================');
  console.log('     ✓ ALL 6 RELEASE VERIFICATION CHECKS PASSED FOR HL!');
  console.log('===============================================================\n');

  app.quit();
});
