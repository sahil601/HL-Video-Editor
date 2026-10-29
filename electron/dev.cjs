const { spawn } = require('child_process');
const http = require('http');

console.log('[VNest] Starting Vite development server...');

// In PowerShell / Windows, npx vite or npm run dev
const isWin = process.platform === 'win32';
const viteCmd = isWin ? 'npm.cmd' : 'npm';
const vite = spawn(viteCmd, ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

function checkViteReady(retries = 30) {
  if (retries <= 0) {
    console.error('[VNest] Timed out waiting for Vite server.');
    process.exit(1);
  }

  const req = http.get('http://localhost:5173', (res) => {
    console.log('[VNest] Vite is ready! Launching Electron desktop window...');
    launchElectron();
  });

  req.on('error', () => {
    setTimeout(() => checkViteReady(retries - 1), 500);
  });
}

function launchElectron() {
  const electronCmd = isWin ? 'npx.cmd' : 'npx';
  const electronProc = spawn(electronCmd, ['electron', 'electron/main.cjs'], {
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    stdio: 'inherit',
    shell: true,
  });

  electronProc.on('close', () => {
    try { vite.kill(); } catch (e) {}
    process.exit(0);
  });
}

// Start checking after a short initial pause
setTimeout(() => checkViteReady(), 1000);
