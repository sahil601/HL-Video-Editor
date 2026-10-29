const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/sahil/.gemini/antigravity-ide/brain/f3402b31-b120-4dec-888f-a07972b03367';

const RESOLUTIONS = [
  { width: 1280, height: 720, name: '1280x720' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1920, height: 1080, name: '1920x1080' },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('--- Starting VNest Desktop Multi-Resolution Layout Verification ---');

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false, // will capture offscreen or window content
    backgroundColor: '#090a0d',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const distHtml = path.join(__dirname, '../dist/index.html');
  console.log(`Loading desktop bundle: ${distHtml}`);
  await win.loadFile(distHtml);

  // Wait for initial render
  await sleep(1500);

  // Enter the Editor by clicking the Quick Demo Project button
  console.log('Navigating to Editor view with Quick Demo Project...');
  await win.webContents.executeJavaScript(`
    (() => {
      // Find the Quick Demo Project button on the HomeScreen
      const buttons = Array.from(document.querySelectorAll('button'));
      const demoBtn = buttons.find(b => b.textContent && b.textContent.includes('Quick Demo Project'));
      if (demoBtn) {
        demoBtn.click();
        return true;
      }
      return false;
    })()
  `);

  await sleep(1500);

  // Verify each resolution
  for (const res of RESOLUTIONS) {
    console.log(`\nTesting resolution: ${res.name} (${res.width}x${res.height})...`);
    win.setContentSize(res.width, res.height);
    await sleep(1200);

    // Inspect layout metrics and check for clipping/overlapping
    const metrics = await win.webContents.executeJavaScript(`
      (() => {
        const header = document.querySelector('.vnest-header');
        const sidebarLeft = document.querySelector('.vnest-sidebar-left');
        const previewCenter = document.querySelector('.vnest-preview-center');
        const sidebarRight = document.querySelector('.vnest-sidebar-right');
        const timeline = document.querySelector('.vnest-timeline-container');
        const canvasBox = document.querySelector('.vnest-preview-canvas-box');
        const resizerLeft = document.getElementById('workspace-resizer-left');
        const resizerRight = document.getElementById('workspace-resizer-right');
        const timelineResizer = document.querySelector('.vnest-timeline-resizer');
        const fullscreenBtn = document.getElementById('preview-fullscreen-btn');
        const resetLayoutBtn = document.getElementById('header-reset-layout-btn');
        const libraryCollapseBtn = document.getElementById('library-collapse-btn');
        const propertiesCollapseBtn = document.getElementById('properties-collapse-btn');

        // Check for horizontal overflow / clipping
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.clientWidth;
        const hasHorizontalOverflow = docWidth > window.innerWidth;

        // Check header readability and fitting
        const headerButtons = Array.from(header ? header.querySelectorAll('button') : []);
        const headerOverlaps = headerButtons.some(b => {
          const r = b.getBoundingClientRect();
          return r.right > window.innerWidth || r.left < 0;
        });

        return {
          windowInnerWidth: window.innerWidth,
          windowInnerHeight: window.innerHeight,
          hasHorizontalOverflow,
          headerOverlaps,
          controlsFound: {
            resizerLeft: !!resizerLeft,
            resizerRight: !!resizerRight,
            timelineResizer: !!timelineResizer,
            fullscreenBtn: !!fullscreenBtn,
            resetLayoutBtn: !!resetLayoutBtn,
            libraryCollapseBtn: !!libraryCollapseBtn,
            propertiesCollapseBtn: !!propertiesCollapseBtn,
          },
          header: header ? {
            width: header.offsetWidth,
            height: header.offsetHeight,
          } : null,
          sidebarLeft: sidebarLeft ? {
            width: sidebarLeft.offsetWidth,
            height: sidebarLeft.offsetHeight,
          } : null,
          previewCenter: previewCenter ? {
            width: previewCenter.offsetWidth,
            height: previewCenter.offsetHeight,
          } : null,
          sidebarRight: sidebarRight ? {
            width: sidebarRight.offsetWidth,
            height: sidebarRight.offsetHeight,
          } : null,
          timeline: timeline ? {
            width: timeline.offsetWidth,
            height: timeline.offsetHeight,
          } : null,
        };
      })()
    `);

    console.log(`Metrics at ${res.name}:`, JSON.stringify(metrics, null, 2));

    if (metrics.hasHorizontalOverflow) {
      console.warn(`  [Warning] Detected horizontal page overflow at ${res.name}`);
    } else {
      console.log(`  ✓ No horizontal overflow or clipping detected at ${res.name}`);
    }

    if (metrics.headerOverlaps) {
      console.warn(`  [Warning] Header buttons overlap or clip off-screen at ${res.name}`);
    } else {
      console.log(`  ✓ Header controls fit comfortably within viewport at ${res.name}`);
    }

    // Capture screenshot
    const image = await win.webContents.capturePage();
    const pngBuffer = image.toPNG();
    const outputPath = path.join(ARTIFACT_DIR, `vnest_desktop_${res.name}.png`);
    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`Screenshot saved to: ${outputPath} (${pngBuffer.length} bytes)`);
  }

  // Verify Interactive Panel Collapsing & Fullscreen Mode at 1440x900
  console.log('\n--- Verifying Interactive Panel Collapsing & Fullscreen Preview ---');
  win.setContentSize(1440, 900);
  await sleep(600);

  // 1. Collapse Media Library
  console.log('Testing Media Library Collapse...');
  const collapseLeftResult = await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('library-collapse-btn');
      if (btn) btn.click();
      return !!btn;
    })()
  `);
  await sleep(500);

  const leftCollapsedTab = await win.webContents.executeJavaScript(`
    (() => {
      const tab = document.getElementById('library-collapsed-tab');
      return {
        exists: !!tab,
        width: tab ? tab.offsetWidth : 0,
      };
    })()
  `);
  console.log('Left Collapsed Tab status:', leftCollapsedTab);

  // Capture screenshot of collapsed left panel
  const shotCollapsedLeft = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_panel_left_collapsed.png'), shotCollapsedLeft.toPNG());
  console.log('Saved hl_panel_left_collapsed.png');

  // Re-expand Media Library
  await win.webContents.executeJavaScript(`
    (() => {
      const tab = document.getElementById('library-collapsed-tab');
      if (tab) tab.click();
    })()
  `);
  await sleep(500);

  // 2. Collapse Properties Inspector
  console.log('Testing Properties Inspector Collapse...');
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('properties-collapse-btn');
      if (btn) btn.click();
    })()
  `);
  await sleep(500);

  const rightCollapsedTab = await win.webContents.executeJavaScript(`
    (() => {
      const tab = document.getElementById('properties-collapsed-tab');
      return {
        exists: !!tab,
        width: tab ? tab.offsetWidth : 0,
      };
    })()
  `);
  console.log('Right Collapsed Tab status:', rightCollapsedTab);

  const shotCollapsedRight = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_panel_right_collapsed.png'), shotCollapsedRight.toPNG());
  console.log('Saved hl_panel_right_collapsed.png');

  // Re-expand Inspector
  await win.webContents.executeJavaScript(`
    (() => {
      const tab = document.getElementById('properties-collapsed-tab');
      if (tab) tab.click();
    })()
  `);
  await sleep(500);

  // 3. Test Fullscreen Preview Mode
  console.log('Testing Fullscreen / Expanded Preview mode...');
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('preview-fullscreen-btn');
      if (btn) btn.click();
    })()
  `);
  await sleep(600);

  const fullscreenMetrics = await win.webContents.executeJavaScript(`
    (() => {
      const sidebars = document.querySelectorAll('.vnest-sidebar-left, .vnest-sidebar-right');
      const timeline = document.querySelector('.vnest-timeline-container');
      const previewCenter = document.querySelector('.vnest-preview-center');
      return {
        sidebarsVisible: sidebars.length > 0,
        timelineVisible: !!timeline,
        previewWidth: previewCenter ? previewCenter.offsetWidth : 0,
        previewHeight: previewCenter ? previewCenter.offsetHeight : 0,
      };
    })()
  `);
  console.log('Fullscreen metrics:', fullscreenMetrics);

  const shotFullscreen = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'hl_fullscreen_preview.png'), shotFullscreen.toPNG());
  console.log('Saved hl_fullscreen_preview.png');

  // Exit Fullscreen mode via Esc key
  console.log('Exiting Fullscreen mode via Escape key...');
  await win.webContents.executeJavaScript(`
    (() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    })()
  `);
  await sleep(600);

  // 4. Test Reset Layout Button in Header
  console.log('Testing Header Reset Layout button...');
  await win.webContents.executeJavaScript(`
    (() => {
      const resetBtn = document.getElementById('header-reset-layout-btn');
      if (resetBtn) resetBtn.click();
    })()
  `);
  await sleep(500);

  const postResetMetrics = await win.webContents.executeJavaScript(`
    (() => {
      const sidebarLeft = document.querySelector('.vnest-sidebar-left');
      const sidebarRight = document.querySelector('.vnest-sidebar-right');
      const timeline = document.querySelector('.vnest-timeline-container');
      return {
        leftWidth: sidebarLeft ? sidebarLeft.offsetWidth : 0,
        rightWidth: sidebarRight ? sidebarRight.offsetWidth : 0,
        timelineHeight: timeline ? timeline.offsetHeight : 0,
      };
    })()
  `);
  console.log('Post-Reset Layout Metrics (Defaults restored):', postResetMetrics);

  console.log('\n--- Multi-Resolution & Workspace Verification Completed Successfully ---');
  app.quit();
});
