const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/da1850a6-1c43-40eb-a3bd-acecc46fbe58';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('--- Starting VNest Desktop & Browser Layout Verification ---');

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  console.log('Screen Work Area:', workArea, 'scaleFactor:', primaryDisplay.scaleFactor);

  // 1. Create BrowserWindow with useContentSize and fitting work area
  const win = new BrowserWindow({
    width: Math.min(1440, workArea.width),
    height: Math.min(900, workArea.height),
    minWidth: 800,
    minHeight: 460,
    useContentSize: true,
    backgroundColor: '#090a0d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  await sleep(1200);

  // Load Quick Demo Project
  console.log('Loading Quick Demo Project...');
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const demoBtn = buttons.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) demoBtn.click();
    })()
  `);
  await sleep(1200);

  async function getDetailedMetrics(label) {
    return await win.webContents.executeJavaScript(`
      (() => {
        const winH = window.innerHeight;
        const winW = window.innerWidth;

        const getBox = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            selector: sel,
            width: Math.round(r.width),
            height: Math.round(r.height),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            isInsideWindow: r.bottom <= winH + 1 && r.top >= -1,
          };
        };

        const tracks = Array.from(document.querySelectorAll('.vnest-timeline-track-row')).map((el, i) => {
          const r = el.getBoundingClientRect();
          return {
            trackIndex: i,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            height: Math.round(r.height),
            isVisibleInViewport: r.bottom <= winH + 1,
          };
        });

        const headers = Array.from(document.querySelectorAll('.vnest-timeline-track-header')).map((el, i) => {
          const r = el.getBoundingClientRect();
          return {
            headerIndex: i,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            height: Math.round(r.height),
            isVisibleInViewport: r.bottom <= winH + 1,
          };
        });

        const clips = Array.from(document.querySelectorAll('.vnest-clip-block')).map(c => ({
          text: c.textContent.trim(),
          width: c.offsetWidth,
          left: c.offsetLeft,
        }));

        return {
          window: { innerWidth: winW, innerHeight: winH, dpr: window.devicePixelRatio },
          appContainer: getBox('.vnest-app-container'),
          header: getBox('.vnest-header'),
          workspace: getBox('.vnest-workspace'),
          previewCenter: getBox('.vnest-preview-center'),
          timelineContainer: getBox('.vnest-timeline-container'),
          timelineBody: getBox('.vnest-timeline-body'),
          timelineLanesScroll: getBox('.vnest-timeline-lanes-scroll'),
          tracks,
          headers,
          clipsCount: clips.length,
          clips,
        };
      })()
    `);
  }

  // A. Verification at 1600x900
  console.log('\n--- Testing at 1600x900 ---');
  win.setContentSize(1600, 900);
  await sleep(600);
  const m1600 = await getDetailedMetrics('1600x900');
  console.log('1600x900 Metrics Summary:', {
    window: m1600.window,
    timelineContainer: m1600.timelineContainer,
    allTracksVisible: m1600.tracks.every(t => t.isVisibleInViewport),
    tracks: m1600.tracks,
  });
  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(200);
  const img1600 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_desktop_1600x900_fixed.png'), img1600.toPNG());
  console.log('Saved vnest_desktop_1600x900_fixed.png');

  // B. Verification at 1280x720
  console.log('\n--- Testing at 1280x720 ---');
  win.setContentSize(1280, 720);
  await sleep(600);
  const m1280 = await getDetailedMetrics('1280x720');
  console.log('1280x720 Metrics Summary:', {
    window: m1280.window,
    timelineContainer: m1280.timelineContainer,
    allTracksVisible: m1280.tracks.every(t => t.isVisibleInViewport),
    tracks: m1280.tracks,
  });
  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(200);
  const img1280 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_desktop_1280x720_fixed.png'), img1280.toPNG());
  console.log('Saved vnest_desktop_1280x720_fixed.png');

  // C. Verification at Screen Work Area (Scaled Windows display: 1011x537)
  console.log('\n--- Testing at Work Area Dimensions (1011x537) ---');
  win.setContentSize(workArea.width, workArea.height);
  await sleep(600);
  const mWork = await getDetailedMetrics('WorkArea');
  console.log('WorkArea (1011x537) Metrics Summary:', {
    window: mWork.window,
    timelineContainer: mWork.timelineContainer,
    tracks: mWork.tracks,
    headers: mWork.headers,
    timelineHeight: mWork.timelineContainer?.height,
  });
  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(200);
  const imgWork = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_desktop_workarea_scaled.png'), imgWork.toPNG());
  console.log('Saved vnest_desktop_workarea_scaled.png');

  // D. Verify Split and Undo Operations at 1440x900
  console.log('\n--- Testing Split at 5000ms & Undo/Redo ---');
  win.setContentSize(1440, 900);
  await sleep(600);

  // Position playhead at 5000ms and select Scenic Flight clip
  await win.webContents.executeJavaScript(`
    (() => {
      // Seek to 5000ms
      const ruler = document.querySelector('.vnest-timeline-ruler');
      if (ruler) {
        const rect = ruler.getBoundingClientRect();
        ruler.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: rect.left + 300, // 5s * 60px/s = 300px
          clientY: rect.top + 10,
        }));
      }

      // Select video clip
      const clips = Array.from(document.querySelectorAll('.vnest-clip-block'));
      const video = clips.find(c => c.textContent && c.textContent.includes('Scenic Flight'));
      if (video) video.click();
    })()
  `);
  await sleep(500);

  // Click Split
  console.log('Clicking Split...');
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const splitBtn = buttons.find(b => b.textContent && b.textContent.includes('Split'));
      if (splitBtn) splitBtn.click();
    })()
  `);
  await sleep(800);

  const postSplit = await getDetailedMetrics('PostSplit');
  console.log('Post-Split Clips Count:', postSplit.clipsCount);
  console.log('Clips:', postSplit.clips);

  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(200);
  const imgSplit = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_desktop_split_fixed.png'), imgSplit.toPNG());
  console.log('Saved vnest_desktop_split_fixed.png');

  // Test Undo of Split
  console.log('Testing Undo of Split...');
  const undoResult = await win.webContents.executeJavaScript(`
    (() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      if (undoBtn) {
        const wasDisabled = undoBtn.disabled;
        undoBtn.click();
        return { found: true, wasDisabled };
      }
      return { found: false };
    })()
  `);
  console.log('Undo button click result:', JSON.stringify(undoResult));
  await sleep(600);

  const postUndo = await getDetailedMetrics('PostUndo');
  console.log('Post-Undo Clips Count (should be 4):', postUndo.clipsCount);

  console.log('--- Verification Finished Successfully ---');
  app.quit();
});
