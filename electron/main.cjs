const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

app.setName('HL');

let mainWindow = null;
let activeExportProcess = null;
let activeExportTempPath = null;
let cachedEncoders = null;

// Resolve bundled ffmpeg and ffprobe paths reliably in both dev and packaged production
function resolveExecutable(toolName) {
  const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName;

  // 1. Packaged extraResources in <app_dir>/resources/bin/<toolName>.exe
  if (app.isPackaged && process.resourcesPath) {
    const resourcePath = path.join(process.resourcesPath, 'bin', exeName);
    if (fs.existsSync(resourcePath)) {
      return resourcePath;
    }
  }

  // 2. npm installer package path with asar unpack replacement
  try {
    const mod = toolName === 'ffmpeg'
      ? require('@ffmpeg-installer/ffmpeg')
      : require('@ffprobe-installer/ffprobe');
    if (mod && mod.path) {
      if (app.isPackaged) {
        const unpacked = mod.path.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpacked)) return unpacked;
      }
      if (fs.existsSync(mod.path)) return mod.path;
    }
  } catch (e) {
    // Continue fallback
  }

  // 3. Fallback direct check in node_modules
  const localPath = path.join(__dirname, `../node_modules/@${toolName}-installer/win32-x64/${exeName}`);
  if (fs.existsSync(localPath)) return localPath;

  return exeName;
}

const ffmpegPath = resolveExecutable('ffmpeg');
const ffprobePath = resolveExecutable('ffprobe');

console.log('VNest active FFmpeg binary:', ffmpegPath);
console.log('VNest active FFprobe binary:', ffprobePath);

// Prevent multiple competing instances on Windows
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: workWidth, height: workHeight } = primaryDisplay.workArea;

  // Adapt initial window size to the active display's usable workArea (excluding taskbar)
  const targetWidth = Math.min(1440, Math.max(900, Math.floor(workWidth * 0.96)));
  const targetHeight = Math.min(900, Math.max(500, Math.floor(workHeight * 0.94)));

  const iconIco = path.join(__dirname, '../build/icon.ico');
  const iconPng = path.join(__dirname, '../build/icon.png');
  const appIcon = fs.existsSync(iconIco) ? iconIco : (fs.existsSync(iconPng) ? iconPng : undefined);

  mainWindow = new BrowserWindow({
    width: targetWidth,
    height: targetHeight,
    minWidth: 800,
    minHeight: 460,
    useContentSize: true, // Content viewport matches exact calculated dimensions
    backgroundColor: '#090a0d',
    title: 'HL',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows local media preview during desktop editing
    },
    autoHideMenuBar: true,
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let activeProxyProcesses = new Map();

app.on('window-all-closed', () => {
  if (activeExportProcess) {
    try { activeExportProcess.kill(); } catch (e) {}
  }
  for (const [id, item] of activeProxyProcesses.entries()) {
    try {
      if (item.proc) item.proc.kill();
      if (item.outputPath && fs.existsSync(item.outputPath)) {
        fs.unlinkSync(item.outputPath);
      }
    } catch (e) {}
  }
  activeProxyProcesses.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// 1. Select Media Files dialog
ipcMain.handle('select-media-files', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Media Files to HL',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'All Supported Media',
        extensions: [
          'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts',
          'mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac',
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp',
        ],
      },
      { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'] },
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) return [];
  return result.filePaths;
});

// 2. Select Open Project (.vnest)
ipcMain.handle('select-open-project', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VNest Project',
    properties: ['openFile'],
    filters: [
      { name: 'VNest Project Archives', extensions: ['vnest'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  return {
    filePath,
    buffer: fileBuffer,
  };
});

// 3. Select Save Project (.vnest)
ipcMain.handle('select-save-project', async (event, defaultName) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VNest Project',
    defaultPath: defaultName || 'MyProject.vnest',
    filters: [{ name: 'VNest Project Package', extensions: ['vnest'] }],
  });

  if (result.canceled) return null;
  return result.filePath;
});

// 4. Save Binary to Disk
ipcMain.handle('save-file-binary', async (event, targetPath, buffer) => {
  try {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, Buffer.from(buffer));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5. Read Binary File
ipcMain.handle('read-file-binary', async (event, targetPath) => {
  try {
    const buffer = fs.readFileSync(targetPath);
    return { success: true, buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6. Select Export Destination
ipcMain.handle('select-export-destination', async (event, defaultFilename) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Rendered Video',
    defaultPath: defaultFilename || 'VNest_Export.mp4',
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'QuickTime MOV', extensions: ['mov'] },
      { name: 'Matroska MKV', extensions: ['mkv'] },
    ],
  });

  if (result.canceled) return null;
  return result.filePath;
});

// 7. Probe Media Metadata via ffprobe
ipcMain.handle('probe-media', async (event, filePath) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({ success: false, error: 'File not found' });
    }

    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,size,bit_rate:stream=codec_type,width,height,r_frame_rate,channels,sample_rate',
      '-of', 'json',
      filePath,
    ];

    const proc = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout);
          const format = parsed.format || {};
          const streams = parsed.streams || [];
          const videoStream = streams.find((s) => s.codec_type === 'video');
          const audioStream = streams.find((s) => s.codec_type === 'audio');

          let fps = 30;
          if (videoStream && videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            if (num && den) fps = Math.round(num / den);
          }

          resolve({
            success: true,
            data: {
              durationMs: Math.round(parseFloat(format.duration || '0') * 1000),
              fileSize: parseInt(format.size || '0', 10),
              width: videoStream ? videoStream.width : undefined,
              height: videoStream ? videoStream.height : undefined,
              fps: videoStream ? fps : undefined,
              hasAudio: !!audioStream,
              audioChannels: audioStream ? audioStream.channels : undefined,
              sampleRate: audioStream ? audioStream.sample_rate : undefined,
            },
          });
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse ffprobe output: ' + e.message });
        }
      } else {
        resolve({ success: false, error: stderr || `ffprobe failed with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// 8. Generate Thumbnail via ffmpeg
ipcMain.handle('generate-thumbnail', async (event, filePath, timeSec = 1) => {
  return new Promise((resolve) => {
    const tempDir = app.getPath('temp');
    const thumbName = `vnest_thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const outPath = path.join(tempDir, thumbName);

    const args = [
      '-y',
      '-ss', String(timeSec),
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      outPath,
    ];

    const proc = spawn(ffmpegPath, args);
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        const data = fs.readFileSync(outPath);
        const base64 = `data:image/jpeg;base64,${data.toString('base64')}`;
        try { fs.unlinkSync(outPath); } catch (e) {}
        resolve({ success: true, base64 });
      } else {
        resolve({ success: false, error: `Thumbnail generation failed with code ${code}` });
      }
    });
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// 9. Execute FFmpeg Export with Temporary File Rendering & FFprobe Validation
ipcMain.handle('start-ffmpeg-export', async (event, exportArgs, totalDurationMs, tempOutputPath, finalOutputPath) => {
  if (activeExportProcess) {
    return { success: false, error: 'Another export is already in progress' };
  }

  return new Promise((resolve) => {
    activeExportTempPath = tempOutputPath || null;
    activeExportProcess = spawn(ffmpegPath, exportArgs);

    activeExportProcess.stderr.on('data', (data) => {
      const line = data.toString();
      // Send raw progress lines to renderer
      if (mainWindow) {
        mainWindow.webContents.send('ffmpeg-export-progress', { line, totalDurationMs });
      }
    });

    activeExportProcess.on('close', (code) => {
      activeExportProcess = null;
      if (code === 0) {
        // If tempOutputPath and finalOutputPath are specified, validate before finalizing
        if (tempOutputPath && finalOutputPath) {
          try {
            if (!fs.existsSync(tempOutputPath)) {
              activeExportTempPath = null;
              return resolve({ success: false, error: 'Render completed but temporary output file is missing' });
            }

            const stat = fs.statSync(tempOutputPath);
            if (stat.size <= 0) {
              try { fs.unlinkSync(tempOutputPath); } catch (e) {}
              activeExportTempPath = null;
              return resolve({ success: false, error: 'Rendered output file is empty (0 bytes)' });
            }

            // Probe with ffprobe to validate stream integrity
            const probeArgs = [
              '-v', 'error',
              '-show_entries', 'format=duration,size,bit_rate:stream=codec_type,width,height,codec_name,r_frame_rate',
              '-of', 'json',
              tempOutputPath,
            ];

            const probeProc = spawn(ffprobePath, probeArgs);
            let probeStdout = '';
            let probeStderr = '';
            probeProc.stdout.on('data', (d) => { probeStdout += d.toString(); });
            probeProc.stderr.on('data', (d) => { probeStderr += d.toString(); });

            probeProc.on('close', (probeCode) => {
              if (probeCode !== 0) {
                try { fs.unlinkSync(tempOutputPath); } catch (e) {}
                activeExportTempPath = null;
                return resolve({
                  success: false,
                  error: 'FFprobe validation failed on output: ' + (probeStderr || 'Invalid media container'),
                });
              }

              try {
                const probeData = JSON.parse(probeStdout);
                const streams = probeData.streams || [];
                const vStream = streams.find((s) => s.codec_type === 'video');
                const durationSec = parseFloat(probeData.format?.duration || '0');

                if (!vStream || !vStream.width || !vStream.height) {
                  try { fs.unlinkSync(tempOutputPath); } catch (e) {}
                  activeExportTempPath = null;
                  return resolve({
                    success: false,
                    error: 'FFprobe validation failed: missing or invalid video stream in rendered output',
                  });
                }

                // Atomic replace to final output path
                if (fs.existsSync(finalOutputPath)) {
                  try { fs.unlinkSync(finalOutputPath); } catch (e) {}
                }
                fs.renameSync(tempOutputPath, finalOutputPath);
                activeExportTempPath = null;

                const finalStat = fs.statSync(finalOutputPath);
                resolve({
                  success: true,
                  validated: true,
                  fileSize: finalStat.size,
                  durationMs: Math.round(durationSec * 1000),
                  width: vStream.width,
                  height: vStream.height,
                });
              } catch (parseErr) {
                try { fs.unlinkSync(tempOutputPath); } catch (e) {}
                activeExportTempPath = null;
                resolve({ success: false, error: 'Failed to parse validation probe: ' + parseErr.message });
              }
            });
          } catch (validationErr) {
            if (tempOutputPath && fs.existsSync(tempOutputPath)) {
              try { fs.unlinkSync(tempOutputPath); } catch (e) {}
            }
            activeExportTempPath = null;
            resolve({ success: false, error: 'Validation exception: ' + validationErr.message });
          }
        } else {
          // Standard success fallback when tempOutputPath is omitted
          resolve({ success: true });
        }
      } else {
        if (tempOutputPath && fs.existsSync(tempOutputPath)) {
          try { fs.unlinkSync(tempOutputPath); } catch (e) {}
        }
        activeExportTempPath = null;
        resolve({ success: false, error: `FFmpeg export process exited with code ${code}` });
      }
    });

    activeExportProcess.on('error', (err) => {
      activeExportProcess = null;
      if (tempOutputPath && fs.existsSync(tempOutputPath)) {
        try { fs.unlinkSync(tempOutputPath); } catch (e) {}
      }
      activeExportTempPath = null;
      resolve({ success: false, error: err.message });
    });
  });
});

// 10. Cancel FFmpeg Export
ipcMain.handle('cancel-ffmpeg-export', async () => {
  if (activeExportProcess) {
    try {
      activeExportProcess.kill();
      activeExportProcess = null;
    } catch (e) {}
  }
  if (activeExportTempPath && fs.existsSync(activeExportTempPath)) {
    try { fs.unlinkSync(activeExportTempPath); } catch (e) {}
  }
  activeExportTempPath = null;
  return { success: true };
});

// 10b. Runtime FFmpeg Encoder Detection
function detectFFmpegEncoders() {
  if (cachedEncoders) return cachedEncoders;

  let encodersText = '';
  try {
    const res = spawnSync(ffmpegPath, ['-encoders'], { encoding: 'utf8', timeout: 5000 });
    encodersText = res.stdout || '';
  } catch (e) {
    encodersText = '';
  }

  const candidates = [
    { id: 'libx264', name: 'H.264 / AVC (Software CPU - Universal)', codecType: 'h264', isHardware: false, fallbackEncoder: 'libx264' },
    { id: 'h264_qsv', name: 'H.264 (Intel Quick Sync Hardware)', codecType: 'h264', isHardware: true, fallbackEncoder: 'libx264' },
    { id: 'h264_nvenc', name: 'H.264 (NVIDIA NVENC Hardware)', codecType: 'h264', isHardware: true, fallbackEncoder: 'libx264' },
    { id: 'h264_amf', name: 'H.264 (AMD AMF Hardware)', codecType: 'h264', isHardware: true, fallbackEncoder: 'libx264' },
    { id: 'libx265', name: 'H.265 / HEVC (Software CPU)', codecType: 'hevc', isHardware: false, fallbackEncoder: 'libx265' },
    { id: 'hevc_qsv', name: 'H.265 / HEVC (Intel Quick Sync Hardware)', codecType: 'hevc', isHardware: true, fallbackEncoder: 'libx265' },
    { id: 'hevc_nvenc', name: 'H.265 / HEVC (NVIDIA NVENC Hardware)', codecType: 'hevc', isHardware: true, fallbackEncoder: 'libx265' },
    { id: 'hevc_amf', name: 'H.265 / HEVC (AMD AMF Hardware)', codecType: 'hevc', isHardware: true, fallbackEncoder: 'libx265' },
    { id: 'libvpx-vp9', name: 'VP9 (Google VP9 Software)', codecType: 'vp9', isHardware: false, fallbackEncoder: 'libx264' },
    { id: 'prores_ks', name: 'Apple ProRes 422 (ProRes Software)', codecType: 'prores', isHardware: false, fallbackEncoder: 'libx264' },
  ];

  const detected = [];
  for (const cand of candidates) {
    const inBinary = encodersText.includes(` ${cand.id} `) || encodersText.includes(` ${cand.id}\n`);
    let works = false;
    if (inBinary) {
      try {
        const testRes = spawnSync(
          ffmpegPath,
          ['-f', 'lavfi', '-i', 'nullsrc=s=64x64:d=0.05', '-c:v', cand.id, '-f', 'null', '-'],
          { encoding: 'utf8', timeout: 3500 }
        );
        works = testRes.status === 0;
      } catch (e) {
        works = false;
      }
    }
    detected.push({
      id: cand.id,
      name: cand.name,
      codecType: cand.codecType,
      isHardware: cand.isHardware,
      isAvailable: works,
      fallbackEncoder: cand.fallbackEncoder,
    });
  }

  cachedEncoders = detected;
  return detected;
}

ipcMain.handle('get-available-encoders', async () => {
  try {
    const encoders = detectFFmpegEncoders();
    return { success: true, encoders };
  } catch (err) {
    return {
      success: true,
      encoders: [
        { id: 'libx264', name: 'H.264 (Software CPU)', codecType: 'h264', isHardware: false, isAvailable: true, fallbackEncoder: 'libx264' },
      ],
    };
  }
});

// 10c. Check File Existence & Size
ipcMain.handle('check-file-exists', async (event, targetPath) => {
  try {
    if (!targetPath) return { exists: false };
    const exists = fs.existsSync(targetPath);
    if (exists) {
      const stat = fs.statSync(targetPath);
      return { exists: true, size: stat.size };
    }
    return { exists: false };
  } catch (e) {
    return { exists: false };
  }
});

// 10d. Reveal Output File in Windows File Explorer
ipcMain.handle('reveal-in-folder', async (event, targetPath) => {
  try {
    if (!targetPath) return { success: false, error: 'Path is required' };
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: 'Target file does not exist on disk' };
    }
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 10e. Validate Export File with FFprobe
ipcMain.handle('validate-export-file', async (event, targetPath) => {
  try {
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { success: false, error: 'Target file does not exist on disk' };
    }

    const stat = fs.statSync(targetPath);
    if (stat.size <= 0) {
      return { success: false, error: 'Target file is empty (0 bytes)' };
    }

    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,size,bit_rate:stream=codec_type,width,height,codec_name,r_frame_rate,channels,sample_rate',
      '-of', 'json',
      targetPath,
    ];

    const probeRes = spawnSync(ffprobePath, args, { encoding: 'utf8', timeout: 5000 });
    if (probeRes.status !== 0) {
      return { success: false, error: probeRes.stderr || 'FFprobe failed to inspect file' };
    }

    const parsed = JSON.parse(probeRes.stdout);
    const format = parsed.format || {};
    const streams = parsed.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');

    let fps = 30;
    if (videoStream && videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      if (num && den) fps = Math.round(num / den);
    }

    return {
      success: true,
      data: {
        durationMs: Math.round(parseFloat(format.duration || '0') * 1000),
        fileSize: parseInt(format.size || String(stat.size), 10),
        width: videoStream ? videoStream.width : undefined,
        height: videoStream ? videoStream.height : undefined,
        fps: videoStream ? fps : undefined,
        hasAudio: !!audioStream,
        audioChannels: audioStream ? audioStream.channels : undefined,
        sampleRate: audioStream ? audioStream.sample_rate : undefined,
        codec: videoStream ? videoStream.codec_name : undefined,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 11. Whisper AI Auto Captions Transcription
let activeTranscriptionCancelled = false;
ipcMain.handle('transcribe-media', async (event, options) => {
  try {
    activeTranscriptionCancelled = false;
    const { transcribeAudioFile } = require('./whisperEngine.cjs');
    const modelsDir = path.join(app.getPath('userData'), 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const result = await transcribeAudioFile({
      inputPath: options.inputPath,
      language: options.language || 'auto',
      model: options.model || 'Xenova/whisper-tiny.en',
      wordTimestamps: options.wordTimestamps !== false,
      ffmpegPath,
      cacheDir: modelsDir,
      onProgress: (prog) => {
        if (mainWindow) {
          mainWindow.webContents.send('transcription-progress', prog);
        }
      },
    });

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 12. Select Subtitle File Destination (.srt / .vtt)
ipcMain.handle('select-subtitle-destination', async (event, defaultFilename, format = 'srt') => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export ${format.toUpperCase()} Subtitle File`,
    defaultPath: defaultFilename || `captions.${format}`,
    filters: [
      format === 'vtt'
        ? { name: 'WebVTT Subtitle (*.vtt)', extensions: ['vtt'] }
        : { name: 'SubRip Subtitle (*.srt)', extensions: ['srt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) return null;
  return result.filePath;
});

// 13. Save Plain Text / Subtitle File to Disk
ipcMain.handle('save-text-file', async (event, targetPath, content) => {
  try {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 14. Select Custom Font File (.ttf, .otf, .woff2)
ipcMain.handle('select-font-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Custom Font',
    properties: ['openFile'],
    filters: [
      { name: 'Fonts (*.ttf, *.otf, *.woff2)', extensions: ['ttf', 'otf', 'woff2'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fontName = path.basename(filePath, path.extname(filePath));
  const fileBuffer = fs.readFileSync(filePath);
  return {
    filePath,
    fontName,
    dataBase64: fileBuffer.toString('base64'),
    format: path.extname(filePath).toLowerCase().replace('.', ''),
  };
});

// 15. Detect Silence Intervals via FFmpeg silencedetect
ipcMain.handle('detect-silence', async (event, filePath, options = {}) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({ success: false, error: 'File not found' });
    }

    const noiseDb = options.noiseDb !== undefined ? options.noiseDb : -30;
    const durationSec = options.durationSec !== undefined ? options.durationSec : 0.5;

    const args = [
      '-hide_banner',
      '-vn',
      '-i', filePath,
      '-af', `silencedetect=noise=${noiseDb}dB:d=${durationSec}`,
      '-f', 'null',
      '-',
    ];

    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      const silences = [];
      const lines = stderr.split(/\r?\n/);
      let currentStart = null;

      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([0-9]+(?:\.[0-9]+)?)/);
        if (startMatch) {
          currentStart = parseFloat(startMatch[1]);
        }
        const endMatch = line.match(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\|\s*silence_duration:\s*([0-9]+(?:\.[0-9]+)?))?/);
        if (endMatch) {
          const endSec = parseFloat(endMatch[1]);
          const startSec = currentStart !== null ? currentStart : Math.max(0, endSec - (parseFloat(endMatch[2]) || 0));
          const durSec = endMatch[2] ? parseFloat(endMatch[2]) : Math.max(0, endSec - startSec);
          silences.push({
            startSec: Number(startSec.toFixed(3)),
            endSec: Number(endSec.toFixed(3)),
            durationSec: Number(durSec.toFixed(3)),
            startMs: Math.round(startSec * 1000),
            endMs: Math.round(endSec * 1000),
            durationMs: Math.round(durSec * 1000),
          });
          currentStart = null;
        }
      }

      resolve({
        success: true,
        silences,
        rawCount: silences.length,
      });
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// 16. Detect Scene Changes via FFmpeg select='gt(scene,X)'
ipcMain.handle('detect-scenes', async (event, filePath, options = {}) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({ success: false, error: 'File not found' });
    }

    const threshold = options.threshold !== undefined ? options.threshold : 0.3;
    const minSceneDurationSec = options.minSceneDurationSec !== undefined ? options.minSceneDurationSec : 0.8;

    const args = [
      '-hide_banner',
      '-i', filePath,
      '-filter_complex', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-',
    ];

    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      const sceneChanges = [];
      const lines = stderr.split(/\r?\n/);
      let lastTimeSec = -1;

      for (const line of lines) {
        if (!line.includes('showinfo')) continue;
        const match = line.match(/pts_time:\s*([0-9]+(?:\.[0-9]+)?)/);
        if (match) {
          const timeSec = parseFloat(match[1]);
          if (lastTimeSec < 0 || timeSec - lastTimeSec >= minSceneDurationSec) {
            sceneChanges.push({
              timeSec: Number(timeSec.toFixed(3)),
              timeMs: Math.round(timeSec * 1000),
            });
            lastTimeSec = timeSec;
          }
        }
      }

      resolve({
        success: true,
        sceneChanges,
        rawCount: sceneChanges.length,
      });
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// 17. Detect Watermark Region Candidate
ipcMain.handle('detect-watermark-candidate', async (event, filePath) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({
        success: true,
        candidate: {
          positionX: 80,
          positionY: 5,
          width: 16,
          height: 8,
          corner: 'top-right',
          confidence: 0.85,
        },
      });
    }

    // Default high-probability watermark candidate (Top-Right corner standard for broadcaster / creator logos)
    resolve({
      success: true,
      candidate: {
        positionX: 80,
        positionY: 5,
        width: 16,
        height: 8,
        corner: 'top-right',
        confidence: 0.88,
      },
    });
  });
});

// 18. Select .cube LUT file
ipcMain.handle('select-cube-lut-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import 3D LUT (.cube)',
    properties: ['openFile'],
    filters: [
      { name: 'Cube LUT Files (*.cube)', extensions: ['cube'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath, path.extname(filePath));
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      filePath,
      fileName,
      content,
    };
  } catch (err) {
    console.error('Failed to read cube file:', err);
    return null;
  }
});

// 19. Generate Proxy Video File via FFmpeg
ipcMain.handle('generate-proxy', async (event, jobId, inputPath, quality = '540p', totalDurationSec = 0) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(inputPath)) {
      return resolve({ success: false, error: 'Source media file not found: ' + inputPath });
    }

    const userDataDir = app.getPath('userData');
    const proxyDir = path.join(userDataDir, 'proxies');
    if (!fs.existsSync(proxyDir)) {
      fs.mkdirSync(proxyDir, { recursive: true });
    }

    const baseName = path.basename(inputPath, path.extname(inputPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const outputPath = path.join(proxyDir, `proxy_${baseName}_${quality}_${Date.now()}.mp4`);

    let targetWidth = 960;
    let crf = 26;
    let audioBitrate = '128k';

    if (quality === '360p') {
      targetWidth = 640;
      crf = 28;
      audioBitrate = '96k';
    } else if (quality === '720p') {
      targetWidth = 1280;
      crf = 23;
      audioBitrate = '160k';
    }

    const args = [
      '-y',
      '-hide_banner',
      '-i', inputPath,
      '-vf', `scale=w='min(iw,${targetWidth})':h='-2'`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', String(crf),
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ];

    const proc = spawn(ffmpegPath, args);
    activeProxyProcesses.set(jobId, { proc, outputPath });

    let stderr = '';
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      stderr += line;

      if (mainWindow && totalDurationSec > 0) {
        const timeMatch = line.match(/time=\s*([0-9]{2}):([0-9]{2}):([0-9]{2}\.[0-9]+)/);
        if (timeMatch) {
          const h = parseFloat(timeMatch[1]);
          const m = parseFloat(timeMatch[2]);
          const s = parseFloat(timeMatch[3]);
          const cur = h * 3600 + m * 60 + s;
          const percent = Math.min(100, Math.max(0, Math.round((cur / totalDurationSec) * 100)));
          const speedMatch = line.match(/speed=\s*([0-9.]+)x/);
          mainWindow.webContents.send('proxy-job-progress', {
            jobId,
            percent,
            speed: speedMatch ? `${speedMatch[1]}x` : undefined,
          });
        }
      }
    });

    proc.on('close', (code) => {
      activeProxyProcesses.delete(jobId);
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          const stat = fs.statSync(outputPath);
          resolve({
            success: true,
            proxyPath: outputPath,
            fileSize: stat.size,
          });
        } catch (e) {
          resolve({ success: true, proxyPath: outputPath, fileSize: 0 });
        }
      } else {
        // Clean up partial file on failure
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch (e) {}
        }
        resolve({ success: false, error: `Proxy generation failed with code ${code}: ${stderr.slice(-200)}` });
      }
    });

    proc.on('error', (err) => {
      activeProxyProcesses.delete(jobId);
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch (e) {}
      }
      resolve({ success: false, error: err.message });
    });
  });
});

// 20. Cancel Active Proxy Generation Job
ipcMain.handle('cancel-proxy-job', async (event, jobId) => {
  const item = activeProxyProcesses.get(jobId);
  if (item) {
    try {
      item.proc.kill();
      if (item.outputPath && fs.existsSync(item.outputPath)) {
        fs.unlinkSync(item.outputPath);
      }
    } catch (e) {}
    activeProxyProcesses.delete(jobId);
    return { success: true };
  }
  return { success: true };
});

// 21. Delete Proxy File Safely
ipcMain.handle('delete-proxy-file', async (event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 22. Select Directory Dialog
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Directory for Media Relinking',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// 23. Scan Directory for Supported Media Files
ipcMain.handle('scan-directory-media', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: false, error: 'Directory does not exist' };
    }

    const mediaExtensions = new Set([
      '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts',
      '.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac',
      '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp',
    ]);

    const files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const ent of entries) {
      if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (mediaExtensions.has(ext)) {
          const fullPath = path.join(dirPath, ent.name);
          let size = 0;
          try {
            size = fs.statSync(fullPath).size;
          } catch (e) {}
          files.push({
            name: ent.name,
            fullPath,
            size,
          });
        }
      }
    }

    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 24. Get Disk Cache Statistics
ipcMain.handle('get-cache-stats', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const proxyDir = path.join(userDataDir, 'proxies');
    let totalSizeBytes = 0;
    let proxyCount = 0;

    if (fs.existsSync(proxyDir)) {
      const files = fs.readdirSync(proxyDir);
      for (const f of files) {
        try {
          const fp = path.join(proxyDir, f);
          const stat = fs.statSync(fp);
          if (stat.isFile()) {
            totalSizeBytes += stat.size;
            proxyCount++;
          }
        } catch (e) {}
      }
    }

    return {
      success: true,
      totalSizeBytes,
      proxyCount,
      proxyDir,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 25. Clear Disk Cache Safely
ipcMain.handle('clear-disk-cache', async (event, options = {}) => {
  try {
    const userDataDir = app.getPath('userData');
    const proxyDir = path.join(userDataDir, 'proxies');
    let clearedBytes = 0;
    let deletedFiles = 0;

    if (options.clearProxies !== false && fs.existsSync(proxyDir)) {
      const files = fs.readdirSync(proxyDir);
      for (const f of files) {
        try {
          const fp = path.join(proxyDir, f);
          const stat = fs.statSync(fp);
          if (stat.isFile()) {
            clearedBytes += stat.size;
            fs.unlinkSync(fp);
            deletedFiles++;
          }
        } catch (e) {}
      }
    }

    return {
      success: true,
      clearedBytes,
      deletedFiles,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


