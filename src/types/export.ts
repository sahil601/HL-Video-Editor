import { AspectRatio } from './project';
import { ExportPreset } from './timeline';

export type ExportPlatformCategory = 'all' | 'youtube' | 'instagram' | 'tiktok' | 'cinema' | 'general' | 'custom';

export type VideoCodecId =
  | 'libx264'
  | 'h264_qsv'
  | 'h264_nvenc'
  | 'h264_amf'
  | 'libx265'
  | 'hevc_qsv'
  | 'hevc_nvenc'
  | 'hevc_amf'
  | 'libvpx-vp9'
  | 'prores_ks';

export type AudioCodecId = 'aac' | 'libmp3lame' | 'pcm_s16le';

export interface DetectedEncoder {
  id: string;
  name: string;
  codecType: 'h264' | 'hevc' | 'vp9' | 'prores';
  isHardware: boolean;
  isAvailable: boolean;
  fallbackEncoder: string;
}

export interface ProfessionalExportPreset extends ExportPreset {
  category?: ExportPlatformCategory;
  audioCodec?: AudioCodecId;
  crf?: number;
  rateControl?: 'vbr' | 'cbr' | 'crf';
  isCustom?: boolean;
  tag?: string;
}

export interface CustomExportConfig {
  name: string;
  width: number;
  height: number;
  fps: number;
  aspectRatio: AspectRatio | string;
  videoCodec: VideoCodecId | string;
  audioCodec: AudioCodecId;
  videoBitrate: string;
  audioBitrate: string;
  format: 'mp4' | 'mov' | 'mkv' | 'webm';
  rateControl: 'vbr' | 'cbr' | 'crf';
  crf: number;
}

export type ExportJobStatus = 'queued' | 'rendering' | 'validating' | 'completed' | 'failed' | 'cancelled';

export interface ExportQueueJob {
  id: string;
  projectId: string;
  projectName: string;
  preset: ProfessionalExportPreset;
  destinationPath: string;
  tempPath?: string;
  useProxies: boolean;
  burnCaptions: boolean;
  status: ExportJobStatus;
  progress: number; // 0 to 100
  statusMessage: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationSec?: number;
  outputSizeBytes?: number;
  encoderUsed?: string;
  validated?: boolean;
}

export interface ExportHistoryRecord {
  id: string;
  jobId: string;
  projectId: string;
  projectName: string;
  presetName: string;
  destinationPath: string;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
  status: 'completed' | 'failed' | 'cancelled';
  fileSizeBytes?: number;
  durationSec?: number;
  completedAt: string;
  error?: string;
}
