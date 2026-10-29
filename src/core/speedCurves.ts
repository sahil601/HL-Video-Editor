import { SpeedCurvePoint } from '../types/project';

export interface SpeedCurvePreset {
  id: string;
  name: string;
  description: string;
  points: SpeedCurvePoint[];
}

export const SPEED_CURVE_PRESETS: SpeedCurvePreset[] = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'Cinematic slow-motion focus on the main action',
    points: [
      { x: 0.0, y: 1.0 },
      { x: 0.25, y: 0.3 },
      { x: 0.75, y: 0.3 },
      { x: 1.0, y: 1.0 },
    ],
  },
  {
    id: 'bullet',
    name: 'Bullet',
    description: 'High speed approach, sudden freeze, rapid exit',
    points: [
      { x: 0.0, y: 2.5 },
      { x: 0.35, y: 0.2 },
      { x: 0.65, y: 0.2 },
      { x: 1.0, y: 2.5 },
    ],
  },
  {
    id: 'montage',
    name: 'Montage',
    description: 'Rhythmic dynamic beats for music sync',
    points: [
      { x: 0.0, y: 0.8 },
      { x: 0.25, y: 2.2 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 2.2 },
      { x: 1.0, y: 0.8 },
    ],
  },
  {
    id: 'slow_motion',
    name: 'Slow Motion',
    description: 'Smooth entry into deep sustained slow motion',
    points: [
      { x: 0.0, y: 1.0 },
      { x: 0.2, y: 0.25 },
      { x: 0.8, y: 0.25 },
      { x: 1.0, y: 1.0 },
    ],
  },
  {
    id: 'speed_ramp',
    name: 'Speed Ramp',
    description: 'Dramatic acceleration in the middle with slow heads and tails',
    points: [
      { x: 0.0, y: 0.5 },
      { x: 0.5, y: 3.2 },
      { x: 1.0, y: 0.5 },
    ],
  },
  {
    id: 'fast_to_slow',
    name: 'Fast to Slow',
    description: 'High-speed intro ramping down into smooth slow motion',
    points: [
      { x: 0.0, y: 3.5 },
      { x: 0.4, y: 1.4 },
      { x: 1.0, y: 0.35 },
    ],
  },
  {
    id: 'jump_out',
    name: 'Jump Out',
    description: 'Slow buildup followed by rapid acceleration',
    points: [
      { x: 0.0, y: 0.4 },
      { x: 0.6, y: 0.8 },
      { x: 1.0, y: 3.0 },
    ],
  },
];

/**
 * Evaluates the effective speed multiplier at a normalized time t in [0, 1]
 */
export function evaluateSpeedCurve(points: SpeedCurvePoint[] | undefined, normalizedT: number): number {
  if (!points || points.length === 0) return 1.0;
  if (points.length === 1) return Math.max(0.1, Math.min(8.0, points[0].y));

  const t = Math.max(0, Math.min(1, normalizedT));
  const sorted = [...points].sort((a, b) => a.x - b.x);

  if (t <= sorted[0].x) return Math.max(0.1, Math.min(8.0, sorted[0].y));
  if (t >= sorted[sorted.length - 1].x) return Math.max(0.1, Math.min(8.0, sorted[sorted.length - 1].y));

  // Find segment
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (t >= p1.x && t <= p2.x) {
      const span = p2.x - p1.x;
      if (span <= 0) return Math.max(0.1, Math.min(8.0, p1.y));
      const progress = (t - p1.x) / span;
      // Smooth cosine interpolation between points
      const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;
      const speed = p1.y + (p2.y - p1.y) * smoothProgress;
      return Math.max(0.1, Math.min(8.0, speed));
    }
  }

  return 1.0;
}

/**
 * Calculates average speed multiplier across the entire curve [0, 1]
 */
export function calculateSpeedCurveAverage(points: SpeedCurvePoint[] | undefined): number {
  if (!points || points.length < 2) return 1.0;
  const steps = 60;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    sum += evaluateSpeedCurve(points, i / steps);
  }
  return sum / (steps + 1);
}

/**
 * Maps a timeline offset (in milliseconds) to the exact source media offset (in milliseconds)
 * using numerical integration over the variable speed curve.
 */
export function getSpeedCurveSourceTimeMs(
  points: SpeedCurvePoint[] | undefined,
  clipOffsetMs: number,
  clipDurationMs: number,
  fallbackSpeed = 1.0
): number {
  if (!points || points.length < 2 || clipDurationMs <= 0) {
    return clipOffsetMs * (fallbackSpeed > 0 ? fallbackSpeed : 1.0);
  }

  const clampedOffset = Math.max(0, Math.min(clipDurationMs, clipOffsetMs));
  const normalizedT = clampedOffset / clipDurationMs;

  // Numerical trapezoidal integration with 48 steps for sub-millisecond precision
  const steps = 48;
  const dt = normalizedT / steps;
  let integral = 0;

  for (let i = 0; i < steps; i++) {
    const u1 = i * dt;
    const u2 = (i + 1) * dt;
    const v1 = evaluateSpeedCurve(points, u1);
    const v2 = evaluateSpeedCurve(points, u2);
    integral += ((v1 + v2) / 2) * dt;
  }

  return integral * clipDurationMs;
}

export interface SpeedCurveSegment {
  sourceStartSec: number;
  sourceDurationSec: number;
  timelineDurationSec: number;
  speed: number;
}

/**
 * Generates piecewise segments for FFmpeg export filtergraph.
 * Divides the speed curve into N sub-intervals, computing exact source and timeline bounds for each.
 */
export function generateSpeedCurveSegments(
  points: SpeedCurvePoint[],
  sourceStartMs: number,
  sourceDurationMs: number,
  timelineDurationMs: number,
  numSegments = 8
): SpeedCurveSegment[] {
  if (!points || points.length < 2 || timelineDurationMs <= 0) {
    const speed = sourceDurationMs > 0 && timelineDurationMs > 0 ? sourceDurationMs / timelineDurationMs : 1.0;
    return [
      {
        sourceStartSec: sourceStartMs / 1000,
        sourceDurationSec: sourceDurationMs / 1000,
        timelineDurationSec: timelineDurationMs / 1000,
        speed,
      },
    ];
  }

  const segments: SpeedCurveSegment[] = [];
  const dt = 1.0 / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const t0 = i * dt;
    const t1 = (i + 1) * dt;

    const timelineSegmentSec = (timelineDurationMs * dt) / 1000;
    const srcOffset0 = getSpeedCurveSourceTimeMs(points, t0 * timelineDurationMs, timelineDurationMs);
    const srcOffset1 = getSpeedCurveSourceTimeMs(points, t1 * timelineDurationMs, timelineDurationMs);

    const srcStartMs = sourceStartMs + srcOffset0;
    const srcDurationMs = Math.max(10, srcOffset1 - srcOffset0);
    const segmentSpeed = srcDurationMs / (timelineSegmentSec * 1000);

    segments.push({
      sourceStartSec: srcStartMs / 1000,
      sourceDurationSec: srcDurationMs / 1000,
      timelineDurationSec: timelineSegmentSec,
      speed: Math.max(0.1, Math.min(8.0, segmentSpeed)),
    });
  }

  return segments;
}
