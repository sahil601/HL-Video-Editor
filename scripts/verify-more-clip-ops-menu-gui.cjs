const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('===============================================================');
console.log('   HL More Clip Operations Menu — GUI & Positioning Check      ');
console.log('===============================================================');

const projectRoot = path.join(__dirname, '..');
const brainDir = 'C:/Users/sahil/.gemini/antigravity-ide/brain/285307fd-80f8-4532-a5ba-a415d59c8bdc';
if (!fs.existsSync(brainDir)) {
  fs.mkdirSync(brainDir, { recursive: true });
}

let electronPath = require('electron');

const electronScript = `
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.cjs'),
      webSecurity: false,
    },
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  await win.loadFile(indexPath);
  await new Promise((r) => setTimeout(r, 1500));

  // Load Quick Demo Project or New Project to enter Editor view
  await win.webContents.executeJavaScript(\`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const demoBtn = btns.find(b => b.textContent && (b.textContent.includes('Quick Demo Project') || b.textContent.includes('New Project')));
      if (demoBtn) demoBtn.click();
    })()
  \`);
  await new Promise((r) => setTimeout(r, 1500));

  // Step 1: Verify initial state (menu is closed)
  const initialCheck = await win.webContents.executeJavaScript(\`
    (() => {
      const btn = document.getElementById('timeline-more-clip-ops-btn') ||
                  document.querySelector('button[title*="More Clip Operations"]');
      const menu = document.getElementById('timeline-more-clip-ops-menu');
      return {
        hasButton: btn !== null,
        menuInitiallyOpen: menu !== null,
      };
    })()
  \`);

  // Step 2: Click the three-dot button to open the menu
  await win.webContents.executeJavaScript(\`
    (() => {
      const btn = document.getElementById('timeline-more-clip-ops-btn') ||
                  document.querySelector('button[title*="More Clip Operations"]');
      if (btn) btn.click();
    })()
  \`);
  await new Promise((r) => setTimeout(r, 400));

  // Step 3: Inspect menu geometry, portal attachment, styling, and items
  const menuInspection = await win.webContents.executeJavaScript(\`
    (() => {
      const btn = document.getElementById('timeline-more-clip-ops-btn') ||
                  document.querySelector('button[title*="More Clip Operations"]');
      const menu = document.getElementById('timeline-more-clip-ops-menu');
      if (!menu || !btn) return { error: 'Menu or button missing' };

      const btnRect = btn.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(menu);

      // Verify portal: parentElement must be body
      const isAttachedToBody = menu.parentElement === document.body;

      // Verify items
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(el => ({
        id: el.id,
        text: el.textContent.trim(),
        disabled: el.hasAttribute('disabled') || el.disabled === true,
        title: el.getAttribute('title') || '',
      }));

      // Check actions: Group, Ungroup, Freeze Frame, Extract Audio, Voiceover
      const hasGroup = items.some(i => i.text.includes('Group Clips'));
      const hasUngroup = items.some(i => i.text.includes('Ungroup'));
      const hasFreezeFrame = items.some(i => i.text.includes('Freeze Frame'));
      const hasExtractAudio = items.some(i => i.text.includes('Extract Audio'));
      const hasVoiceover = items.some(i => i.text.includes('Voiceover'));

      // Check positioning: menu should be below the button and within viewport bounds
      const isBelowButton = menuRect.top >= btnRect.bottom;
      const isInsideWindowX = menuRect.left >= 0 && menuRect.right <= window.innerWidth;
      const isInsideWindowY = menuRect.top >= 0 && menuRect.bottom <= window.innerHeight;

      return {
        isAttachedToBody,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        btnRect: { top: btnRect.top, bottom: btnRect.bottom, left: btnRect.left, right: btnRect.right },
        menuRect: { top: menuRect.top, bottom: menuRect.bottom, left: menuRect.left, right: menuRect.right, width: menuRect.width, height: menuRect.height },
        isBelowButton,
        isInsideWindowX,
        isInsideWindowY,
        itemCount: items.length,
        hasGroup,
        hasUngroup,
        hasFreezeFrame,
        hasExtractAudio,
        hasVoiceover,
        items,
      };
    })()
  \`);

  // Capture screenshot with menu open
  const screenshotPath = '${brainDir.replace(/\\\\/g, '/')}/hl_more_clip_ops_menu_open.png';
  const imgOpen = await win.webContents.capturePage();
  fs.writeFileSync(screenshotPath, imgOpen.toPNG());

  // Step 4: Test Outside Click dismissal
  await win.webContents.executeJavaScript(\`
    (() => {
      const evt = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      });
      document.dispatchEvent(evt);
    })()
  \`);
  await new Promise((r) => setTimeout(r, 200));

  const afterOutsideClick = await win.webContents.executeJavaScript(\`
    document.getElementById('timeline-more-clip-ops-menu') === null
  \`);

  // Step 5: Test Escape key dismissal
  await win.webContents.executeJavaScript(\`
    (() => {
      const btn = document.getElementById('timeline-more-clip-ops-btn') ||
                  document.querySelector('button[title*="More Clip Operations"]');
      if (btn) btn.click();
    })()
  \`);
  await new Promise((r) => setTimeout(r, 200));

  const reOpened = await win.webContents.executeJavaScript(\`
    document.getElementById('timeline-more-clip-ops-menu') !== null
  \`);

  await win.webContents.executeJavaScript(\`
    (() => {
      const evt = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(evt);
    })()
  \`);
  await new Promise((r) => setTimeout(r, 200));

  const afterEscape = await win.webContents.executeJavaScript(\`
    document.getElementById('timeline-more-clip-ops-menu') === null
  \`);

  // Step 6: Test placement when window is resized / space below is tight
  win.setSize(1024, 500);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(\`
    (() => {
      const btn = document.getElementById('timeline-more-clip-ops-btn') ||
                  document.querySelector('button[title*="More Clip Operations"]');
      if (btn) btn.click();
    })()
  \`);
  await new Promise((r) => setTimeout(r, 300));

  const smallWindowInspection = await win.webContents.executeJavaScript(\`
    (() => {
      const menu = document.getElementById('timeline-more-clip-ops-menu');
      if (!menu) return { open: false };
      const menuRect = menu.getBoundingClientRect();
      const isInsideWindowX = menuRect.left >= 0 && menuRect.right <= window.innerWidth;
      const isInsideWindowY = menuRect.top >= 0 && menuRect.bottom <= window.innerHeight;
      const placement = menu.getAttribute('data-placement');
      return {
        open: true,
        placement,
        isInsideWindowX,
        isInsideWindowY,
        menuRect: { top: menuRect.top, bottom: menuRect.bottom, left: menuRect.left, right: menuRect.right },
      };
    })()
  \`);

  // Capture small window screenshot
  const smallScreenshotPath = '${brainDir.replace(/\\\\/g, '/')}/hl_more_clip_ops_menu_small_window.png';
  const imgSmall = await win.webContents.capturePage();
  fs.writeFileSync(smallScreenshotPath, imgSmall.toPNG());

  const results = {
    initialCheck,
    menuInspection,
    afterOutsideClick,
    reOpened,
    afterEscape,
    smallWindowInspection,
    screenshotPath,
    smallScreenshotPath,
  };

  const resultsFile = path.join(__dirname, 'temp_menu_results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  app.quit();
});
`;

const tempRunner = path.join(projectRoot, 'temp_run_menu_gui.cjs');
fs.writeFileSync(tempRunner, electronScript);

console.log('[1/3] Running Electron automated GUI check...');
const electronResult = spawnSync(electronPath, [tempRunner], {
  cwd: projectRoot,
  encoding: 'utf8',
  timeout: 30000,
});

if (electronResult.status !== 0) {
  console.error('Electron execution error:', electronResult.stderr || electronResult.error);
}

if (fs.existsSync(tempRunner)) {
  fs.unlinkSync(tempRunner);
}

console.log('\n[2/3] Analyzing GUI inspection results...');
const resultsFile = path.join(projectRoot, 'temp_menu_results.json');
if (!fs.existsSync(resultsFile)) {
  console.error('Results file not generated!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
fs.unlinkSync(resultsFile);

console.log('Results summary:');
console.log(' - Button Rect:', JSON.stringify(data.menuInspection.btnRect));
console.log(' - Menu Rect:', JSON.stringify(data.menuInspection.menuRect));
console.log(' - Trigger button present:', data.initialCheck.hasButton ? 'PASS' : 'FAIL');
console.log(' - Menu initially closed:', !data.initialCheck.menuInitiallyOpen ? 'PASS' : 'FAIL');
console.log(' - Portal attached to document.body (escapes container clipping):', data.menuInspection.isAttachedToBody ? 'PASS' : 'FAIL');
console.log(' - CSS position:', data.menuInspection.position, (data.menuInspection.position === 'fixed') ? 'PASS' : 'FAIL');
console.log(' - CSS z-index:', data.menuInspection.zIndex, (data.menuInspection.zIndex === '90') ? 'PASS' : 'FAIL');
console.log(' - Positioned below button:', data.menuInspection.isBelowButton ? 'PASS' : 'FAIL');
console.log(' - Inside window X bounds (1366x768):', data.menuInspection.isInsideWindowX ? 'PASS' : 'FAIL');
console.log(' - Inside window Y bounds (1366x768):', data.menuInspection.isInsideWindowY ? 'PASS' : 'FAIL');
console.log(' - Total menu actions:', data.menuInspection.itemCount, '(Expected: 5)');
console.log(' - Group action present:', data.menuInspection.hasGroup ? 'PASS' : 'FAIL');
console.log(' - Ungroup action present:', data.menuInspection.hasUngroup ? 'PASS' : 'FAIL');
console.log(' - Freeze Frame action present:', data.menuInspection.hasFreezeFrame ? 'PASS' : 'FAIL');
console.log(' - Extract Audio action present:', data.menuInspection.hasExtractAudio ? 'PASS' : 'FAIL');
console.log(' - Voiceover action present:', data.menuInspection.hasVoiceover ? 'PASS' : 'FAIL');
console.log(' - Outside-click dismissal:', data.afterOutsideClick ? 'PASS' : 'FAIL');
console.log(' - Reopened successfully:', data.reOpened ? 'PASS' : 'FAIL');
console.log(' - Escape key dismissal:', data.afterEscape ? 'PASS' : 'FAIL');
console.log(' - Small window test (1024x500):', data.smallWindowInspection.open ? 'PASS' : 'FAIL');
console.log(' - Small window boundary safety:', (data.smallWindowInspection.isInsideWindowX && data.smallWindowInspection.isInsideWindowY) ? 'PASS' : 'FAIL');
console.log(' - Screenshot captured at:', data.screenshotPath);
console.log(' - Small window screenshot at:', data.smallScreenshotPath);

const allPassed =
  data.initialCheck.hasButton &&
  !data.initialCheck.menuInitiallyOpen &&
  data.menuInspection.isAttachedToBody &&
  data.menuInspection.position === 'fixed' &&
  data.menuInspection.zIndex === '90' &&
  data.menuInspection.isBelowButton &&
  data.menuInspection.isInsideWindowX &&
  data.menuInspection.isInsideWindowY &&
  data.menuInspection.hasGroup &&
  data.menuInspection.hasUngroup &&
  data.menuInspection.hasFreezeFrame &&
  data.menuInspection.hasExtractAudio &&
  data.menuInspection.hasVoiceover &&
  data.afterOutsideClick &&
  data.reOpened &&
  data.afterEscape &&
  data.smallWindowInspection.open &&
  data.smallWindowInspection.isInsideWindowX &&
  data.smallWindowInspection.isInsideWindowY;

console.log('\n[3/3] Final Verdict:', allPassed ? 'ALL GUI CHECKS PASSED (18/18)' : 'FAILURES DETECTED');
if (!allPassed) {
  process.exit(1);
}
