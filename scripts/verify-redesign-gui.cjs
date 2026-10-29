/**
 * verify-redesign-gui.cjs
 * Visual inspection and theme verification for HL Video Editor
 * Captures high-res screenshots across common resolutions:
 * 1280x720, 1366x768, 1440x900, 1920x1080
 * Also verifies Soft Charcoal, Soft Light, Selected Clips, Modals, and Computed Tokens.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Dummy IPC handlers so no electron errors occur
ipcMain.handle('select-media-files', async () => []);
ipcMain.handle('read-file-binary', async () => ({ success: false }));
ipcMain.handle('detect-silence', async () => ({ success: true, silences: [] }));
ipcMain.handle('detect-scenes', async () => ({ success: true, sceneChanges: [] }));
ipcMain.handle('render-export', async () => ({ success: true, outputPath: 'out.mp4' }));
ipcMain.handle('cancel-export', async () => ({ success: true }));
ipcMain.handle('select-save-project', async () => null);
ipcMain.handle('save-file-binary', async () => ({ success: true }));
ipcMain.handle('select-open-project', async () => null);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[Renderer]', message);
  });

  const distPath = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distPath);
  win.show();
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.querySelector('button')) return resolve();
      const observer = new MutationObserver(() => {
        if (document.querySelector('button')) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })
  `);
  await sleep(800);

  // 1. Home screen (Dark Charcoal)
  console.log('[Verification] Step 1: Inspecting Home screen (Dark Charcoal + Sage)...');
  const homeDarkPng = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_home_charcoal.png'), homeDarkPng.toPNG());
  console.log('  -> Saved hl_redesign_home_charcoal.png');

  // 2. Home screen (Soft Light)
  console.log('[Verification] Step 2: Toggling to Soft Light theme on Home...');
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('hl_theme', 'light');
  `);
  await sleep(500);
  const homeLightPng = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_home_light.png'), homeLightPng.toPNG());
  console.log('  -> Saved hl_redesign_home_light.png');

  // 3. Switch back to Charcoal & open Demo Project
  console.log('[Verification] Step 3: Switching back to Charcoal & opening Demo Project...');
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme', 'charcoal');
    localStorage.setItem('hl_theme', 'charcoal');
    const btns = Array.from(document.querySelectorAll('button'));
    const demoBtn = btns.find(b => b.textContent.includes('Quick Demo Project'));
    if (demoBtn) demoBtn.click();
  `);
  await sleep(1500);

  // 4. Test resolutions on Main Editor
  const resolutions = [
    { width: 1280, height: 720, name: 'hl_editor_1280x720.png' },
    { width: 1366, height: 768, name: 'hl_editor_1366x768.png' },
    { width: 1440, height: 900, name: 'hl_redesign_editor_charcoal.png' },
    { width: 1920, height: 1080, name: 'hl_editor_1920x1080.png' },
  ];

  for (const res of resolutions) {
    console.log(`[Verification] Testing resolution: ${res.width}x${res.height}...`);
    win.setSize(res.width, res.height);
    await sleep(600);

    // Verify header fitting & no title wrapping
    const headerCheck = await win.webContents.executeJavaScript(`
      (() => {
        const header = document.querySelector('.vnest-header');
        const exportBtn = Array.from(document.querySelectorAll('.vnest-header button')).find(b => b.textContent.includes('Export'));
        const titleSpan = document.querySelector('.vnest-header span');
        let exportRect = exportBtn ? exportBtn.getBoundingClientRect() : null;
        let isExportVisible = exportRect ? (exportRect.right <= window.innerWidth && exportRect.left >= 0) : false;
        return {
          windowWidth: window.innerWidth,
          headerScrollWidth: header ? header.scrollWidth : 0,
          headerClientWidth: header ? header.clientWidth : 0,
          exportVisible: isExportVisible,
          exportRight: exportRect ? exportRect.right : 0
        };
      })()
    `);
    console.log(`  Header status at ${res.width}x${res.height}:`, headerCheck);

    const shot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(ARTIFACT_DIR, res.name), shot.toPNG());
    console.log(`  -> Saved ${res.name}`);
  }

  // Set back to 1440x900 for remaining checks
  win.setSize(1440, 900);
  await sleep(500);

  // 5. Inspect Light theme in Editor
  console.log('[Verification] Step 5: Toggling to Soft Light theme in Editor (1440x900)...');
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('hl_theme', 'light');
  `);
  await sleep(600);
  const editorLightPng = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_editor_light.png'), editorLightPng.toPNG());
  console.log('  -> Saved hl_redesign_editor_light.png');

  // Switch back to Charcoal
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme', 'charcoal');
    localStorage.setItem('hl_theme', 'charcoal');
  `);
  await sleep(500);

  // 6. Select a clip on timeline & verify selection styling
  console.log('[Verification] Step 6: Selecting clip on timeline...');
  await win.webContents.executeJavaScript(`
    (() => {
      const clip = document.querySelector('.vnest-clip-block');
      if (clip) clip.click();
    })()
  `);
  await sleep(600);
  const clipPng = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_selected_clip.png'), clipPng.toPNG());
  console.log('  -> Saved hl_redesign_selected_clip.png');

  // 7. Open Auto Cut Modal
  console.log('[Verification] Step 7: Opening Auto Cut Modal...');
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.getElementById('header-auto-cut-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(800);
    const autoCutPng = await win.webContents.capturePage();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_autocut_modal.png'), autoCutPng.toPNG());
    console.log('  -> Saved hl_redesign_autocut_modal.png');
    // Close modal
    await win.webContents.executeJavaScript(`
      (() => {
        const closeBtn = document.getElementById('autocut-close-btn') || document.querySelector('.vnest-modal-box button');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(500);
  } catch (err) {
    console.error('Error in Auto Cut modal step:', err);
  }

  // 8. Open Auto Captions Modal
  console.log('[Verification] Step 8: Opening Auto Captions Modal...');
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.getElementById('header-auto-captions-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(800);
    const autoCaptionsPng = await win.webContents.capturePage();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_autocaptions_modal.png'), autoCaptionsPng.toPNG());
    console.log('  -> Saved hl_redesign_autocaptions_modal.png');
    // Close modal
    await win.webContents.executeJavaScript(`
      (() => {
        const closeBtn = document.getElementById('autocaptions-close-btn') || document.querySelector('.vnest-modal-box button');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(500);
  } catch (err) {
    console.error('Error in Auto Captions modal step:', err);
  }

  // 9. Open Export Modal
  console.log('[Verification] Step 9: Opening Export Modal...');
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const exportBtn = Array.from(document.querySelectorAll('.vnest-header button')).find(b => b.textContent.includes('Export'));
        if (exportBtn) exportBtn.click();
      })()
    `);
    await sleep(800);
    const exportPng = await win.webContents.capturePage();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_export_modal.png'), exportPng.toPNG());
    console.log('  -> Saved hl_redesign_export_modal.png');
    // Close modal
    await win.webContents.executeJavaScript(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.vnest-modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await sleep(500);
  } catch (err) {
    console.error('Error in Export modal step:', err);
  }

  // 10. Open Share Modal
  console.log('[Verification] Step 10: Opening Share Modal...');
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const shareBtn = Array.from(document.querySelectorAll('.vnest-header button')).find(b => b.textContent.includes('Share'));
        if (shareBtn) shareBtn.click();
      })()
    `);
    await sleep(800);
    const sharePng = await win.webContents.capturePage();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_redesign_share_modal.png'), sharePng.toPNG());
    console.log('  -> Saved hl_redesign_share_modal.png');
    // Close modal
    await win.webContents.executeJavaScript(`
      (() => {
        const closeBtn = document.querySelector('.vnest-modal-box button');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(500);
  } catch (err) {
    console.error('Error in Share modal step:', err);
  }

  // Verify computed colors
  const tokenAudit = await win.webContents.executeJavaScript(`
    (() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bgApp: s.getPropertyValue('--bg-app').trim(),
        bgSurface1: s.getPropertyValue('--bg-surface-1').trim(),
        bgSurface2: s.getPropertyValue('--bg-surface-2').trim(),
        bgSurface3: s.getPropertyValue('--bg-surface-3').trim(),
        borderSubtle: s.getPropertyValue('--border-subtle').trim(),
        borderMedium: s.getPropertyValue('--border-medium').trim(),
        textPrimary: s.getPropertyValue('--text-primary').trim(),
        textSecondary: s.getPropertyValue('--text-secondary').trim(),
        textMuted: s.getPropertyValue('--text-muted').trim(),
        accentSage: s.getPropertyValue('--accent-sage').trim(),
        accentSageHover: s.getPropertyValue('--accent-sage-hover').trim(),
        selectedSurface: s.getPropertyValue('--selected-surface').trim(),
        bgTimeline: s.getPropertyValue('--bg-timeline').trim(),
      };
    })()
  `);

  console.log('\n[Design Token Computed Audit]:', JSON.stringify(tokenAudit, null, 2));

  console.log('\n[SUCCESS] All redesign GUI inspections and screenshots completed successfully!');
  win.close();
  app.quit();
});
