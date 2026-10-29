const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1200,
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
  await new Promise(r => setTimeout(r, 1500));

  // Reset timeline height in localStorage so middle workspace has full 850px height
  await win.webContents.executeJavaScript(`
    (() => {
      localStorage.setItem('vnest_timeline_height', '260');
      const btns = Array.from(document.querySelectorAll('button'));
      const demoBtn = btns.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) demoBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  // Select video clip
  await win.webContents.executeJavaScript(`
    (() => {
      const allClips = Array.from(document.querySelectorAll('.vnest-clip-block'));
      const videoClip = allClips.find(c => c.textContent && c.textContent.includes('Scenic Flight')) || allClips[allClips.length - 1];
      if (videoClip) {
        videoClip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        videoClip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  // Check workspace and sidebar dimensions
  const dims = await win.webContents.executeJavaScript(`
    (() => {
      const sidebar = document.querySelector('.vnest-sidebar-right');
      const workspace = document.querySelector('.vnest-workspace');
      return {
        workspaceHeight: workspace ? workspace.clientHeight : null,
        sidebarHeight: sidebar ? sidebar.clientHeight : null,
        sidebarScrollHeight: sidebar ? sidebar.scrollHeight : null,
      };
    })()
  `);
  console.log('DIMENSIONS:', dims);

  // Scroll to Color Adjustments
  await win.webContents.executeJavaScript(`
    (() => {
      const sidebar = document.querySelector('.vnest-sidebar-right');
      if (sidebar) sidebar.scrollTop = 1600;
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const imgWheels = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58/hl_phase6_color_wheels_gui.png', imgWheels.toPNG());

  // Scroll to Audio Processing
  await win.webContents.executeJavaScript(`
    (() => {
      const sidebar = document.querySelector('.vnest-sidebar-right');
      if (sidebar) sidebar.scrollTop = 1100;
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const imgAudio = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58/hl_phase6_audio_processing_gui.png', imgAudio.toPNG());

  console.log('CAPTURED_PHASE6_VIEWS_SUCCESS');
  app.quit();
});
