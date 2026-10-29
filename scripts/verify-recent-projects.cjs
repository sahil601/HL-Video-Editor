const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Register IPC handler for read-file-binary
ipcMain.handle('read-file-binary', async (event, targetPath) => {
  try {
    const buffer = fs.readFileSync(targetPath);
    return { success: true, buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(__dirname, '../dist/index.html'));

  console.log('--- RECENT PROJECTS REGRESSION VERIFICATION (ELECTRON LIVE DOM) ---');

  // Create temporary invalid .vnest file
  const tempCorruptPath = path.join(__dirname, '../temp_corrupt_test.vnest');
  fs.writeFileSync(tempCorruptPath, 'CORRUPT_RAW_BYTES_NOT_A_VALID_ZIP_PACKAGE_12345');

  // 1. Seed localStorage with test project data
  await win.webContents.executeJavaScript(`
    (() => {
      // Backup original recents if any
      const orig = localStorage.getItem('vnest_recent_projects');
      if (orig) sessionStorage.setItem('orig_recents_backup', orig);

      const dupName = 'Summer Vlog Showcase';
      const p1Id = 'proj_dup_test_alpha';
      const p2Id = 'proj_dup_test_beta';
      const missingId = 'proj_missing_file_entry';
      const corruptId = 'proj_corrupt_file_entry';

      const p1 = {
        schemaVersion: '1.0.0',
        generator: 'hl',
        id: p1Id,
        name: dupName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: { width: 1920, height: 1080, fps: 30, aspectRatio: '16:9', sampleRate: 48000, backgroundColor: '#000000' },
        assets: [],
        tracks: [
          { id: 't0', type: 'text', name: 'Text', order: 0, isMuted: false, isLocked: false, clips: [] },
          { id: 't1', type: 'overlay', name: 'PIP', order: 1, isMuted: false, isLocked: false, clips: [] },
          { id: 't2', type: 'video', name: 'Video', order: 2, isMuted: false, isLocked: false, clips: [
            { id: 'clip_p1_a', trackId: 't2', name: 'Alpha Clip 1', type: 'video', startMs: 0, durationMs: 2500, sourceStartMs: 0, sourceEndMs: 2500, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] },
            { id: 'clip_p1_b', trackId: 't2', name: 'Alpha Clip 2', type: 'video', startMs: 2500, durationMs: 2500, sourceStartMs: 0, sourceEndMs: 2500, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] },
          ]},
        ],
        durationMs: 5000,
      };

      const p2 = {
        schemaVersion: '1.0.0',
        generator: 'hl',
        id: p2Id,
        name: dupName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: { width: 1920, height: 1080, fps: 30, aspectRatio: '16:9', sampleRate: 48000, backgroundColor: '#000000' },
        assets: [],
        tracks: [
          { id: 't0', type: 'text', name: 'Text', order: 0, isMuted: false, isLocked: false, clips: [
            { id: 'clip_p2_txt', trackId: 't0', name: 'Beta Title', type: 'text', startMs: 0, durationMs: 4000, sourceStartMs: 0, sourceEndMs: 4000, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] }
          ]},
          { id: 't1', type: 'overlay', name: 'PIP', order: 1, isMuted: false, isLocked: false, clips: [] },
          { id: 't2', type: 'video', name: 'Video', order: 2, isMuted: false, isLocked: false, clips: [
            { id: 'clip_p2_a', trackId: 't2', name: 'Beta Clip 1', type: 'video', startMs: 0, durationMs: 3000, sourceStartMs: 0, sourceEndMs: 3000, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] },
            { id: 'clip_p2_b', trackId: 't2', name: 'Beta Clip 2', type: 'video', startMs: 3000, durationMs: 3000, sourceStartMs: 0, sourceEndMs: 3000, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] },
            { id: 'clip_p2_c', trackId: 't2', name: 'Beta Clip 3', type: 'video', startMs: 6000, durationMs: 4000, sourceStartMs: 0, sourceEndMs: 4000, speed: 1, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 }, keyframes: [] },
          ]},
        ],
        durationMs: 10000,
      };

      localStorage.setItem('vnest_project_' + p1Id, JSON.stringify(p1));
      localStorage.setItem('vnest_project_' + p2Id, JSON.stringify(p2));

      const testRecents = [
        { id: p1Id, name: dupName, updatedAt: new Date().toISOString(), durationMs: 5000, clipCount: 2, assetCount: 0 },
        { id: p2Id, name: dupName, updatedAt: new Date().toISOString(), durationMs: 10000, clipCount: 4, assetCount: 0 },
        { id: missingId, name: 'Missing File Test', updatedAt: new Date().toISOString(), durationMs: 2000, clipCount: 1, assetCount: 0, filePath: 'C:/fake_missing_dir/missing_project.vnest' },
        { id: corruptId, name: 'Corrupt File Test', updatedAt: new Date().toISOString(), durationMs: 2000, clipCount: 1, assetCount: 0, filePath: ${JSON.stringify(tempCorruptPath)} },
      ];

      localStorage.setItem('vnest_recent_projects', JSON.stringify(testRecents));
    })()
  `);

  // Reload window to reflect seeded localStorage state
  await win.reload();
  await new Promise(r => setTimeout(r, 600));

  const testResults = [];

  // Step 1: Open Project 1 (Duplicate Name, 2 clips)
  const res1 = await win.webContents.executeJavaScript(`
    (async () => {
      const section = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards = section ? Array.from(section.querySelectorAll('.vnest-card')) : [];
      if (cards.length === 0) return { error: 'No recent cards found' };

      // Click card 0 (Alpha)
      cards[0].click();
      await new Promise(r => setTimeout(r, 600));

      const isEditor = !!document.querySelector('.vnest-workspace');
      const clips = document.querySelectorAll('.vnest-clip-block').length;

      return {
        didOpen: isEditor,
        clipCount: clips,
      };
    })()
  `);

  testResults.push({
    test: '1. Open Project Alpha (Duplicate Display Name, 2 clips)',
    passed: res1.didOpen && res1.clipCount === 2,
    details: res1,
  });

  // Step 2: Navigate back to Home via Header button
  await win.webContents.executeJavaScript(`
    (() => {
      const homeBtn = document.querySelector('button[title*="Return to Home screen"]');
      if (homeBtn) homeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Step 3: Open Project 2 (Duplicate Name, 4 clips)
  const res2 = await win.webContents.executeJavaScript(`
    (async () => {
      const section = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards = section ? Array.from(section.querySelectorAll('.vnest-card')) : [];
      if (cards.length < 2) return { error: 'Card 2 not found' };

      // Click card 1 (Beta)
      cards[1].click();
      await new Promise(r => setTimeout(r, 600));

      const isEditor = !!document.querySelector('.vnest-workspace');
      const clips = document.querySelectorAll('.vnest-clip-block').length;

      return {
        didOpen: isEditor,
        clipCount: clips,
      };
    })()
  `);

  testResults.push({
    test: '2. Open Project Beta (Duplicate Display Name, Independent 4 clips)',
    passed: res2.didOpen && res2.clipCount === 4,
    details: res2,
  });

  // Return to Home
  await win.webContents.executeJavaScript(`
    (() => {
      const homeBtn = document.querySelector('button[title*="Return to Home screen"]');
      if (homeBtn) homeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Step 4: Missing Project File Card
  const resMissing = await win.webContents.executeJavaScript(`
    (async () => {
      const section = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards = section ? Array.from(section.querySelectorAll('.vnest-card')) : [];
      const missingCard = cards.find(c => c.querySelector('h4')?.textContent.includes('Missing File'));
      if (!missingCard) return { error: 'Missing file card not found' };

      missingCard.click();
      await new Promise(r => setTimeout(r, 600));

      const isEditor = !!document.querySelector('.vnest-workspace');
      const toast = document.querySelector('.vnest-toast')?.textContent || '';

      return {
        remainedOnHome: !isEditor,
        toastMessage: toast,
      };
    })()
  `);

  testResults.push({
    test: '3. Missing Project File Handling (Non-existent path)',
    passed: resMissing.remainedOnHome && resMissing.toastMessage.includes('not found'),
    details: resMissing,
  });

  // Step 5: Corrupt Project File Card
  const resCorrupt = await win.webContents.executeJavaScript(`
    (async () => {
      const section = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards = section ? Array.from(section.querySelectorAll('.vnest-card')) : [];
      const corruptCard = cards.find(c => c.querySelector('h4')?.textContent.includes('Corrupt File'));
      if (!corruptCard) return { error: 'Corrupt file card not found' };

      corruptCard.click();
      await new Promise(r => setTimeout(r, 600));

      const isEditor = !!document.querySelector('.vnest-workspace');
      const toast = document.querySelector('.vnest-toast')?.textContent || '';

      return {
        remainedOnHome: !isEditor,
        toastMessage: toast,
      };
    })()
  `);

  testResults.push({
    test: '4. Corrupt Project File Handling (Invalid ZIP archive)',
    passed: resCorrupt.remainedOnHome && (resCorrupt.toastMessage.includes('Failed') || resCorrupt.toastMessage.includes('corrupted') || resCorrupt.toastMessage.includes('invalid')),
    details: resCorrupt,
  });

  // Restore original recents and remove temp corrupt file
  await win.webContents.executeJavaScript(`
    (() => {
      const backup = sessionStorage.getItem('orig_recents_backup');
      if (backup) {
        localStorage.setItem('vnest_recent_projects', backup);
      }
    })()
  `);

  try {
    if (fs.existsSync(tempCorruptPath)) fs.unlinkSync(tempCorruptPath);
  } catch (e) {}

  console.log('\n--- TEST RESULTS SUMMARY ---');
  for (const r of testResults) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log('       Details:', JSON.stringify(r.details));
  }

  const allPassed = testResults.every(r => r.passed);
  if (allPassed) {
    console.log('\n>>> ALL 4 ELECTRON RECENT PROJECT REGRESSION TESTS PASSED! <<<');
  } else {
    console.error('\n>>> SOME REGRESSION TESTS FAILED! <<<');
    process.exitCode = 1;
  }

  app.quit();
});
