const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Attempt to click the first recent project card
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const recentCards = document.querySelectorAll('.vnest-card');
      // Look for a card inside the Recent Projects section
      const recentSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Recent Projects'));
      if (!recentSection) return { error: 'Recent Projects section not found' };

      const sectionParent = recentSection.closest('section');
      const cards = sectionParent ? sectionParent.querySelectorAll('.vnest-card') : [];
      if (cards.length === 0) return { error: 'No recent project cards found in DOM' };

      const firstCard = cards[0];
      const cardTitle = firstCard.querySelector('h4')?.textContent || 'Unknown';

      // Record state before click
      const viewBefore = document.querySelector('.vnest-workspace') ? 'editor' : 'home';

      // Click the card
      firstCard.click();

      // Wait 500ms to see if view changes to editor
      await new Promise(r => setTimeout(r, 500));

      const viewAfter = document.querySelector('.vnest-workspace') ? 'editor' : 'home';

      return {
        cardTitle,
        viewBefore,
        viewAfter,
        didOpen: viewAfter === 'editor',
      };
    })()
  `);

  console.log('--- REPRODUCTION TEST RESULT ---');
  console.log('Result:', JSON.stringify(result, null, 2));

  if (!result.didOpen) {
    console.log('CONFIRMED BUG: Clicking recent project card failed to open the project into editor view!');
  } else {
    console.log('BUG RESOLVED: Clicking recent project card successfully opened the project into editor view!');
  }

  app.quit();
});
