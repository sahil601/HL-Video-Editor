/**
 * High-Precision Time Engine for VNest
 * Uses integer milliseconds and rational frame timing to eliminate floating-point drift.
 */

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Format milliseconds into HH:MM:SS:FF timecode
 */
export function formatTimecode(timeMs: number, fps: number = 30): string {
  const safeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const remainingMs = safeMs % 1000;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Calculate frame index from remaining milliseconds
  const frameDurationMs = 1000 / fps;
  const frame = Math.floor(remainingMs / frameDurationMs);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frame)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}:${pad(frame)}`;
}

/**
 * Format milliseconds into clean MM:SS display for compact UI
 */
export function formatDurationSimple(timeMs: number): string {
  const safeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse timecode back to milliseconds
 */
export function parseTimecode(tc: string, fps: number = 30): number {
  const parts = tc.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  const frameMs = 1000 / fps;
  if (parts.length === 4) {
    const [h, m, s, f] = parts;
    return Math.round(h * 3600000 + m * 60000 + s * 1000 + f * frameMs);
  }
  if (parts.length === 3) {
    const [m, s, f] = parts;
    return Math.round(m * 60000 + s * 1000 + f * frameMs);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Math.round(m * 60000 + s * 1000);
  }
  return 0;
}

/**
 * Step precisely by 1 frame in either direction
 */
export function stepFrame(currentTimeMs: number, fps: number, direction: 1 | -1): number {
  const frameDurationMs = 1000 / fps;
  const currentFrame = Math.round(currentTimeMs / frameDurationMs);
  const nextFrame = Math.max(0, currentFrame + direction);
  return Math.round(nextFrame * frameDurationMs);
}

/**
 * Snapping algorithm: checks if target time is within threshold of any snap point
 */
export function calculateSnap(
  targetMs: number,
  snapPoints: number[],
  thresholdMs: number = 150
): { snappedTimeMs: number; snapped: boolean; diff: number } {
  let closestSnap: number | null = null;
  let minDiff = Infinity;

  for (const point of snapPoints) {
    const diff = Math.abs(point - targetMs);
    if (diff <= thresholdMs && diff < minDiff) {
      minDiff = diff;
      closestSnap = point;
    }
  }

  if (closestSnap !== null) {
    return {
      snappedTimeMs: closestSnap,
      snapped: true,
      diff: minDiff,
    };
  }

  return {
    snappedTimeMs: targetMs,
    snapped: false,
    diff: 0,
  };
}

/**
 * Convert pixel distance on timeline to milliseconds given zoom level (pixelsPerSecond)
 */
export function pxToMs(pixels: number, pixelsPerSecond: number): number {
  if (pixelsPerSecond <= 0) return 0;
  return Math.round((pixels / pixelsPerSecond) * 1000);
}

/**
 * Convert milliseconds to pixel coordinate given zoom level
 */
export function msToPx(timeMs: number, pixelsPerSecond: number): number {
  return (timeMs / 1000) * pixelsPerSecond;
}
