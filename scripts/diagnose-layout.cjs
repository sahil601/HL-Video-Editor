const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  console.log('Primary Display:', {
    bounds: primaryDisplay.bounds,
    workArea: primaryDisplay.workArea,
    scaleFactor: primaryDisplay.scaleFactor,
  });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
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
  await sleep(1000);

  // Load demo project
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const demoBtn = buttons.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) demoBtn.click();
    })()
  `);
  await sleep(1200);

  async function measureLayout(label) {
    return await win.webContents.executeJavaScript(`
      (() => {
        const getMetrics = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const comp = window.getComputedStyle(el);
          return {
            selector: sel,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            display: comp.display,
            flex: comp.flex,
            flexShrink: comp.flexShrink,
            flexGrow: comp.flexGrow,
            minHeight: comp.minHeight,
            maxHeight: comp.maxHeight,
            overflowY: comp.overflowY,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          };
        };

        const trackRows = Array.from(document.querySelectorAll('.vnest-timeline-track-row')).map((el, idx) => {
          const r = el.getBoundingClientRect();
          return {
            idx,
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            isClippedBelowViewport: r.bottom > window.innerHeight,
          };
        });

        const trackHeaders = Array.from(document.querySelectorAll('.vnest-timeline-track-header')).map((el, idx) => {
          const r = el.getBoundingClientRect();
          return {
            idx,
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            isClippedBelowViewport: r.bottom > window.innerHeight,
          };
        });

        return {
          window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
          appContainer: getMetrics('.vnest-app-container'),
          header: getMetrics('.vnest-header'),
          workspace: getMetrics('.vnest-workspace'),
          previewCenter: getMetrics('.vnest-preview-center'),
          previewCanvasArea: getMetrics('.vnest-preview-canvas-area'),
          sidebarLeft: getMetrics('.vnest-sidebar-left'),
          sidebarRight: getMetrics('.vnest-sidebar-right'),
          timelineContainer: getMetrics('.vnest-timeline-container'),
          timelineToolbar: getMetrics('.vnest-timeline-toolbar'),
          timelineBody: getMetrics('.vnest-timeline-body'),
          timelineHeaders: getMetrics('.vnest-timeline-headers'),
          timelineLanesScroll: getMetrics('.vnest-timeline-lanes-scroll'),
          trackRows,
          trackHeaders,
        };
      })()
    `);
  }

  // Measure at 1440x900
  console.log('\n=== MEASUREMENTS AT 1440x900 ===');
  const m1440 = await measureLayout('1440x900');
  console.log(JSON.stringify(m1440, null, 2));

  // Measure at 1280x720
  console.log('\n=== MEASUREMENTS AT 1280x720 ===');
  win.setSize(1280, 720);
  await sleep(600);
  const m1280 = await measureLayout('1280x720');
  console.log(JSON.stringify(m1280, null, 2));

  // Measure at 1600x900
  console.log('\n=== MEASUREMENTS AT 1600x900 ===');
  win.setSize(1600, 900);
  await sleep(600);
  const m1600 = await measureLayout('1600x900');
  console.log(JSON.stringify(m1600, null, 2));

  app.quit();
});
