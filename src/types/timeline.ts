export type ToolMode = 'select' | 'split' | 'trim';

export interface TimelineSelection {
  clipIds: string[];
  trackId?: string;
}

export interface SnapPoint {
  timeMs: number;
  label: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  videoBitrate: string; // e.g. "8M"
  audioBitrate: string; // e.g. "192k"
  format: 'mp4' | 'mov' | 'mkv' | 'webm';
  codec: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  outputPath: string;
  preset: ExportPreset;
  status: 'idle' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0 to 100
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
  error?: string;
}

export * from './export';
