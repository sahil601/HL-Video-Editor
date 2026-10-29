export interface VnestNativeBridge {
  isDesktop: boolean;
  selectMediaFiles: () => Promise<string[]>;
  selectOpenProject: () => Promise<{ filePath: string; buffer: ArrayBuffer } | null>;
  selectSaveProject: (defaultName?: string) => Promise<string | null>;
  saveFileBinary: (targetPath: string, buffer: ArrayBuffer) => Promise<{ success: boolean; error?: string }>;
  readFileBinary: (targetPath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
  selectExportDestination: (defaultFilename?: string) => Promise<string | null>;
  probeMedia: (filePath: string) => Promise<{
    success: boolean;
    data?: {
      durationMs: number;
      fileSize: number;
      width?: number;
      height?: number;
      fps?: number;
      hasAudio: boolean;
      audioChannels?: number;
      sampleRate?: number;
    };
    error?: string;
  }>;
  generateThumbnail: (filePath: string, timeSec?: number) => Promise<{ success: boolean; base64?: string; error?: string }>;
  startFFmpegExport: (
    exportArgs: string[],
    totalDurationMs: number,
    tempOutputPath?: string,
    finalOutputPath?: string
  ) => Promise<{
    success: boolean;
    validated?: boolean;
    fileSize?: number;
    durationMs?: number;
    error?: string;
  }>;
  cancelFFmpegExport: () => Promise<{ success: boolean; error?: string }>;
  onFFmpegProgress: (callback: (data: { line: string; totalDurationMs: number }) => void) => () => void;
  getAvailableEncoders: () => Promise<{
    success: boolean;
    encoders: import('./export').DetectedEncoder[];
    error?: string;
  }>;
  checkFileExists: (filePath: string) => Promise<{ exists: boolean; size?: number }>;
  revealInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  validateExportFile: (filePath: string) => Promise<{
    success: boolean;
    data?: {
      durationMs: number;
      fileSize: number;
      width?: number;
      height?: number;
      fps?: number;
      hasAudio: boolean;
      audioChannels?: number;
      sampleRate?: number;
      codec?: string;
    };
    error?: string;
  }>;
  transcribeMedia: (options: {
    inputPath: string;
    language?: string;
    model?: string;
    wordTimestamps?: boolean;
  }) => Promise<{
    success: boolean;
    text?: string;
    segments?: import('../core/captions/types').CaptionSegment[];
    error?: string;
  }>;
  onTranscriptionProgress: (callback: (progress: import('../core/captions/types').TranscriptionProgress) => void) => () => void;
  selectSubtitleDestination: (defaultFilename?: string, format?: 'srt' | 'vtt') => Promise<string | null>;
  saveTextFile: (targetPath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  selectFontFile: () => Promise<{ filePath: string; fontName: string; dataBase64: string; format: string } | null>;
  detectSilence: (
    filePath: string,
    options?: { noiseDb?: number; durationSec?: number }
  ) => Promise<{
    success: boolean;
    silences?: Array<{
      startSec: number;
      endSec: number;
      durationSec: number;
      startMs: number;
      endMs: number;
      durationMs: number;
    }>;
    error?: string;
  }>;
  detectScenes: (
    filePath: string,
    options?: { threshold?: number; minSceneDurationSec?: number }
  ) => Promise<{
    success: boolean;
    sceneChanges?: Array<{ timeSec: number; timeMs: number }>;
    error?: string;
  }>;
  detectWatermarkCandidate: (
    filePath: string
  ) => Promise<{
    success: boolean;
    candidate?: {
      positionX: number;
      positionY: number;
      width: number;
      height: number;
      corner: string;
      confidence: number;
    };
    error?: string;
  }>;
  selectCubeLutFile: () => Promise<{ filePath: string; fileName: string; content: string } | null>;
  generateProxy: (jobId: string, inputPath: string, quality?: string, totalDurationSec?: number) => Promise<{
    success: boolean;
    proxyPath?: string;
    fileSize?: number;
    error?: string;
  }>;
  cancelProxyJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  deleteProxyFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  onProxyProgress: (callback: (data: { jobId: string; percent: number; speed?: string }) => void) => () => void;
  selectDirectory: () => Promise<string | null>;
  scanDirectoryMedia: (dirPath: string) => Promise<{
    success: boolean;
    files?: Array<{ name: string; fullPath: string; size: number }>;
    error?: string;
  }>;
  getCacheStats: () => Promise<{
    success: boolean;
    totalSizeBytes: number;
    proxyCount: number;
    proxyDir?: string;
    error?: string;
  }>;
  clearDiskCache: (options?: { clearProxies?: boolean; clearThumbnails?: boolean }) => Promise<{
    success: boolean;
    clearedBytes: number;
    deletedFiles: number;
    error?: string;
  }>;
}

declare global {
  interface Window {
    vnestNative?: VnestNativeBridge;
  }
}
