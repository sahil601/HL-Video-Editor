import { ColorAdjustments } from '../types/project';

export interface LookPreset {
  id: string;
  name: string;
  description: string;
  adjustments: ColorAdjustments;
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
    presetName: 'Normal',
  };
}

export const LOOK_PRESETS: LookPreset[] = [
  {
    id: 'none',
    name: 'Normal',
    description: 'Original neutral colors without color grading',
    adjustments: getDefaultColorAdjustments(),
  },
  {
    id: 'teal_orange',
    name: 'Teal & Orange',
    description: 'Blockbuster cinematic look with warm skin & cool shadows',
    adjustments: {
      exposure: 5,
      brightness: 4,
      contrast: 18,
      saturation: 25,
      temperature: 15,
      tint: -12,
      highlights: 10,
      shadows: -8,
      gamma: 5,
      fade: 0,
      vignette: 25,
      sharpen: 20,
      presetName: 'Teal & Orange',
    },
  },
  {
    id: 'warm_sunset',
    name: 'Golden Hour',
    description: 'Rich warm tones and golden sunlight glow',
    adjustments: {
      exposure: 8,
      brightness: 5,
      contrast: 14,
      saturation: 22,
      temperature: 38,
      tint: 14,
      highlights: 15,
      shadows: 6,
      gamma: 0,
      fade: 5,
      vignette: 20,
      sharpen: 12,
      presetName: 'Golden Hour',
    },
  },
  {
    id: 'cool_cinema',
    name: 'Cool Cinema',
    description: 'Mood-driven desaturated blue tones',
    adjustments: {
      exposure: -5,
      brightness: -4,
      contrast: 22,
      saturation: -15,
      temperature: -35,
      tint: 8,
      highlights: -10,
      shadows: -15,
      gamma: -5,
      fade: 8,
      vignette: 32,
      sharpen: 18,
      presetName: 'Cool Cinema',
    },
  },
  {
    id: 'vintage_70s',
    name: 'Vintage 70s',
    description: 'Faded film aesthetics with warm amber wash and lifted blacks',
    adjustments: {
      exposure: 6,
      brightness: 8,
      contrast: -10,
      saturation: -18,
      temperature: 28,
      tint: 18,
      highlights: -5,
      shadows: 20,
      gamma: 10,
      fade: 25,
      vignette: 42,
      sharpen: 0,
      presetName: 'Vintage 70s',
    },
  },
  {
    id: 'film_noir',
    name: 'Film Noir B&W',
    description: 'High contrast monochrome classic film',
    adjustments: {
      exposure: 0,
      brightness: -8,
      contrast: 42,
      saturation: -100,
      temperature: 0,
      tint: 0,
      highlights: 20,
      shadows: -25,
      gamma: -8,
      fade: 0,
      vignette: 55,
      sharpen: 28,
      presetName: 'Film Noir B&W',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Vibrant neon purple and electric cyan saturation',
    adjustments: {
      exposure: 8,
      brightness: 6,
      contrast: 30,
      saturation: 50,
      temperature: -22,
      tint: 38,
      highlights: 25,
      shadows: -15,
      gamma: 5,
      fade: 0,
      vignette: 30,
      sharpen: 30,
      presetName: 'Cyberpunk Neon',
    },
  },
  {
    id: 'moody_teal',
    name: 'Moody Teal',
    description: 'Dark atmospheric aesthetic with lifted shadow matte',
    adjustments: {
      exposure: -10,
      brightness: -6,
      contrast: 26,
      saturation: -10,
      temperature: -24,
      tint: -8,
      highlights: -15,
      shadows: 18,
      gamma: -12,
      fade: 20,
      vignette: 35,
      sharpen: 15,
      presetName: 'Moody Teal',
    },
  },
];

/**
 * Builds CSS filter string from advanced color adjustments for real-time preview
 */
export function formatColorFilterCss(adj?: ColorAdjustments): string {
  if (!adj) return '';

  const filters: string[] = [];

  // Exposure combined with Brightness
  const expFactor = 1 + (adj.exposure || 0) / 100;
  const briFactor = 1 + adj.brightness / 100;
  const combinedBrightness = Math.max(0, expFactor * briFactor);
  if (Math.abs(combinedBrightness - 1.0) > 0.01) {
    filters.push(`brightness(${combinedBrightness.toFixed(2)})`);
  }

  // Contrast & Gamma
  const gammaFactor = 1 - (adj.gamma || 0) / 200;
  const conFactor = (1 + adj.contrast / 100) * gammaFactor;
  if (Math.abs(conFactor - 1.0) > 0.01) {
    filters.push(`contrast(${Math.max(0.1, conFactor).toFixed(2)})`);
  }

  // Saturation
  if (adj.saturation !== 0) {
    const s = Math.max(0, 1 + adj.saturation / 100);
    filters.push(`saturate(${s.toFixed(2)})`);
  }

  // Temperature (Warm amber sepia shift or cool blue hue)
  if (adj.temperature && adj.temperature !== 0) {
    if (adj.temperature > 0) {
      filters.push(`sepia(${(adj.temperature * 0.45).toFixed(0)}%)`);
    } else {
      // Cool blue temperature
      filters.push(`hue-rotate(${Math.round(adj.temperature * 0.4)}deg)`);
    }
  }

  // Tint (Green vs Magenta)
  if (adj.tint && adj.tint !== 0) {
    filters.push(`hue-rotate(${Math.round(adj.tint * 0.5)}deg)`);
  }

  return filters.join(' ');
}
