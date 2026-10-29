/**
 * HL Video Editor — Professional Color Grading Engine
 * Handles Color Wheels (Lift, Gamma, Gain), Exposure, Saturation, Contrast,
 * Temperature, Tint, Highlights, Shadows, and 3D LUT mapping.
 */

import { ColorAdjustments, ColorWheels, ColorWheelValue } from '../types/project';

export function getDefaultColorWheels(): ColorWheels {
  return {
    lift: { x: 0, y: 0, luma: 0 },
    gamma: { x: 0, y: 0, luma: 0 },
    gain: { x: 0, y: 0, luma: 0 },
  };
}

export function getDefaultColorAdjustments(): ColorAdjustments {
  return {
    exposure: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    gamma: 0,
    fade: 0,
    vignette: 0,
    sharpen: 0,
    colorWheels: getDefaultColorWheels(),
    lut: undefined,
    bypassed: false,
    presetName: 'None',
  };
}

/**
 * Converts a 2D puck coordinate (x, y in [-1, 1]) on a color wheel
 * to normalized RGB channel offsets [-0.5, 0.5]
 */
export function wheelPuckToRgb(wheel: ColorWheelValue, maxIntensity = 0.4): [number, number, number] {
  const { x, y, luma = 0 } = wheel;
  const dist = Math.min(1.0, Math.sqrt(x * x + y * y));
  if (dist === 0 && luma === 0) return [0, 0, 0];

  const angle = Math.atan2(y, x);
  // Red is at angle 0 (right), Green at 120 deg (2*PI/3), Blue at 240 deg (4*PI/3)
  const rOffset = Math.cos(angle) * dist * maxIntensity;
  const gOffset = Math.cos(angle - (2 * Math.PI) / 3) * dist * maxIntensity;
  const bOffset = Math.cos(angle - (4 * Math.PI) / 3) * dist * maxIntensity;

  const lumaOffset = (luma / 100) * 0.3;

  return [
    Math.max(-1, Math.min(1, rOffset + lumaOffset)),
    Math.max(-1, Math.min(1, gOffset + lumaOffset)),
    Math.max(-1, Math.min(1, bOffset + lumaOffset)),
  ];
}

/**
 * Generates FFmpeg video filter strings for color adjustments,
 * including basic controls, color balance (wheels + temp/tint), and 3D LUT.
 */
export function buildColorGradingFFmpegFilters(
  colors?: ColorAdjustments,
  resolvedLutPath?: string
): string[] {
  if (!colors || colors.bypassed) return [];

  const filters: string[] = [];

  const {
    exposure = 0,
    brightness = 0,
    contrast = 0,
    saturation = 0,
    temperature = 0,
    tint = 0,
    highlights = 0,
    shadows = 0,
    gamma = 0,
    fade = 0,
    vignette = 0,
    sharpen = 0,
    colorWheels,
    lut,
  } = colors;

  // 1. Basic EQ (Brightness, Contrast, Saturation with Exposure multiplier)
  const expFactor = 1 + exposure / 100;
  const b = ((brightness / 100) * expFactor).toFixed(2);
  const gammaFactor = 1 - gamma / 200;
  const c = Math.max(0, (1 + contrast / 100) * gammaFactor).toFixed(2);
  const s = Math.max(0, 1 + saturation / 100).toFixed(2);

  if (Math.abs(parseFloat(b)) > 0.001 || Math.abs(parseFloat(c) - 1.0) > 0.001 || Math.abs(parseFloat(s) - 1.0) > 0.001) {
    filters.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);
  }

  // 2. Color Balance (Lift, Gamma, Gain wheels + Temp / Tint / Shadows / Highlights)
  let rs = 0, gs = 0, bs = 0; // Shadows (Lift)
  let rm = 0, gm = 0, bm = 0; // Midtones (Gamma)
  let rh = 0, gh = 0, bh = 0; // Highlights (Gain)

  // Integrate Color Wheels
  if (colorWheels) {
    if (colorWheels.lift) {
      const [rL, gL, bL] = wheelPuckToRgb(colorWheels.lift);
      rs += rL; gs += gL; bs += bL;
    }
    if (colorWheels.gamma) {
      const [rG, gG, bG] = wheelPuckToRgb(colorWheels.gamma);
      rm += rG; gm += gG; bm += bG;
    }
    if (colorWheels.gain) {
      const [rH, gH, bH] = wheelPuckToRgb(colorWheels.gain);
      rh += rH; gh += gH; bh += bH;
    }
  }

  // Integrate Temperature & Tint
  if (temperature !== 0) {
    if (temperature > 0) {
      rs += (temperature / 100) * 0.35;
      rm += (temperature / 100) * 0.25;
    } else {
      bs += (-temperature / 100) * 0.35;
      bm += (-temperature / 100) * 0.25;
    }
  }
  if (tint !== 0) {
    if (tint > 0) {
      rm += (tint / 100) * 0.3;
      bm += (tint / 100) * 0.15;
    } else {
      gm += (-tint / 100) * 0.3;
    }
  }

  // Integrate Shadows & Highlights sliders
  if (highlights !== 0) {
    const hVal = (highlights / 100) * 0.25;
    rh += hVal; gh += hVal; bh += hVal;
  }
  if (shadows !== 0) {
    const sVal = (shadows / 100) * 0.25;
    rs += sVal; gs += sVal; bs += sVal;
  }

  const clamp = (v: number) => Math.max(-1, Math.min(1, v)).toFixed(3);
  const allOffsets = [rs, gs, bs, rm, gm, bm, rh, gh, bh];
  if (allOffsets.some((v) => Math.abs(v) > 0.005)) {
    filters.push(
      `colorbalance=rs=${clamp(rs)}:gs=${clamp(gs)}:bs=${clamp(bs)}:` +
      `rm=${clamp(rm)}:gm=${clamp(gm)}:bm=${clamp(bm)}:` +
      `rh=${clamp(rh)}:gh=${clamp(gh)}:bh=${clamp(bh)}`
    );
  }

  // 3. Lifted blacks (Fade)
  if (fade > 0) {
    const lift = (fade / 500).toFixed(3);
    filters.push(`colorlevels=rimin=${lift}:gimin=${lift}:bimin=${lift}`);
  }

  // 4. Vignette
  if (vignette > 0) {
    const vigAngle = ((Math.PI * vignette) / 200).toFixed(3);
    filters.push(`vignette=angle=${vigAngle}`);
  }

  // 5. Sharpen
  if (sharpen > 0) {
    filters.push(`unsharp=5:5:${(sharpen / 50).toFixed(2)}`);
  }

  // 6. 3D LUT (lut3d filter)
  if (lut && lut.enabled) {
    const targetPath = resolvedLutPath || lut.filePath;
    if (targetPath) {
      const normalizedPath = targetPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
      filters.push(`lut3d=file='${normalizedPath}':interp=tetrahedral`);
    }
  }

  return filters;
}

/**
 * Builds CSS filter string for real-time video/image preview
 */
export function buildColorGradingCssFilter(colors?: ColorAdjustments): string {
  if (!colors || colors.bypassed) return '';

  const {
    exposure = 0,
    brightness = 0,
    contrast = 0,
    saturation = 0,
    temperature = 0,
    tint = 0,
    colorWheels,
  } = colors;

  const exposureMultiplier = 1 + exposure / 100;
  const b = Math.max(0, (brightness + 100) * exposureMultiplier);
  const c = Math.max(0, contrast + 100);
  const s = Math.max(0, saturation + 100);

  // Approximate hue and sepia from temperature, tint, and color wheels
  let hue = tint * 0.8 + temperature * 0.4;
  let sepia = Math.max(0, temperature * 0.5);

  if (colorWheels) {
    const [rL, , bL] = wheelPuckToRgb(colorWheels.lift, 0.3);
    const [rG, , bG] = wheelPuckToRgb(colorWheels.gamma, 0.3);
    const [rH, , bH] = wheelPuckToRgb(colorWheels.gain, 0.3);
    const totalWarmth = (rL + rG + rH) - (bL + bG + bH);
    hue += totalWarmth * 15;
    if (totalWarmth > 0) sepia += totalWarmth * 10;
  }

  return `brightness(${b.toFixed(1)}%) contrast(${c.toFixed(1)}%) saturate(${s.toFixed(1)}%) hue-rotate(${hue.toFixed(1)}deg) sepia(${Math.min(100, Math.max(0, sepia)).toFixed(1)}%)`;
}
