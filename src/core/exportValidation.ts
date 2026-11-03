import { Project } from '../types/project';
import { ProfessionalExportPreset } from '../types/export';

export interface MissingMediaInfo {
  clipId: string;
  clipName: string;
  assetId?: string;
  trackName: string;
  expectedPath?: string;
}

export interface ExportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingMedia: MissingMediaInfo[];
  activeClipCount: number;
  totalDurationMs: number;
}

/**
 * Pre-flight validation for project export
 * Validates timeline duration, active media presence, preset configurations, and missing assets.
 */
export function validateProjectForExport(
  project: Project,
  preset: ProfessionalExportPreset,
  outputPath: string,
  assetPathResolver: (assetId: string) => string | null,
  options?: {
    assetBinaryMap?: Map<string, Blob>;
  }
): ExportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingMedia: MissingMediaInfo[] = [];

  // 1. Duration & Clip Count Checks
  if (project.durationMs <= 0) {
    errors.push('Cannot export empty project: timeline duration is 0ms.');
  }

  let activeClipCount = 0;
  for (const track of project.tracks) {
    if (track.isMuted) continue;

    for (const clip of track.clips) {
      activeClipCount++;

      // Check missing media for media clips (video, audio, image, overlay)
      if (clip.type === 'video' || clip.type === 'audio' || clip.type === 'image' || clip.type === 'overlay') {
        let hasData = false;

        // Check asset resolver
        if (clip.assetId) {
          const resolved = assetPathResolver(clip.assetId);
          if (resolved && resolved.trim().length > 0) {
            hasData = true;
          }
        } else {
          const resolved = assetPathResolver(clip.id);
          if (resolved && resolved.trim().length > 0) {
            hasData = true;
          }
        }

        // Check in-memory binary blobs (e.g. voiceover, synthesized SFX)
        if (!hasData && options?.assetBinaryMap && clip.assetId) {
          if (options.assetBinaryMap.has(clip.assetId)) {
            hasData = true;
          }
        }

        if (!hasData) {
          const asset = project.assets.find((a) => a.id === clip.assetId);
          missingMedia.push({
            clipId: clip.id,
            clipName: clip.name,
            assetId: clip.assetId,
            trackName: track.name,
            expectedPath: asset?.originalPath || asset?.relativePath,
          });
        }
      }
    }
  }

  if (activeClipCount === 0) {
    errors.push('No active clips found on unmuted tracks. Add media clips or unmute tracks before exporting.');
  }

  if (missingMedia.length > 0) {
    errors.push(
      `Missing media detected for ${missingMedia.length} clip(s): ${missingMedia
        .map((m) => `"${m.clipName}" (${m.trackName})`)
        .slice(0, 3)
        .join(', ')}${missingMedia.length > 3 ? ` and ${missingMedia.length - 3} more` : ''}. Relink missing media before export.`
    );
  }

  // 2. Preset Dimensional Checks
  if (!preset.width || preset.width <= 0 || !preset.height || preset.height <= 0) {
    errors.push(`Invalid export dimensions: ${preset.width}x${preset.height}. Dimensions must be positive integers.`);
  } else {
    // H.264/HEVC yuv420p requires even width and height
    if (preset.width % 2 !== 0 || preset.height % 2 !== 0) {
      errors.push(
        `Export dimensions must be even numbers for standard video encoding: ${preset.width}x${preset.height}.`
      );
    }
  }

  // 3. Framerate Checks
  if (!preset.fps || preset.fps <= 0 || preset.fps > 240) {
    errors.push(`Invalid frame rate: ${preset.fps} fps. Frame rate must be between 1 and 240 fps.`);
  }

  // 4. Destination Checks & Container Compatibility
  if (!outputPath || outputPath.trim().length === 0) {
    errors.push('Destination path is required. Click "Choose" to select an output destination file.');
  } else {
    const lowerDest = outputPath.toLowerCase().trim();
    if (preset.codec === 'prores_ks' || preset.codec === 'prores') {
      if (!lowerDest.endsWith('.mov') && !lowerDest.endsWith('.mkv')) {
        errors.push('Apple ProRes encoding requires a .mov or .mkv container format. Please change the export file extension to .mov.');
      }
    } else if (preset.codec === 'libvpx-vp9') {
      if (!lowerDest.endsWith('.webm') && !lowerDest.endsWith('.mkv')) {
        errors.push('VP9 video encoding requires a .webm or .mkv container format. Please change the export file extension to .webm.');
      }
    }
  }

  // 5. Warnings (Non-fatal advisory notices)
  if (preset.fps > 60) {
    warnings.push(`High frame rate (${preset.fps} fps) may increase render time and file size significantly.`);
  }
  if (preset.width >= 3840 && preset.videoBitrate && parseInt(preset.videoBitrate, 10) < 20) {
    warnings.push('Low bitrate selected for 4K resolution; visual artifacts may occur.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingMedia,
    activeClipCount,
    totalDurationMs: project.durationMs,
  };
}

/**
 * Sanitizes a proposed export filename
 */
export function sanitizeExportFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Export';
}
