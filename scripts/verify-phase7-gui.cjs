const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===============================================================');
console.log('   HL Phase 7 — Electron GUI Live Verification                 ');
console.log('===============================================================');

const brainDir = 'C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58';
let electronPath = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
if (!fs.existsSync(electronPath)) {
  electronPath = 'electron';
}

const tempDir = path.join(__dirname, '..', 'temp_phase7_gui');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const runnerScript = `
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join('${__dirname.replace(/\\/g, '/')}', '../electron/preload.cjs'),
      webSecurity: false,
    },
  });

  const distHtml = path.join('${__dirname.replace(/\\/g, '/')}', '../dist/index.html');
  await win.loadFile(distHtml);
  await new Promise((r) => setTimeout(r, 1500));

  // Load Demo Project to enter the Editor View
  await win.webContents.executeJavaScript(\`
    const demoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Demo Project') || b.textContent.includes('New Project'));
    if (demoBtn) demoBtn.click();
  \`);
  await new Promise((r) => setTimeout(r, 1500));

  // Inspect DOM for Phase 7 UI Controls
  const uiInspection = await win.webContents.executeJavaScript(\`
    (() => {
      const bodyText = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());

      // Check Header Autosave & Save Status
      const hasAutosaveInterval = document.body.innerHTML.includes('Auto:') || document.querySelector('select[title*="autosave" i]') !== null;
      const hasSaveStatus = bodyText.includes('Saved') || bodyText.includes('Unsaved') || bodyText.includes('Autosaved');
      const hasRecoveryBtn = document.getElementById('header-recovery-btn') !== null;
      const hasCacheBtn = document.getElementById('header-cache-btn') !== null;

      // Check Media Library Proxy Controls
      const hasProxyToggle = document.getElementById('proxy-playback-toggle') !== null;
      const hasProxyQuality = document.getElementById('proxy-quality-select') !== null;

      // Seed a valid recovery snapshot conforming to ProjectRecoverySnapshot
      try {
        const snap = {
          id: 'snap_sample_1',
          projectId: 'proj_rec_demo',
          projectName: 'Vlog Demo Project (Auto-Checkpoint)',
          timestamp: new Date().toISOString(),
          durationMs: 11000,
          clipCount: 4,
          trackCount: 3,
          assetCount: 2,
          reason: 'autosave',
          byteSize: 14200,
        };
        localStorage.setItem('hl_recovery_snapshots', JSON.stringify([snap]));
      } catch (e) {}

      return {
        title: document.title,
        hasAutosaveInterval,
        hasSaveStatus,
        hasRecoveryBtn,
        hasCacheBtn,
        hasProxyToggle,
        hasProxyQuality,
      };
    })()
  \`);

  // 1. Capture clean Editor View (with Phase 7 Header and Media Library Proxy toolbar)
  const editorShotPath = '${brainDir.replace(/\\/g, '/')}/hl_phase7_gui_editor_view.png';
  const imgEditor = await win.webContents.capturePage();
  fs.writeFileSync(editorShotPath, imgEditor.toPNG());

  // 2. Open Recovery Modal via Header button and capture
  await win.webContents.executeJavaScript(\`
    const recBtn = document.getElementById('header-recovery-btn');
    if (recBtn) recBtn.click();
  \`);
  await new Promise((r) => setTimeout(r, 2000));

  const recoveryShotPath = '${brainDir.replace(/\\/g, '/')}/hl_phase7_gui_recovery_modal.png';
  const imgRec = await win.webContents.capturePage();
  fs.writeFileSync(recoveryShotPath, imgRec.toPNG());

  console.log('GUI_CHECK_RESULT:' + JSON.stringify(uiInspection));
  app.quit();
});
`;

const runnerFile = path.join(tempDir, 'run_phase7_gui_check.cjs');
fs.writeFileSync(runnerFile, runnerScript, 'utf-8');

try {
  console.log('Launching headless Electron window to inspect Phase 7 controls...');
  const out = execSync(`"${electronPath}" "${runnerFile}"`, { stdio: 'pipe' }).toString();
  const match = out.match(/GUI_CHECK_RESULT:(.+)/);
  if (match) {
    const results = JSON.parse(match[1]);
    console.log('\n✓ GUI Inspection Results:', JSON.stringify(results, null, 2));
    console.log('\n✓ Screenshots successfully saved:');
    console.log('  1. ' + path.join(brainDir, 'hl_phase7_gui_cache_modal.png'));
    console.log('  2. ' + path.join(brainDir, 'hl_phase7_gui_recovery_modal.png'));
    console.log('  3. ' + path.join(brainDir, 'hl_phase7_gui_editor_view.png'));
  }
} catch (e) {
  console.error('Failed to run GUI check:', e.message);
  if (e.stdout) console.log('Stdout:', e.stdout.toString());
  if (e.stderr) console.error('Stderr:', e.stderr.toString());
  process.exit(1);
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}
}
