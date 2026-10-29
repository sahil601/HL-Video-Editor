/**
 * Proxy Media Generation & Management Engine for HL Video Editor
 * Generates lightweight H.264 proxy video files at 360p/540p/720p resolutions
 * with +faststart flags for stutter-free timeline playback on large projects.
 */

import { ProjectAsset, ProxyQuality, ProxySettings } from '../types/project';

export interface ProxyQualityProfile {
  quality: ProxyQuality;
  label: string;
  width: number;
  height: number;
  crf: number;
  videoBitrate: string;
  audioBitrate: string;
  description: string;
}

export const PROXY_PROFILES: Record<ProxyQuality, ProxyQualityProfile> = {
  '360p': {
    quality: '360p',
    label: '360p (Fastest)',
    width: 640,
    height: 360,
    crf: 28,
    videoBitrate: '800k',
    audioBitrate: '96k',
    description: 'Ultra-low CPU usage, fast generation, minimal disk footprint',
  },
  '540p': {
    quality: '540p',
    label: '540p (Balanced)',
    width: 960,
    height: 540,
    crf: 26,
    videoBitrate: '1500k',
    audioBitrate: '128k',
    description: 'Recommended standard for smooth editing and clear preview',
  },
  '720p': {
    quality: '720p',
    label: '720p (High Clarity)',
    width: 1280,
    height: 720,
    crf: 23,
    videoBitrate: '3000k',
    audioBitrate: '160k',
    description: 'Crisp HD preview for multi-monitor setups',
  },
};

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: true,
  quality: '540p',
  autoGenerateOnImport: false,
  useForExport: false,
};

/**
 * Checks if a media asset supports proxy video generation
 */
export function isProxyEligible(asset: ProjectAsset): boolean {
  if (asset.type !== 'video') return false;
  const pathOrName = (asset.originalPath || asset.name || '').toLowerCase();
  const validExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts'];
  return validExtensions.some((ext) => pathOrName.endsWith(ext));
}

/**
 * Builds FFmpeg command-line arguments to transcode a source video into an optimized proxy
 */
export function buildProxyFFmpegArgs(
  inputPath: string,
  outputPath: string,
  quality: ProxyQuality = '540p'
): string[] {
  const profile = PROXY_PROFILES[quality] || PROXY_PROFILES['540p'];

  return [
    '-y',
    '-hide_banner',
    '-i', inputPath,
    // Maintain aspect ratio, never upscale smaller footage, ensure dimensions are even integers for libx264
    '-vf', `scale=w='min(iw,${profile.width})':h='-2'`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', String(profile.crf),
    '-c:a', 'aac',
    '-b:a', profile.audioBitrate,
    '-pix_fmt', 'yuv420p',
    // +faststart moves moov atom to the front for instant HTML5 video seeking
    '-movflags', '+faststart',
    outputPath,
  ];
}

/**
 * Parses stderr progress output from FFmpeg proxy generation
 */
export function parseProxyProgress(line: string, totalDurationSec: number): { percent: number; speed?: string } | null {
  if (totalDurationSec <= 0) return null;

  const timeMatch = line.match(/time=\s*([0-9]{2}):([0-9]{2}):([0-9]{2}\.[0-9]+)/);
  if (!timeMatch) return null;

  const hours = parseFloat(timeMatch[1]);
  const minutes = parseFloat(timeMatch[2]);
  const seconds = parseFloat(timeMatch[3]);
  const currentSec = hours * 3600 + minutes * 60 + seconds;

  const percent = Math.min(100, Math.max(0, Math.round((currentSec / totalDurationSec) * 100)));

  const speedMatch = line.match(/speed=\s*([0-9.]+)x/);
  const speed = speedMatch ? `${speedMatch[1]}x` : undefined;

  return { percent, speed };
}

/**
 * Resolves the effective preview URL for an asset based on proxy state and user setting
 */
export function getEffectivePreviewUrl(
  asset: ProjectAsset,
  useProxies: boolean,
  proxyUrlMap: Map<string, string>,
  rawAssetUrlMap: Map<string, string>
): string | undefined {
  if (useProxies && asset.proxyStatus === 'ready') {
    const proxyUrl = proxyUrlMap.get(asset.id);
    if (proxyUrl) return proxyUrl;
  }
  return rawAssetUrlMap.get(asset.id);
}

/**
 * Resolves the effective file path to use during export
 * By default, uses original full-resolution media unless useForExport is explicitly true
 */
export function getEffectiveExportPath(
  asset: ProjectAsset,
  useForExport: boolean
): string {
  if (useForExport && asset.proxyPath && asset.proxyStatus === 'ready') {
    return asset.proxyPath;
  }
  return asset.originalPath || asset.relativePath || '';
}
