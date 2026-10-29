const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    backgroundColor: '#090a0d',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.cjs'),
      webSecurity: false,
    }
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  
  await new Promise(r => setTimeout(r, 1200));

  // Enter demo project
  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const demo = btns.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
    if (demo) demo.click();
  `);
  await new Promise(r => setTimeout(r, 1500));

  // Click on first clip
  await win.webContents.executeJavaScript(`
    const clip = document.querySelector('.vnest-clip-block');
    if (clip) clip.click();
  `);
  await new Promise(r => setTimeout(r, 600));

  // Click Keyframes button
  await win.webContents.executeJavaScript(`
    const btn = document.querySelector('button[title*="Open Keyframe Graph Editor"]');
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));

  const image = await win.capturePage();
  const outPath = 'C:\\\\Users\\\\sahil\\\\.gemini\\\\antigravity-ide\\\\brain\\\\da1850a6-1c43-40eb-a3bd-acecc46fbe58\\\\hl_phase5_keyframe_graph_editor.png';
  fs.writeFileSync(outPath, image.toPNG());
  console.log('Saved keyframe graph screenshot to:', outPath);

  app.quit();
});
