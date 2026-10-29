const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

  console.log('--- VERIFYING USER RECENT PROJECTS IN LIVE ELECTRON ---');

  const report = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const recentSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards = recentSection ? Array.from(recentSection.querySelectorAll('.vnest-card')) : [];
      if (cards.length === 0) return { error: 'No recent cards found' };

      const card0 = cards[0];
      const card0Title = card0.querySelector('h4')?.textContent || '';

      // 1. Click card 0
      card0.click();
      await sleep(700);

      const isEditor0 = !!document.querySelector('.vnest-workspace');
      const clips0 = document.querySelectorAll('.vnest-clip-block').length;

      // Return to home
      const homeBtn0 = document.querySelector('button[title*="Return to Home screen"]');
      if (homeBtn0) {
        homeBtn0.click();
        await sleep(600);
      }

      // 2. Click card 1
      const section1 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards1 = section1 ? Array.from(section1.querySelectorAll('.vnest-card')) : [];
      const card1 = cards1[1];
      const card1Title = card1 ? card1.querySelector('h4')?.textContent : '';

      if (card1) {
        card1.click();
        await sleep(700);
      }

      const isEditor1 = !!document.querySelector('.vnest-workspace');
      const clips1 = document.querySelectorAll('.vnest-clip-block').length;

      // Return to home
      const homeBtn1 = document.querySelector('button[title*="Return to Home screen"]');
      if (homeBtn1) {
        homeBtn1.click();
        await sleep(600);
      }

      // 3. Click missing card (card 2)
      const section2 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'))?.closest('section');
      const cards2 = section2 ? Array.from(section2.querySelectorAll('.vnest-card')) : [];
      const card2 = cards2[2];
      const card2Title = card2 ? card2.querySelector('h4')?.textContent : '';

      if (card2) {
        card2.click();
        await sleep(600);
      }

      const isEditor2 = !!document.querySelector('.vnest-workspace');
      const toast2 = document.querySelector('.vnest-toast')?.textContent || '';

      return {
        card0: { title: card0Title, opened: isEditor0, clips: clips0 },
        card1: { title: card1Title, opened: isEditor1, clips: clips1 },
        card2: { title: card2Title, stayedOnHome: !isEditor2, toast: toast2 },
      };
    })()
  `);

  console.log('Live Electron Result:', JSON.stringify(report, null, 2));

  const success = report.card0.opened && report.card0.clips > 0 &&
                  report.card1.opened && report.card1.clips > 0 &&
                  report.card0.clips !== report.card1.clips &&
                  report.card2.stayedOnHome;

  if (success) {
    console.log('\n>>> LIVE ELECTRON RECENT PROJECT OPENING VERIFIED SUCCESSFUL! <<<');
  } else {
    console.error('\n>>> LIVE ELECTRON VERIFICATION FAILED! <<<');
    process.exitCode = 1;
  }

  app.quit();
});
