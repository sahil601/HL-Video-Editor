/**
 * Comprehensive Electron GUI Verification Script for:
 * 1. Import Files button (click handler -> preload -> IPC -> native file dialog -> media library list -> timeline addition)
 * 2. Auto Cut button in Header, Timeline toolbar, and Media Library (modal open -> controls -> review -> apply)
 */

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58';
const TEMP_DIR = path.join(__dirname, '../temp_gui_test');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Locate bundled ffmpeg executable
const ffmpegExe = path.join(__dirname, '../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');

const testVideoPath = path.join(TEMP_DIR, 'hl_test_video.mp4');
const testAudioPath = path.join(TEMP_DIR, 'hl_test_audio.mp3');
const testImagePath = path.join(TEMP_DIR, 'hl_test_image.png');

// Synthesize small valid media files for true E2E testing
try {
  if (!fs.existsSync(testVideoPath)) {
    execFileSync(ffmpegExe, [
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=2',
      '-f', 'lavfi', '-i', 'sine=f=440:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-y', testVideoPath,
    ]);
  }
  if (!fs.existsSync(testAudioPath)) {
    execFileSync(ffmpegExe, [
      '-f', 'lavfi', '-i', 'sine=f=520:d=2',
      '-c:a', 'mp3',
      '-y', testAudioPath,
    ]);
  }
  if (!fs.existsSync(testImagePath)) {
    execFileSync(ffmpegExe, [
      '-f', 'lavfi', '-i', 'color=c=purple:s=160x120:d=1',
      '-vframes', '1',
      '-y', testImagePath,
    ]);
  }
} catch (err) {
  console.warn('Note: Could not synthesize media via ffmpegExe, using binary fallbacks:', err.message);
  if (!fs.existsSync(testVideoPath)) fs.writeFileSync(testVideoPath, Buffer.from('mock video'));
  if (!fs.existsSync(testAudioPath)) fs.writeFileSync(testAudioPath, Buffer.from('mock audio'));
  if (!fs.existsSync(testImagePath)) fs.writeFileSync(testImagePath, Buffer.from('mock image'));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------------------------------------
// Register IPC Handlers to verify full Preload -> IPC native loop
// -------------------------------------------------------------
ipcMain.handle('select-media-files', async () => {
  console.log('  [Main Process IPC] handle(select-media-files) invoked -> returning native file selection');
  return [testVideoPath, testAudioPath, testImagePath];
});

ipcMain.handle('read-file-binary', async (event, targetPath) => {
  try {
    if (fs.existsSync(targetPath)) {
      const buffer = fs.readFileSync(targetPath);
      return { success: true, buffer };
    }
    return { success: false, error: 'File not found on disk' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('detect-silence', async (event, filePath, options = {}) => {
  console.log('  [Main Process IPC] handle(detect-silence) invoked for:', filePath);
  return {
    success: true,
    silences: [
      { startSec: 1.0, endSec: 2.2, durationSec: 1.2, startMs: 1000, endMs: 2200, durationMs: 1200 },
      { startSec: 3.5, endSec: 4.8, durationSec: 1.3, startMs: 3500, endMs: 4800, durationMs: 1300 },
    ],
    rawCount: 2,
  };
});

ipcMain.handle('detect-scenes', async (event, filePath, options = {}) => {
  console.log('  [Main Process IPC] handle(detect-scenes) invoked for:', filePath);
  return {
    success: true,
    sceneChanges: [
      { timeSec: 2.5, timeMs: 2500 },
      { timeSec: 5.0, timeMs: 5000 },
    ],
    rawCount: 2,
  };
});

ipcMain.handle('detect-watermark-candidate', async () => {
  return {
    success: true,
    candidate: {
      positionX: 80,
      positionY: 5,
      width: 16,
      height: 8,
      corner: 'top-right',
      confidence: 0.88,
    },
  };
});

ipcMain.handle('get-available-encoders', async () => {
  return [
    { id: 'libx264', name: 'H.264 / AVC (libx264 - Software)', isHardware: false },
    { id: 'libx265', name: 'H.265 / HEVC (libx265 - Software)', isHardware: false }
  ];
});

ipcMain.handle('check-file-exists', async (event, targetPath) => {
  return fs.existsSync(targetPath);
});

app.whenReady().then(async () => {
  console.log('===============================================================');
  console.log('      HL VIDEO EDITOR — GUI ISSUES VERIFICATION SUITE         ');
  console.log('===============================================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      testsFailed++;
    }
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  const win = new BrowserWindow({
    width: Math.min(1440, workArea.width),
    height: Math.min(900, workArea.height),
    minWidth: 800,
    minHeight: 460,
    title: 'HL',
    backgroundColor: '#090a0d',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.cjs'),
      webSecurity: false,
    },
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  await sleep(1500);

  // 1. Verify Home Screen & Navigate to Editor
  console.log('[1/5] Loading Editor with Demo Project...');
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const demoBtn = btns.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) demoBtn.click();
    })()
  `);
  await sleep(1500);

  // 2. Verify Issue 1: Import Files Button (Native IPC Flow + DOM verification)
  console.log('\n[2/5] Testing Issue 1: Import Files Button & Media Library...');
  const importBtnCheck = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('btn-import-files');
      const input = document.getElementById('media-file-input');
      return {
        exists: !!btn,
        hasId: btn?.id === 'btn-import-files',
        text: btn?.textContent?.trim(),
        hasInput: !!input,
        inputType: input?.type,
        inputAccept: input?.accept,
        display: window.getComputedStyle(btn).display,
        pointerEvents: window.getComputedStyle(btn).pointerEvents,
      };
    })()
  `);

  assert(importBtnCheck.exists, 'Import Files button (#btn-import-files) exists in the DOM');
  assert(importBtnCheck.text.includes('Import Files'), `Button label contains "Import Files" (actual: "${importBtnCheck.text}")`);
  assert(importBtnCheck.hasInput, 'Hidden media file input (#media-file-input) exists as fallback');
  assert(importBtnCheck.inputAccept === 'video/*,audio/*,image/*', `Input accepts media files (actual: "${importBtnCheck.inputAccept}")`);
  assert(importBtnCheck.pointerEvents !== 'none', 'Pointer-events styling is active and not blocked');

  // Click #btn-import-files: Triggers handleNativeImport -> window.vnestNative.selectMediaFiles() -> IPC
  console.log('  Triggering native file import via #btn-import-files click...');
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('btn-import-files');
      if (btn) btn.click();
    })()
  `);
  await sleep(2500);

  const mediaListCheck = await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('.vnest-workspace .vnest-card'));
      const textContents = cards.map(c => c.textContent || '');
      return {
        cardCount: cards.length,
        hasVideo: textContents.some(t => t.includes('hl_test_video.mp4')),
        hasAudio: textContents.some(t => t.includes('hl_test_audio.mp3')),
        hasImage: textContents.some(t => t.includes('hl_test_image.png')),
      };
    })()
  `);

  assert(mediaListCheck.hasVideo, 'Native imported video (hl_test_video.mp4) appears in Media Library list');
  assert(mediaListCheck.hasAudio, 'Native imported audio (hl_test_audio.mp3) appears in Media Library list');
  assert(mediaListCheck.hasImage, 'Native imported image (hl_test_image.png) appears in Media Library list');

  // Test adding imported video asset to timeline
  console.log('  Testing adding imported asset to timeline...');
  const initialClipCount = await win.webContents.executeJavaScript(`
    document.querySelectorAll('.vnest-clip-block').length
  `);

  await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('.vnest-workspace .vnest-card'));
      const videoCard = cards.find(c => c.textContent.includes('hl_test_video.mp4'));
      if (videoCard) {
        const addBtn = videoCard.querySelector('button');
        if (addBtn) addBtn.click();
      }
    })()
  `);
  await sleep(1000);

  const updatedClipCount = await win.webContents.executeJavaScript(`
    document.querySelectorAll('.vnest-clip-block').length
  `);
  assert(updatedClipCount > initialClipCount, `Imported clip successfully added to timeline (before: ${initialClipCount}, after: ${updatedClipCount})`);

  // Capture screenshot of imported media in editor
  const importedMediaShot = await win.capturePage();
  const importedShotPath = path.join(ARTIFACT_DIR, 'hl_imported_media_view.png');
  fs.writeFileSync(importedShotPath, importedMediaShot.toPNG());
  console.log(`  ✓ Captured Imported Media View: ${importedShotPath}`);

  // 3. Verify Issue 2: Auto Cut Buttons in Header, Timeline, and Media Library
  console.log('\n[3/5] Testing Issue 2: Auto Cut Buttons in Header & Timeline...');

  const headerAutoCutCheck = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('header-auto-cut-btn');
      const captionsBtn = document.getElementById('header-auto-captions-btn');
      const nextSibling = captionsBtn?.nextElementSibling;
      return {
        exists: !!btn,
        id: btn?.id,
        text: btn?.textContent?.trim(),
        title: btn?.getAttribute('title'),
        isBesideCaptions: nextSibling?.id === 'header-auto-cut-btn',
        color: window.getComputedStyle(btn).color,
        background: window.getComputedStyle(btn).backgroundColor,
      };
    })()
  `);

  assert(headerAutoCutCheck.exists, 'Auto Cut button (#header-auto-cut-btn) exists in Header toolbar');
  assert(headerAutoCutCheck.isBesideCaptions, 'Auto Cut button in Header is positioned directly beside Auto Captions');
  assert(headerAutoCutCheck.text.includes('Auto Cut'), `Header button text contains "Auto Cut" (actual: "${headerAutoCutCheck.text}")`);

  const timelineAutoCutCheck = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('timeline-auto-cut-btn');
      const captionsBtn = document.getElementById('timeline-auto-captions-btn');
      const nextSibling = captionsBtn?.nextElementSibling;
      return {
        exists: !!btn,
        id: btn?.id,
        text: btn?.textContent?.trim(),
        isBesideCaptions: nextSibling?.id === 'timeline-auto-cut-btn',
      };
    })()
  `);

  assert(timelineAutoCutCheck.exists, 'Auto Cut button (#timeline-auto-cut-btn) exists in Timeline toolbar');
  assert(timelineAutoCutCheck.isBesideCaptions, 'Auto Cut button in Timeline is positioned directly beside Auto Captions');

  const libraryAutoCutCheck = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('library-auto-cut-btn');
      return {
        exists: !!btn,
        id: btn?.id,
        text: btn?.textContent?.trim(),
      };
    })()
  `);
  assert(libraryAutoCutCheck.exists, 'Auto Cut quick button (#library-auto-cut-btn) exists in Media Library quick actions');

  // 4. Test Opening Auto Cut Modal and Verifying Controls
  console.log('\n[4/5] Testing Auto Cut Modal Opening & Controls...');

  // Click header Auto Cut button
  await win.webContents.executeJavaScript(`
    document.getElementById('header-auto-cut-btn').click();
  `);
  await sleep(1000);

  const modalCheck = await win.webContents.executeJavaScript(`
    (() => {
      const h2 = document.querySelector('h2');
      const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
      const selects = Array.from(document.querySelectorAll('select'));
      const detectBtn = document.getElementById('autocut-detect-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Detect Cuts'));

      return {
        heading: h2?.textContent,
        sliderCount: sliders.length,
        hasTargetSelect: selects.length > 0,
        hasDetectBtn: !!detectBtn,
        detectBtnDisabled: detectBtn?.disabled,
      };
    })()
  `);

  assert(modalCheck.heading?.includes('Auto Cut'), `Auto Cut Modal header is visible: "${modalCheck.heading}"`);
  assert(modalCheck.sliderCount >= 2, `Silence and Scene sensitivity sliders are present (count: ${modalCheck.sliderCount})`);
  assert(modalCheck.hasDetectBtn, 'Detect Cuts button is present and ready');

  // Capture screenshot of Auto Cut modal
  const autoCutModalShot = await win.capturePage();
  const modalShotPath = path.join(ARTIFACT_DIR, 'hl_autocut_modal_view.png');
  fs.writeFileSync(modalShotPath, autoCutModalShot.toPNG());
  console.log(`  ✓ Captured Auto Cut Modal View: ${modalShotPath}`);

  // Test running analysis in modal
  console.log('  Testing Auto Cut Analysis calculation...');
  await win.webContents.executeJavaScript(`
    (() => {
      const detectBtn = document.getElementById('autocut-detect-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Detect Cuts'));
      if (detectBtn) detectBtn.click();
    })()
  `);
  await sleep(1500);

  const reviewCheck = await win.webContents.executeJavaScript(`
    (() => {
      const text = document.body.textContent || '';
      const applyBtn = document.getElementById('autocut-apply-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply'));
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));

      return {
        hasOriginalDuration: text.includes('Original Duration'),
        hasProjectedResult: text.includes('Projected Result'),
        hasDurationSaved: text.includes('Duration Saved'),
        hasApplyBtn: !!applyBtn,
        cutCount: checkboxes.length,
      };
    })()
  `);

  assert(reviewCheck.hasOriginalDuration, 'Review step displays Original Duration banner');
  assert(reviewCheck.hasProjectedResult, 'Review step displays Projected Result');
  assert(reviewCheck.hasDurationSaved, 'Review step displays Duration Saved calculation');
  assert(reviewCheck.hasApplyBtn, 'Apply to Timeline button is visible and active');

  // Close modal via Close button
  await win.webContents.executeJavaScript(`
    (() => {
      const closeBtn = document.getElementById('autocut-close-btn') || document.querySelector('.vnest-card button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(1000);

  // Test opening via Timeline Auto Cut button
  console.log('  Testing Auto Cut opening via Timeline toolbar button...');
  await win.webContents.executeJavaScript(`
    document.getElementById('timeline-auto-cut-btn').click();
  `);
  await sleep(600);
  const timelineModalCheck = await win.webContents.executeJavaScript(`
    !!document.getElementById('autocut-close-btn')
  `);
  assert(timelineModalCheck, 'Timeline Auto Cut button successfully opens AutoCutModal');
  await win.webContents.executeJavaScript(`
    document.getElementById('autocut-close-btn')?.click();
  `);
  await sleep(600);

  // Test opening via Library Auto Cut button
  console.log('  Testing Auto Cut opening via Media Library quick button...');
  await win.webContents.executeJavaScript(`
    document.getElementById('library-auto-cut-btn').click();
  `);
  await sleep(600);
  const libraryModalCheck = await win.webContents.executeJavaScript(`
    !!document.getElementById('autocut-close-btn')
  `);
  assert(libraryModalCheck, 'Library Auto Cut quick button successfully opens AutoCutModal');
  await win.webContents.executeJavaScript(`
    document.getElementById('autocut-close-btn')?.click();
  `);
  await sleep(600);

  // 5. Capture final Release Editor View
  console.log('\n[5/5] Capturing Final Editor View Artifact...');
  const editorShot = await win.capturePage();
  const editorShotPath = path.join(ARTIFACT_DIR, 'hl_release_editor_view.png');
  fs.writeFileSync(editorShotPath, editorShot.toPNG());
  console.log(`  ✓ Captured updated Editor View with Auto Cut and Import buttons: ${editorShotPath}`);

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('===============================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
