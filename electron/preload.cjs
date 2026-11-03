const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vnestNative', {
  isDesktop: true,
  selectMediaFiles: () => ipcRenderer.invoke('select-media-files'),
  selectOpenProject: () => ipcRenderer.invoke('select-open-project'),
  selectSaveProject: (defaultName) => ipcRenderer.invoke('select-save-project', defaultName),
  saveFileBinary: (targetPath, buffer) => ipcRenderer.invoke('save-file-binary', targetPath, buffer),
  readFileBinary: (targetPath) => ipcRenderer.invoke('read-file-binary', targetPath),
  selectExportDestination: (defaultFilename) => ipcRenderer.invoke('select-export-destination', defaultFilename),
  probeMedia: (filePath) => ipcRenderer.invoke('probe-media', filePath),
  generateThumbnail: (filePath, timeSec) => ipcRenderer.invoke('generate-thumbnail', filePath, timeSec),
  startFFmpegExport: (exportArgs, totalDurationMs, tempOutputPath, finalOutputPath) =>
    ipcRenderer.invoke('start-ffmpeg-export', exportArgs, totalDurationMs, tempOutputPath, finalOutputPath),
  cancelFFmpegExport: () => ipcRenderer.invoke('cancel-ffmpeg-export'),
  onFFmpegProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('ffmpeg-export-progress', handler);
    return () => ipcRenderer.removeListener('ffmpeg-export-progress', handler);
  },
  getAvailableEncoders: () => ipcRenderer.invoke('get-available-encoders'),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
  revealInFolder: (filePath) => ipcRenderer.invoke('reveal-in-folder', filePath),
  validateExportFile: (filePath) => ipcRenderer.invoke('validate-export-file', filePath),
  transcribeMedia: (options) => ipcRenderer.invoke('transcribe-media', options),
  onTranscriptionProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('transcription-progress', handler);
    return () => ipcRenderer.removeListener('transcription-progress', handler);
  },
  selectSubtitleDestination: (defaultFilename, format) => ipcRenderer.invoke('select-subtitle-destination', defaultFilename, format),
  saveTextFile: (targetPath, content) => ipcRenderer.invoke('save-text-file', targetPath, content),
  selectFontFile: () => ipcRenderer.invoke('select-font-file'),
  detectSilence: (filePath, options) => ipcRenderer.invoke('detect-silence', filePath, options),
  detectScenes: (filePath, options) => ipcRenderer.invoke('detect-scenes', filePath, options),
  detectWatermarkCandidate: (filePath) => ipcRenderer.invoke('detect-watermark-candidate', filePath),
  selectCubeLutFile: () => ipcRenderer.invoke('select-cube-lut-file'),
  generateProxy: (jobId, inputPath, quality, totalDurationSec) => ipcRenderer.invoke('generate-proxy', jobId, inputPath, quality, totalDurationSec),
  cancelProxyJob: (jobId) => ipcRenderer.invoke('cancel-proxy-job', jobId),
  deleteProxyFile: (filePath) => ipcRenderer.invoke('delete-proxy-file', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  onProxyProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('proxy-job-progress', handler);
    return () => ipcRenderer.removeListener('proxy-job-progress', handler);
  },
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectoryMedia: (dirPath) => ipcRenderer.invoke('scan-directory-media', dirPath),
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  clearDiskCache: (options) => ipcRenderer.invoke('clear-disk-cache', options),
});

