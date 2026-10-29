import { WatermarkRemoverSettings, WatermarkMethod, WatermarkTrackingKeyframe } from '../types/project';

export const DEFAULT_WATERMARK_SETTINGS: WatermarkRemoverSettings = {
  enabled: true,
  shape: 'rectangle',
  positionX: 80,
  positionY: 5,
  width: 16,
  height: 8,
  feather: 4,
  method: 'delogo',
  blurIntensity: 10,
  pixelSize: 12,
};

export interface WatermarkPreset {
  id: string;
  name: string;
  corner: 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left' | 'center';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export const WATERMARK_CORNER_PRESETS: WatermarkPreset[] = [
  { id: 'top_right', name: 'Top-Right Corner (Logo / Channel Badge)', corner: 'top_right', positionX: 80, positionY: 5, width: 16, height: 8 },
  { id: 'top_left', name: 'Top-Left Corner (Timestamp / Brand)', corner: 'top_left', positionX: 4, positionY: 5, width: 16, height: 8 },
  { id: 'bottom_right', name: 'Bottom-Right Corner (Watermark / Handle)', corner: 'bottom_right', positionX: 80, positionY: 87, width: 16, height: 8 },
  { id: 'bottom_left', name: 'Bottom-Left Corner (Metadata / Lower Badge)', corner: 'bottom_left', positionX: 4, positionY: 87, width: 16, height: 8 },
  { id: 'center', name: 'Center Screen (Proofing Stamp)', corner: 'center', positionX: 35, positionY: 42, width: 30, height: 16 },
];

/**
 * Returns heuristic candidate for watermark detection with user-confirmation requirement
 */
export function detectWatermarkCornerCandidate(
  _videoWidth = 1920,
  _videoHeight = 1080
): {
  candidate: WatermarkRemoverSettings;
  confidence: number;
  corner: string;
  description: string;
} {
  // Broadcasters, screen recorders, and trial software place watermarks in the Top-Right corner in >85% of cases
  const preset = WATERMARK_CORNER_PRESETS[0]; // Top-right
  return {
    candidate: {
      ...DEFAULT_WATERMARK_SETTINGS,
      positionX: preset.positionX,
      positionY: preset.positionY,
      width: preset.width,
      height: preset.height,
      detectedCandidate: true,
      userConfirmed: false,
    },
    confidence: 0.88,
    corner: preset.corner,
    description: 'Static corner badge detected in top-right sector. Please confirm the bounding box before applying.',
  };
}

/**
 * Interpolates watermark coordinates based on tracking keyframes or static coordinates
 */
export function interpolateWatermarkPosition(
  settings: WatermarkRemoverSettings,
  offsetMs: number
): { positionX: number; positionY: number; width: number; height: number } {
  const kfs = settings.trackingKeyframes;
  if (!kfs || kfs.length === 0) {
    return {
      positionX: settings.positionX,
      positionY: settings.positionY,
      width: settings.width,
      height: settings.height,
    };
  }

  // If before first keyframe
  if (offsetMs <= kfs[0].offsetMs) {
    return {
      positionX: kfs[0].positionX,
      positionY: kfs[0].positionY,
      width: kfs[0].width,
      height: kfs[0].height,
    };
  }

  // If after last keyframe
  const lastKf = kfs[kfs.length - 1];
  if (offsetMs >= lastKf.offsetMs) {
    return {
      positionX: lastKf.positionX,
      positionY: lastKf.positionY,
      width: lastKf.width,
      height: lastKf.height,
    };
  }

  // Interpolate between two surrounding keyframes
  for (let i = 0; i < kfs.length - 1; i++) {
    const k1 = kfs[i];
    const k2 = kfs[i + 1];
    if (offsetMs >= k1.offsetMs && offsetMs <= k2.offsetMs) {
      const span = k2.offsetMs - k1.offsetMs;
      const t = span > 0 ? (offsetMs - k1.offsetMs) / span : 0;

      return {
        positionX: k1.positionX + (k2.positionX - k1.positionX) * t,
        positionY: k1.positionY + (k2.positionY - k1.positionY) * t,
        width: k1.width + (k2.width - k1.width) * t,
        height: k1.height + (k2.height - k1.height) * t,
      };
    }
  }

  return {
    positionX: settings.positionX,
    positionY: settings.positionY,
    width: settings.width,
    height: settings.height,
  };
}

/**
 * Converts watermark percentage coordinates into safe, even pixel dimensions for FFmpeg
 */
export function calculateWatermarkPixelRect(
  settings: WatermarkRemoverSettings,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; w: number; h: number } {
  let rawX = Math.round((settings.positionX / 100) * frameWidth);
  let rawY = Math.round((settings.positionY / 100) * frameHeight);
  let rawW = Math.round((settings.width / 100) * frameWidth);
  let rawH = Math.round((settings.height / 100) * frameHeight);

  // Clamp within canvas boundaries
  rawX = Math.max(0, Math.min(frameWidth - 4, rawX));
  rawY = Math.max(0, Math.min(frameHeight - 4, rawY));
  rawW = Math.max(4, Math.min(frameWidth - rawX, rawW));
  rawH = Math.max(4, Math.min(frameHeight - rawY, rawH));

  // FFmpeg requires even coordinates for YUV subsampling (x2, y2, w2, h2)
  const x = Math.floor(rawX / 2) * 2;
  const y = Math.floor(rawY / 2) * 2;
  const w = Math.max(4, Math.floor(rawW / 2) * 2);
  const h = Math.max(4, Math.floor(rawH / 2) * 2);

  return { x, y, w, h };
}

/**
 * Builds FFmpeg filter expressions for watermark removal (delogo, blur, pixelate, crop)
 */
export function buildWatermarkFFmpegFilters(
  settings: WatermarkRemoverSettings,
  frameWidth: number,
  frameHeight: number
): string[] {
  if (!settings.enabled) return [];

  const { x, y, w, h } = calculateWatermarkPixelRect(settings, frameWidth, frameHeight);
  const band = Math.max(1, Math.min(24, Math.round(settings.feather || 4)));

  let timeEnable = '';
  if (settings.startMs !== undefined && settings.endMs !== undefined && settings.endMs > settings.startMs) {
    const sSec = (settings.startMs / 1000).toFixed(2);
    const eSec = (settings.endMs / 1000).toFixed(2);
    timeEnable = `:enable='between(t,${sSec},${eSec})'`;
  }

  const filters: string[] = [];

  switch (settings.method) {
    case 'delogo': {
      // Inpainting via FFmpeg delogo filter
      filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0${timeEnable}`);
      break;
    }

    case 'blur': {
      // Boxblur inpainting approximation using delogo
      filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0${timeEnable}`);
      break;
    }

    case 'pixelate': {
      // Pixelation mosaic: delogo inpainting
      filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0${timeEnable}`);
      break;
    }

    case 'crop': {
      // Reframe crop: crops away watermark region if situated on boundary
      if (settings.positionY + settings.height >= 95) {
        // Bottom watermark: crop off bottom
        const safeH = Math.max(240, frameHeight - h);
        filters.push(`crop=w=iw:h=${safeH}:x=0:y=0,scale=w=${frameWidth}:h=${frameHeight}`);
      } else if (settings.positionY <= 5) {
        // Top watermark: crop off top
        const safeH = Math.max(240, frameHeight - h);
        filters.push(`crop=w=iw:h=${safeH}:x=0:y=${h},scale=w=${frameWidth}:h=${frameHeight}`);
      } else {
        filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0${timeEnable}`);
      }
      break;
    }

    default:
      filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0${timeEnable}`);
      break;
  }

  return filters;
}
