import { Keyframe, KeyframeEasing, ClipTransform, BezierControlPoints } from '../types/project';

/**
 * Evaluates a cubic Bézier curve at normalized progress t (0 to 1).
 * Control points are P0(0,0), P1(x1,y1), P2(x2,y2), P3(1,1).
 * Solves for parameter u where B_x(u) = t using Newton-Raphson, then evaluates B_y(u).
 */
export function evaluateCubicBezier(
  t: number,
  x1: number = 0.42,
  y1: number = 0.0,
  x2: number = 0.58,
  y2: number = 1.0
): number {
  const clampT = Math.max(0, Math.min(1, t));
  if (clampT === 0) return 0;
  if (clampT === 1) return 1;

  // Newton-Raphson iteration to find u such that B_x(u) = clampT
  let u = clampT;
  for (let i = 0; i < 8; i++) {
    const oneMinusU = 1 - u;
    const bx = 3 * oneMinusU * oneMinusU * u * x1 + 3 * oneMinusU * u * u * x2 + u * u * u;
    const diff = bx - clampT;
    if (Math.abs(diff) < 1e-5) break;

    const dbx =
      3 * oneMinusU * oneMinusU * x1 +
      6 * oneMinusU * u * (x2 - x1) +
      3 * u * u * (1 - x2);
    if (Math.abs(dbx) < 1e-6) break;
    u -= diff / dbx;
    u = Math.max(0, Math.min(1, u));
  }

  // Calculate B_y(u)
  const oneMinusU = 1 - u;
  return (
    3 * oneMinusU * oneMinusU * u * y1 +
    3 * oneMinusU * u * u * y2 +
    u * u * u
  );
}

/**
 * Evaluates easing curves for keyframe transitions
 */
export function evaluateEasing(
  progress: number,
  easing: KeyframeEasing,
  handles?: BezierControlPoints
): number {
  const t = Math.max(0, Math.min(1, progress));
  if (easing === 'bezier') {
    const cp1x = handles?.cp1x !== undefined ? handles.cp1x : 0.42;
    const cp1y = handles?.cp1y !== undefined ? handles.cp1y : 0.0;
    const cp2x = handles?.cp2x !== undefined ? handles.cp2x : 0.58;
    const cp2y = handles?.cp2y !== undefined ? handles.cp2y : 1.0;
    return evaluateCubicBezier(t, cp1x, cp1y, cp2x, cp2y);
  }
  switch (easing) {
    case 'easeIn':
      return t * t * t;
    case 'easeOut':
      return 1 - Math.pow(1 - t, 3);
    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'linear':
    default:
      return t;
  }
}


export interface EvaluatedClipProperties extends ClipTransform {
  volume: number;
  exposure?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

/**
 * Interpolates clip transform, audio volume, and color grading at a specific relative millisecond offset within the clip
 */
export function interpolateKeyframes(
  baseTransform: ClipTransform,
  baseVolume: number,
  keyframes: Keyframe[],
  clipOffsetMs: number
): EvaluatedClipProperties {
  if (!keyframes || keyframes.length === 0) {
    return {
      ...baseTransform,
      volume: baseVolume,
    };
  }

  // Sort keyframes by offset ascending
  const sorted = [...keyframes].sort((a, b) => a.offsetMs - b.offsetMs);

  // If offset is before or at the first keyframe
  if (clipOffsetMs <= sorted[0].offsetMs) {
    const kf = sorted[0].properties;
    return {
      positionX: kf.positionX ?? baseTransform.positionX,
      positionY: kf.positionY ?? baseTransform.positionY,
      scale: kf.scale ?? baseTransform.scale,
      rotation: kf.rotation ?? baseTransform.rotation,
      opacity: kf.opacity ?? baseTransform.opacity,
      volume: kf.volume ?? baseVolume,
      exposure: kf.exposure,
      brightness: kf.brightness,
      contrast: kf.contrast,
      saturation: kf.saturation,
    };
  }

  // If offset is after or at the last keyframe
  const last = sorted[sorted.length - 1];
  if (clipOffsetMs >= last.offsetMs) {
    const kf = last.properties;
    return {
      positionX: kf.positionX ?? baseTransform.positionX,
      positionY: kf.positionY ?? baseTransform.positionY,
      scale: kf.scale ?? baseTransform.scale,
      rotation: kf.rotation ?? baseTransform.rotation,
      opacity: kf.opacity ?? baseTransform.opacity,
      volume: kf.volume ?? baseVolume,
      exposure: kf.exposure,
      brightness: kf.brightness,
      contrast: kf.contrast,
      saturation: kf.saturation,
    };
  }

  // Find surrounding keyframes K1 and K2
  let k1 = sorted[0];
  let k2 = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (clipOffsetMs >= sorted[i].offsetMs && clipOffsetMs <= sorted[i + 1].offsetMs) {
      k1 = sorted[i];
      k2 = sorted[i + 1];
      break;
    }
  }

  const span = k2.offsetMs - k1.offsetMs;
  if (span <= 0) {
    const kf = k2.properties;
    return {
      positionX: kf.positionX ?? baseTransform.positionX,
      positionY: kf.positionY ?? baseTransform.positionY,
      scale: kf.scale ?? baseTransform.scale,
      rotation: kf.rotation ?? baseTransform.rotation,
      opacity: kf.opacity ?? baseTransform.opacity,
      volume: kf.volume ?? baseVolume,
      exposure: kf.exposure,
      brightness: kf.brightness,
      contrast: kf.contrast,
      saturation: kf.saturation,
    };
  }

  const rawProgress = (clipOffsetMs - k1.offsetMs) / span;
  const eased = evaluateEasing(rawProgress, k1.easing, k1.bezierHandles);

  const lerp = (v1?: number, v2?: number, fallback: number = 0) => {
    const val1 = v1 ?? fallback;
    const val2 = v2 ?? fallback;
    return val1 + (val2 - val1) * eased;
  };

  const hasExposure = k1.properties.exposure !== undefined || k2.properties.exposure !== undefined;
  const hasBrightness = k1.properties.brightness !== undefined || k2.properties.brightness !== undefined;
  const hasContrast = k1.properties.contrast !== undefined || k2.properties.contrast !== undefined;
  const hasSaturation = k1.properties.saturation !== undefined || k2.properties.saturation !== undefined;

  return {
    positionX: lerp(k1.properties.positionX, k2.properties.positionX, baseTransform.positionX),
    positionY: lerp(k1.properties.positionY, k2.properties.positionY, baseTransform.positionY),
    scale: lerp(k1.properties.scale, k2.properties.scale, baseTransform.scale),
    rotation: lerp(k1.properties.rotation, k2.properties.rotation, baseTransform.rotation),
    opacity: lerp(k1.properties.opacity, k2.properties.opacity, baseTransform.opacity),
    volume: lerp(k1.properties.volume, k2.properties.volume, baseVolume),
    exposure: hasExposure ? lerp(k1.properties.exposure, k2.properties.exposure, 0) : undefined,
    brightness: hasBrightness ? lerp(k1.properties.brightness, k2.properties.brightness, 0) : undefined,
    contrast: hasContrast ? lerp(k1.properties.contrast, k2.properties.contrast, 0) : undefined,
    saturation: hasSaturation ? lerp(k1.properties.saturation, k2.properties.saturation, 0) : undefined,
  };
}
