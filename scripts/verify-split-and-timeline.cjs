const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/ffbbcf6d-8d73-46f4-9e45-212000034cbd';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('--- Starting VNest Timeline Visibility & Split Verification ---');

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    backgroundColor: '#090a0d',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distHtml);
  await sleep(1500);

  // 1. Enter the Editor view with the Quick Demo Project
  console.log('Loading Quick Demo Project...');
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const demoBtn = buttons.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) demoBtn.click();
    })()
  `);
  await sleep(1500);

  // 2. Test Invalid Split without clip selection to verify warning feedback
  console.log('Testing invalid split (no clip selected)...');
  const warningClickResult = await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const splitBtn = buttons.find(b => b.textContent && b.textContent.includes('Split'));
      if (splitBtn) {
        splitBtn.click();
        return { found: true, text: splitBtn.textContent };
      }
      return { found: false, allButtons: buttons.map(b => b.textContent.trim()) };
    })()
  `);
  console.log('Warning click result:', JSON.stringify(warningClickResult));
  await sleep(600);

  const toastInfo1 = await win.webContents.executeJavaScript(`
    (() => {
      const toast = document.querySelector('.vnest-toast');
      return toast ? { text: toast.textContent.trim(), isVisible: !!toast.offsetParent } : null;
    })()
  `);
  console.log('Toast info after invalid split:', JSON.stringify(toastInfo1));

  // Force repaint before capture
  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(200);

  // Capture warning toast screenshot
  const warningImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_split_warning_toast.png'), warningImage.toPNG());
  console.log('Saved vnest_split_warning_toast.png');

  // Dismiss warning toast
  await win.webContents.executeJavaScript(`
    (() => {
      const closeBtn = document.querySelector('.vnest-toast button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(400);

  // 3. Select the Video Clip and move playhead to 5000ms (5 seconds)
  console.log('Selecting Scenic Flight clip and positioning playhead at 5000ms...');
  await win.webContents.executeJavaScript(`
    (() => {
      // Find the first video clip ("Scenic Flight (Sample)")
      const clipBlocks = Array.from(document.querySelectorAll('.vnest-clip-block'));
      const videoClip = clipBlocks.find(c => c.textContent && c.textContent.includes('Scenic Flight'));
      if (videoClip) {
        videoClip.click();
      }

      // Seek ruler to 5000ms (5s * 60px/s = 300px from ruler start)
      const ruler = document.querySelector('.vnest-timeline-ruler');
      if (ruler) {
        const rect = ruler.getBoundingClientRect();
        const evt = new MouseEvent('mousedown', {
          bubbles: true,
          clientX: rect.left + 300,
          clientY: rect.top + 10,
        });
        ruler.dispatchEvent(evt);
      }
    })()
  `);
  await sleep(600);

  // Re-confirm selection of video clip if needed
  await win.webContents.executeJavaScript(`
    (() => {
      const clipBlocks = Array.from(document.querySelectorAll('.vnest-clip-block'));
      const videoClip = clipBlocks.find(c => c.textContent && c.textContent.includes('Scenic Flight'));
      if (videoClip) {
        videoClip.click();
      }
    })()
  `);
  await sleep(300);

  // 4. Perform Split at 5 seconds
  console.log('Clicking Split button at 5000ms...');
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const splitBtn = buttons.find(b => b.textContent && b.textContent.includes('Split'));
      if (splitBtn) splitBtn.click();
    })()
  `);
  await sleep(800);

  // Verify resulting clips on timeline
  const splitResults = await win.webContents.executeJavaScript(`
    (() => {
      const clipBlocks = Array.from(document.querySelectorAll('.vnest-clip-block'));
      const toast = document.querySelector('.vnest-toast');
      
      const clipsInfo = clipBlocks.map(c => ({
        text: c.textContent.trim(),
        width: c.offsetWidth,
        left: c.offsetLeft,
        isSelected: c.classList.contains('selected'),
      }));

      return {
        totalClips: clipBlocks.length,
        clipsInfo,
        toastMessage: toast ? toast.textContent.trim() : null,
      };
    })()
  `);

  // Force repaint before capture
  await win.webContents.executeJavaScript(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(300);

  // Capture screenshot of verified split with visible green toast confirmation and separate clip blocks
  const splitImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_split_verified.png'), splitImage.toPNG());
  console.log('Saved vnest_split_verified.png');

  // 5. Test Timeline Height Resizing (Drag to expand timeline)
  console.log('Testing timeline resizing: expanding timeline height...');
  await win.webContents.executeJavaScript(`
    (() => {
      const resizer = document.querySelector('.vnest-timeline-resizer');
      if (resizer) {
        const rect = resizer.getBoundingClientRect();
        resizer.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientY: rect.top,
        }));
      }
    })()
  `);
  await sleep(150);

  await win.webContents.executeJavaScript(`
    (() => {
      const resizer = document.querySelector('.vnest-timeline-resizer');
      if (resizer) {
        const rect = resizer.getBoundingClientRect();
        window.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientY: rect.top - 80,
        }));
      }
    })()
  `);
  await sleep(150);

  await win.webContents.executeJavaScript(`
    (() => {
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
      }));
    })()
  `);
  await sleep(500);

  const resizedMetrics = await win.webContents.executeJavaScript(`
    (() => {
      const timeline = document.querySelector('.vnest-timeline-container');
      const trackRows = document.querySelectorAll('.vnest-timeline-track-row');
      const trackHeaders = document.querySelectorAll('.vnest-timeline-track-header');

      return {
        timelineHeight: timeline ? timeline.offsetHeight : null,
        trackRowCount: trackRows.length,
        trackRowHeight: trackRows.length > 0 ? trackRows[0].offsetHeight : null,
        trackHeaderHeight: trackHeaders.length > 0 ? trackHeaders[0].offsetHeight : null,
      };
    })()
  `);

  console.log('Resized Timeline Metrics:', JSON.stringify(resizedMetrics, null, 2));

  // Capture screenshot with expanded timeline
  const expandedImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'vnest_timeline_expanded_380px.png'), expandedImage.toPNG());
  console.log('Saved vnest_timeline_expanded_380px.png');

  console.log('--- Verification Complete ---');
  app.quit();
});
