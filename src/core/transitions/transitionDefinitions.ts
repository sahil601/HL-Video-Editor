import { TransitionCategory, TransitionType, ClipTransition } from '../../types/project';

export interface TransitionPresetDefinition {
  type: TransitionType;
  name: string;
  category: TransitionCategory;
  description: string;
  defaultDurationMs: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
  xfadeName: string;
  tags: string[];
}

export const TRANSITION_CATEGORIES: { id: TransitionCategory; name: string }[] = [
  { id: 'basic', name: 'Basic & Dissolves' },
  { id: 'directional', name: 'Slides & Wipes' },
  { id: 'motion', name: 'Zoom & Rotate' },
  { id: 'cinematic', name: 'Blur & Flash' },
  { id: 'stylized', name: 'Glitch & Film Burn' },
];

export const TRANSITION_PRESETS: TransitionPresetDefinition[] = [
  // 1. Basic & Dissolves
  {
    type: 'crossfade',
    name: 'Cross Dissolve',
    category: 'basic',
    description: 'Smooth seamless crossfade blending the outgoing and incoming clips',
    defaultDurationMs: 800,
    xfadeName: 'dissolve',
    tags: ['fade', 'dissolve', 'smooth', 'basic'],
  },
  {
    type: 'fadeBlack',
    name: 'Dip to Black',
    category: 'basic',
    description: 'Fades out completely to solid black before fading into the next scene',
    defaultDurationMs: 800,
    xfadeName: 'fadeblack',
    tags: ['black', 'dip', 'fade', 'scene'],
  },
  {
    type: 'fadeWhite',
    name: 'Dip to White',
    category: 'basic',
    description: 'Bright flash dissolve fading through pure white',
    defaultDurationMs: 600,
    xfadeName: 'fadewhite',
    tags: ['white', 'flash', 'bright', 'dip'],
  },
  {
    type: 'cut',
    name: 'Hard Cut',
    category: 'basic',
    description: 'Instantaneous zero-duration scene transition',
    defaultDurationMs: 0,
    xfadeName: 'fade',
    tags: ['cut', 'instant', 'direct'],
  },

  // 2. Slides & Wipes
  {
    type: 'slideLeft',
    name: 'Push Slide Left',
    category: 'directional',
    description: 'Incoming clip slides horizontally in from right pushing outgoing clip left',
    defaultDurationMs: 700,
    direction: 'left',
    xfadeName: 'slideleft',
    tags: ['slide', 'left', 'push', 'horizontal'],
  },
  {
    type: 'slideRight',
    name: 'Push Slide Right',
    category: 'directional',
    description: 'Incoming clip slides horizontally in from left pushing outgoing clip right',
    defaultDurationMs: 700,
    direction: 'right',
    xfadeName: 'slideright',
    tags: ['slide', 'right', 'push', 'horizontal'],
  },
  {
    type: 'slideUp',
    name: 'Push Slide Up',
    category: 'directional',
    description: 'Incoming clip slides vertically from bottom pushing outgoing clip up',
    defaultDurationMs: 700,
    direction: 'up',
    xfadeName: 'slideup',
    tags: ['slide', 'up', 'push', 'vertical'],
  },
  {
    type: 'slideDown',
    name: 'Push Slide Down',
    category: 'directional',
    description: 'Incoming clip slides vertically from top pushing outgoing clip down',
    defaultDurationMs: 700,
    direction: 'down',
    xfadeName: 'slidedown',
    tags: ['slide', 'down', 'push', 'vertical'],
  },
  {
    type: 'wipeLeft',
    name: 'Soft Wipe Left',
    category: 'directional',
    description: 'Linear curtain wipe traveling from right to left revealing the next scene',
    defaultDurationMs: 750,
    direction: 'left',
    xfadeName: 'wipeleft',
    tags: ['wipe', 'left', 'curtain', 'linear'],
  },
  {
    type: 'wipeRight',
    name: 'Soft Wipe Right',
    category: 'directional',
    description: 'Linear curtain wipe traveling from left to right revealing the next scene',
    defaultDurationMs: 750,
    direction: 'right',
    xfadeName: 'wiperight',
    tags: ['wipe', 'right', 'curtain', 'linear'],
  },
  {
    type: 'wipeUp',
    name: 'Soft Wipe Up',
    category: 'directional',
    description: 'Vertical curtain wipe traveling bottom to top',
    defaultDurationMs: 750,
    direction: 'up',
    xfadeName: 'wipeup',
    tags: ['wipe', 'up', 'curtain', 'vertical'],
  },
  {
    type: 'wipeDown',
    name: 'Soft Wipe Down',
    category: 'directional',
    description: 'Vertical curtain wipe traveling top to bottom',
    defaultDurationMs: 750,
    direction: 'down',
    xfadeName: 'wipedown',
    tags: ['wipe', 'down', 'curtain', 'vertical'],
  },

  // 3. Zoom & Rotate
  {
    type: 'zoomIn',
    name: 'Zoom In Warp',
    category: 'motion',
    description: 'Rapid focal scale expansion plunging forward into the new scene',
    defaultDurationMs: 650,
    direction: 'in',
    xfadeName: 'zoomin',
    tags: ['zoom', 'in', 'motion', 'forward', 'fast'],
  },
  {
    type: 'zoomOut',
    name: 'Zoom Out Pull',
    category: 'motion',
    description: 'Smooth camera pullback pulling out to reveal the wider clip',
    defaultDurationMs: 650,
    direction: 'out',
    xfadeName: 'fade',
    tags: ['zoom', 'out', 'pull', 'motion'],
  },
  {
    type: 'rotate',
    name: 'Radial Spin',
    category: 'motion',
    description: 'Centrifugal radial spin wipe rotating into the new shot',
    defaultDurationMs: 700,
    xfadeName: 'radial',
    tags: ['rotate', 'spin', 'radial', 'motion'],
  },

  // 4. Blur & Flash
  {
    type: 'blur',
    name: 'Directional Defocus Blur',
    category: 'cinematic',
    description: 'Heavy horizontal optical motion blur dissolving into focus',
    defaultDurationMs: 600,
    xfadeName: 'hblur',
    tags: ['blur', 'defocus', 'cinematic', 'soft'],
  },
  {
    type: 'flash',
    name: 'Camera Strobe Flash',
    category: 'cinematic',
    description: 'High energy photographic strobe flash exploding into the next scene',
    defaultDurationMs: 450,
    xfadeName: 'fadewhite',
    tags: ['flash', 'strobe', 'camera', 'bright', 'impact'],
  },
  {
    type: 'filmBurn',
    name: 'Vintage Film Burn',
    category: 'cinematic',
    description: 'Analog projector bulb heat burn with warm golden edge wash',
    defaultDurationMs: 750,
    xfadeName: 'fade',
    tags: ['burn', 'film', 'warm', 'vintage', 'projector'],
  },

  // 5. Stylized & Glitch
  {
    type: 'glitch',
    name: 'Digital Pixel Glitch',
    category: 'stylized',
    description: 'Rapid video frame buffer block scramble and pixelated sync error',
    defaultDurationMs: 500,
    xfadeName: 'pixelize',
    tags: ['glitch', 'pixel', 'digital', 'scramble', 'cyber'],
  },
  {
    type: 'rgbSplit',
    name: 'RGB Split Glitch',
    category: 'stylized',
    description: 'High-speed chromatic channel tear and horizontal aberration glitch',
    defaultDurationMs: 500,
    xfadeName: 'pixelize',
    tags: ['rgb', 'split', 'chromatic', 'tear', 'glitch'],
  },
];

/**
 * Filter transition presets by category and/or query string
 */
export function filterTransitionPresets(
  presets: TransitionPresetDefinition[],
  categoryFilter: 'all' | TransitionCategory,
  query = ''
): TransitionPresetDefinition[] {
  return presets.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = p.description.toLowerCase().includes(q);
      const inTags = p.tags.some((t) => t.toLowerCase().includes(q));
      return inName || inDesc || inTags;
    }
    return true;
  });
}

/**
 * Clamps transition duration safely so it never exceeds 50% of either clip
 */
export function clampTransitionDuration(
  durationMs: number,
  clipDurationMs: number,
  adjacentClipDurationMs?: number
): number {
  if (durationMs <= 0) return 0;
  const maxSafeClip = Math.floor(clipDurationMs * 0.5);
  const maxSafeAdjacent = adjacentClipDurationMs !== undefined ? Math.floor(adjacentClipDurationMs * 0.5) : maxSafeClip;
  const maxAllowed = Math.min(maxSafeClip, maxSafeAdjacent);
  return Math.min(Math.max(200, durationMs), Math.max(200, maxAllowed));
}

/**
 * Creates a new ClipTransition object with a unique ID
 */
export function createTransition(
  type: TransitionType,
  durationMs?: number,
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out'
): ClipTransition {
  const preset = TRANSITION_PRESETS.find((p) => p.type === type) || TRANSITION_PRESETS[0];
  return {
    id: 'trans_' + Math.random().toString(36).substring(2, 8),
    type: preset.type,
    durationMs: durationMs !== undefined ? durationMs : preset.defaultDurationMs,
    direction: direction || preset.direction,
  };
}
