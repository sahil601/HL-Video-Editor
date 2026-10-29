/**
 * Media Relinking & Management Engine for HL Video Editor
 * Detects missing assets, performs safe single-file and batch directory relinking
 * by filename matching, and formats rich media stream details.
 */

import { Project, ProjectAsset } from '../types/project';
import { invalidateAssetCaches } from './cache';
import { formatTimecode } from './time';

export interface RelinkMatch {
  assetId: string;
  assetName: string;
  oldPath: string;
  newPath: string;
  fileSize: number;
}

export interface DirectoryRelinkResult {
  updatedProject: Project;
  relinkedCount: number;
  remainingMissingCount: number;
  matches: RelinkMatch[];
}

export interface FormattedMediaDetails {
  id: string;
  name: string;
  type: string;
  originalPath: string;
  fileSizeFormatted: string;
  durationFormatted: string;
  durationSec: number;
  resolutionFormatted: string;
  aspectRatioFormatted: string;
  fpsFormatted: string;
  hasAudio: boolean;
  audioInfoFormatted: string;
  proxyStatusFormatted: string;
  isMissing: boolean;
}

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Normalize filename for resilient matching (lowercase, strip trailing spaces)
 */
export function normalizeFilename(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Extract clean filename without directory path
 */
export function getFilenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * Inspect and extract comprehensive formatted media details for inspector view
 */
export function getFormattedMediaDetails(asset: ProjectAsset): FormattedMediaDetails {
  const durationSec = Math.max(0, (asset.durationMs || 0) / 1000);
  const w = asset.width;
  const h = asset.height;

  let resolutionFormatted = 'Unknown';
  let aspectRatioFormatted = 'Unknown';
  if (w && h) {
    resolutionFormatted = `${w} × ${h}`;
    // Simplify common aspect ratios
    const ratio = w / h;
    if (Math.abs(ratio - 16 / 9) < 0.05) aspectRatioFormatted = '16:9 Widescreen';
    else if (Math.abs(ratio - 9 / 16) < 0.05) aspectRatioFormatted = '9:16 Vertical';
    else if (Math.abs(ratio - 1) < 0.05) aspectRatioFormatted = '1:1 Square';
    else if (Math.abs(ratio - 4 / 5) < 0.05) aspectRatioFormatted = '4:5 Portrait';
    else if (Math.abs(ratio - 21 / 9) < 0.05) aspectRatioFormatted = '21:9 Ultrawide';
    else aspectRatioFormatted = `${ratio.toFixed(2)}:1`;
  }

  let fpsFormatted = 'N/A';
  if (asset.fps) {
    fpsFormatted = `${asset.fps} fps`;
  }

  let audioInfo = 'No Audio Stream';
  const hasAudio = asset.type === 'audio' || (asset.type === 'video' && asset.durationMs > 0);
  if (hasAudio) {
    audioInfo = 'Audio Track Present';
  }

  let proxyStatus = 'Not Generated';
  if (asset.proxyStatus === 'ready') {
    proxyStatus = `Ready (${asset.proxyQuality || '540p'}${asset.proxyFileSize ? ', ' + formatBytes(asset.proxyFileSize) : ''})`;
  } else if (asset.proxyStatus === 'generating') {
    proxyStatus = `Generating... (${asset.proxyProgress || 0}%)`;
  } else if (asset.proxyStatus === 'error') {
    proxyStatus = `Error: ${asset.proxyError || 'Failed to generate'}`;
  }

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type.toUpperCase(),
    originalPath: asset.originalPath || asset.relativePath || 'In-Memory Asset',
    fileSizeFormatted: formatBytes(asset.fileSize),
    durationFormatted: formatTimecode(asset.durationMs || 0),
    durationSec: Number(durationSec.toFixed(2)),
    resolutionFormatted,
    aspectRatioFormatted,
    fpsFormatted,
    hasAudio,
    audioInfoFormatted: audioInfo,
    proxyStatusFormatted: proxyStatus,
    isMissing: !!asset.isMissing,
  };
}

/**
 * Relink a single asset to a new absolute file path
 */
export function relinkSingleAsset(
  project: Project,
  assetId: string,
  newPath: string,
  newSize?: number,
  newDurationMs?: number
): Project {
  invalidateAssetCaches(assetId);

  const updatedAssets = project.assets.map((asset) => {
    if (asset.id !== assetId) return asset;

    const newName = getFilenameFromPath(newPath);
    return {
      ...asset,
      originalPath: newPath,
      name: newName,
      fileSize: newSize !== undefined ? newSize : asset.fileSize,
      durationMs: newDurationMs !== undefined ? newDurationMs : asset.durationMs,
      isMissing: false,
    };
  });

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    assets: updatedAssets,
  };
}

/**
 * Scan a directory's files and safely batch relink all matching missing assets by filename
 */
export function relinkDirectoryByMatchingFiles(
  project: Project,
  availableFiles: { name: string; fullPath: string; size?: number }[]
): DirectoryRelinkResult {
  // Build lookup map from normalized filename to candidate file info
  const fileMap = new Map<string, { fullPath: string; size?: number }>();
  for (const f of availableFiles) {
    const key = normalizeFilename(f.name);
    if (!fileMap.has(key)) {
      fileMap.set(key, { fullPath: f.fullPath, size: f.size });
    }
  }

  const matches: RelinkMatch[] = [];
  let relinkedCount = 0;

  const updatedAssets = project.assets.map((asset) => {
    // Check if missing or needs relinking
    if (!asset.isMissing && asset.originalPath) return asset;

    const targetKey = normalizeFilename(asset.name || getFilenameFromPath(asset.originalPath || ''));
    const candidate = fileMap.get(targetKey);

    if (candidate) {
      relinkedCount++;
      invalidateAssetCaches(asset.id);
      matches.push({
        assetId: asset.id,
        assetName: asset.name,
        oldPath: asset.originalPath,
        newPath: candidate.fullPath,
        fileSize: candidate.size || asset.fileSize,
      });

      return {
        ...asset,
        originalPath: candidate.fullPath,
        fileSize: candidate.size !== undefined ? candidate.size : asset.fileSize,
        isMissing: false,
      };
    }

    return asset;
  });

  const remainingMissingCount = updatedAssets.filter((a) => a.isMissing).length;

  return {
    updatedProject: {
      ...project,
      updatedAt: new Date().toISOString(),
      assets: updatedAssets,
    },
    relinkedCount,
    remainingMissingCount,
    matches,
  };
}
