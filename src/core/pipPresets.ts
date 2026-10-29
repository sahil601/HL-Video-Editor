import { Clip, ClipTransform, PipLayoutPreset } from '../types/project';

export interface PipPresetDefinition {
  id: PipLayoutPreset;
  name: string;
  category: 'pip' | 'split' | 'reset';
  icon: string;
  description: string;
  transform: Partial<ClipTransform>;
}

export const PIP_PRESET_DEFINITIONS: Record<PipLayoutPreset, PipPresetDefinition> = {
  pip_top_right: {
    id: 'pip_top_right',
    name: 'Top-Right PIP',
    category: 'pip',
    icon: '↗',
    description: 'Corner picture-in-picture scaled to 35% in top-right corner',
    transform: {
      scale: 0.35,
      positionX: 28,
      positionY: -28,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  pip_top_left: {
    id: 'pip_top_left',
    name: 'Top-Left PIP',
    category: 'pip',
    icon: '↖',
    description: 'Corner picture-in-picture scaled to 35% in top-left corner',
    transform: {
      scale: 0.35,
      positionX: -28,
      positionY: -28,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  pip_bottom_right: {
    id: 'pip_bottom_right',
    name: 'Bottom-Right PIP',
    category: 'pip',
    icon: '↘',
    description: 'Corner picture-in-picture scaled to 35% in bottom-right corner',
    transform: {
      scale: 0.35,
      positionX: 28,
      positionY: 28,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  pip_bottom_left: {
    id: 'pip_bottom_left',
    name: 'Bottom-Left PIP',
    category: 'pip',
    icon: '↙',
    description: 'Corner picture-in-picture scaled to 35% in bottom-left corner',
    transform: {
      scale: 0.35,
      positionX: -28,
      positionY: 28,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  split_left_50: {
    id: 'split_left_50',
    name: 'Left 50% Split',
    category: 'split',
    icon: '◧',
    description: '50/50 vertical split screen occupying the left half',
    transform: {
      scale: 1.0,
      positionX: -25,
      positionY: 0,
      crop: { top: 0, bottom: 0, left: 0, right: 50 },
    },
  },
  split_right_50: {
    id: 'split_right_50',
    name: 'Right 50% Split',
    category: 'split',
    icon: '◨',
    description: '50/50 vertical split screen occupying the right half',
    transform: {
      scale: 1.0,
      positionX: 25,
      positionY: 0,
      crop: { top: 0, bottom: 0, left: 50, right: 0 },
    },
  },
  split_top_50: {
    id: 'split_top_50',
    name: 'Top 50% Split',
    category: 'split',
    icon: '⬒',
    description: '50/50 horizontal split screen occupying the top half',
    transform: {
      scale: 1.0,
      positionX: 0,
      positionY: -25,
      crop: { top: 0, bottom: 50, left: 0, right: 0 },
    },
  },
  split_bottom_50: {
    id: 'split_bottom_50',
    name: 'Bottom 50% Split',
    category: 'split',
    icon: '⬓',
    description: '50/50 horizontal split screen occupying the bottom half',
    transform: {
      scale: 1.0,
      positionX: 0,
      positionY: 25,
      crop: { top: 50, bottom: 0, left: 0, right: 0 },
    },
  },
  split_four_quadrants: {
    id: 'split_four_quadrants',
    name: '4-Way Quadrant',
    category: 'split',
    icon: '⊞',
    description: 'Four-way split screen (defaults to top-left quadrant at 50% scale)',
    transform: {
      scale: 0.5,
      positionX: -25,
      positionY: -25,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  reset_fullscreen: {
    id: 'reset_fullscreen',
    name: 'Fullscreen Reset',
    category: 'reset',
    icon: '🗖',
    description: 'Reset clip back to centered 100% full screen with no cropping',
    transform: {
      scale: 1.0,
      positionX: 0,
      positionY: 0,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
};

/**
 * Apply a PIP or split-screen preset onto a clip.
 * Preserves timing, audio volume, rotation, opacity, and other settings.
 */
export function applyPipPreset(clip: Clip, preset: PipLayoutPreset): Clip {
  const def = PIP_PRESET_DEFINITIONS[preset];
  if (!def) return clip;

  return {
    ...clip,
    transform: {
      ...clip.transform,
      ...def.transform,
      crop: def.transform.crop
        ? { ...def.transform.crop }
        : clip.transform.crop,
    },
  };
}

/**
 * Helper to auto-assign 4-way quadrants to multiple clips across tracks
 */
export function assignQuadrantLayout(clips: Clip[]): Clip[] {
  const quadrants: Array<{ positionX: number; positionY: number }> = [
    { positionX: -25, positionY: -25 }, // Top-Left
    { positionX: 25, positionY: -25 },  // Top-Right
    { positionX: -25, positionY: 25 },  // Bottom-Left
    { positionX: 25, positionY: 25 },   // Bottom-Right
  ];

  return clips.map((clip, idx) => {
    const q = quadrants[idx % quadrants.length];
    return {
      ...clip,
      transform: {
        ...clip.transform,
        scale: 0.5,
        positionX: q.positionX,
        positionY: q.positionY,
        crop: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    };
  });
}
