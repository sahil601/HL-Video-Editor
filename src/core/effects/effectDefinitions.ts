import { EffectCategory, VideoEffectType, VideoEffect, Clip } from '../../types/project';

export interface EffectPresetDefinition {
  type: VideoEffectType;
  name: string;
  category: EffectCategory;
  description: string;
  defaultIntensity: number; // 0 to 100
  tags: string[];
}

export const EFFECT_CATEGORIES: { id: EffectCategory; name: string }[] = [
  { id: 'cinematic', name: 'Cinematic & Vintage' },
  { id: 'glitch', name: 'Glitch & RGB Split' },
  { id: 'blur_glow', name: 'Blur, Glow & Sharpen' },
  { id: 'motion_impact', name: 'Shake, Zoom & Flash' },
  { id: 'color_looks', name: 'Creative Color Looks' },
  { id: 'particles_vfx', name: 'Particles & VFX' },
];

export const EFFECT_PRESETS: EffectPresetDefinition[] = [
  // 1. Cinematic & Vintage
  {
    type: 'vintage_film',
    name: 'Vintage Film Look',
    category: 'cinematic',
    description: '1970s analog warmth with soft contrast, lifted shadows, and amber tint',
    defaultIntensity: 65,
    tags: ['vintage', 'film', 'retro', 'warm', '1970s'],
  },
  {
    type: 'sepia_tone',
    name: 'Antique Sepia Tone',
    category: 'cinematic',
    description: 'Nostalgic monochrome photographic sepia treatment',
    defaultIntensity: 75,
    tags: ['sepia', 'antique', 'old', 'nostalgia'],
  },
  {
    type: 'cinematic_teal_orange',
    name: 'Teal & Orange Grade',
    category: 'cinematic',
    description: 'Hollywood blockbuster complementary color contrast',
    defaultIntensity: 70,
    tags: ['teal', 'orange', 'hollywood', 'blockbuster', 'cinema'],
  },
  {
    type: 'film_noir',
    name: 'Classic Film Noir',
    category: 'cinematic',
    description: 'Dramatic black & white with deep crushed shadows and crisp whites',
    defaultIntensity: 85,
    tags: ['noir', 'bw', 'blackandwhite', 'shadows', 'contrast'],
  },

  // 2. Glitch & RGB Split
  {
    type: 'rgb_split',
    name: 'Chromatic RGB Split',
    category: 'glitch',
    description: 'Horizontal color channel displacement splitting red, green and blue',
    defaultIntensity: 60,
    tags: ['rgb', 'chromatic', 'aberration', 'split', 'glitch'],
  },
  {
    type: 'digital_glitch',
    name: 'Digital Signal Glitch',
    category: 'glitch',
    description: 'Digital sync error with raster distortion and high frequency flicker',
    defaultIntensity: 55,
    tags: ['glitch', 'digital', 'cyber', 'error', 'hacker'],
  },
  {
    type: 'crt_scanlines',
    name: 'CRT Monitor Raster',
    category: 'glitch',
    description: 'Retro arcade monitor horizontal scanline pattern with soft bloom',
    defaultIntensity: 65,
    tags: ['crt', 'scanlines', 'arcade', 'retro', 'tv'],
  },
  {
    type: 'distortion',
    name: 'Warp Distortion',
    category: 'glitch',
    description: 'Optical fisheye barrel warping and edge displacement',
    defaultIntensity: 50,
    tags: ['warp', 'distortion', 'lens', 'fisheye'],
  },

  // 3. Blur, Glow & Sharpen
  {
    type: 'gaussian_blur',
    name: 'Gaussian Defocus Blur',
    category: 'blur_glow',
    description: 'Smooth adjustable camera lens defocus blur',
    defaultIntensity: 40,
    tags: ['blur', 'defocus', 'soft', 'lens'],
  },
  {
    type: 'bloom_glow',
    name: 'Luminous Bloom Glow',
    category: 'blur_glow',
    description: 'Ethereal highlight diffusion with soft radiant aura',
    defaultIntensity: 60,
    tags: ['bloom', 'glow', 'luminous', 'radiant', 'light'],
  },
  {
    type: 'sharpen',
    name: 'Edge Sharpen Boost',
    category: 'blur_glow',
    description: 'High-pass micro-contrast enhancement clarifying texture and details',
    defaultIntensity: 50,
    tags: ['sharpen', 'crisp', 'details', 'clarity'],
  },
  {
    type: 'soft_focus',
    name: 'Dreamy Soft Focus',
    category: 'blur_glow',
    description: 'Glamour portrait soft diffusion preserving underlying sharp lines',
    defaultIntensity: 45,
    tags: ['soft', 'glamour', 'dreamy', 'portrait'],
  },

  // 4. Shake, Zoom & Flash
  {
    type: 'camera_shake',
    name: 'Handheld Camera Shake',
    category: 'motion_impact',
    description: 'Organic camera operator jitter and shake for realism',
    defaultIntensity: 50,
    tags: ['shake', 'handheld', 'motion', 'action'],
  },
  {
    type: 'zoom_pulse',
    name: 'Dynamic Zoom Pulse',
    category: 'motion_impact',
    description: 'Rhythmic scale expansion and contraction accenting music beats',
    defaultIntensity: 45,
    tags: ['zoom', 'pulse', 'beat', 'rhythm', 'bounce'],
  },
  {
    type: 'flash_impact',
    name: 'Impact White Flash',
    category: 'motion_impact',
    description: 'Explosive high-intensity flash on cut or hit decaying quickly',
    defaultIntensity: 80,
    tags: ['flash', 'white', 'impact', 'strobe', 'hit'],
  },
  {
    type: 'light_leak_pulse',
    name: 'Pulsing Light Leak',
    category: 'motion_impact',
    description: 'Organic warm lens flare breathing across the upper corners',
    defaultIntensity: 60,
    tags: ['leak', 'flare', 'pulse', 'sun', 'warm'],
  },

  // 5. Creative Color Looks
  {
    type: 'vivid_pop',
    name: 'Vivid Vibrant Pop',
    category: 'color_looks',
    description: 'Punchy saturated colors with heightened micro-contrast',
    defaultIntensity: 60,
    tags: ['vivid', 'pop', 'saturated', 'bright', 'colorful'],
  },
  {
    type: 'faded_retro',
    name: 'Matte Faded Retro',
    category: 'color_looks',
    description: 'Raised low-end black point with washed-out nostalgic pastel tones',
    defaultIntensity: 55,
    tags: ['faded', 'matte', 'retro', 'pastel', 'vintage'],
  },
  {
    type: 'cyber_neon',
    name: 'Cyberpunk Neon',
    category: 'color_looks',
    description: 'Electric magenta and cyan night vision tone with hyper-stylized highlights',
    defaultIntensity: 70,
    tags: ['cyberpunk', 'neon', 'magenta', 'cyan', 'future'],
  },
  {
    type: 'mono_contrast',
    name: 'Architectural Mono',
    category: 'color_looks',
    description: 'Pure stark monochrome emphasizing geometry, shapes and luminance',
    defaultIntensity: 75,
    tags: ['mono', 'bw', 'contrast', 'architecture'],
  },

  // 6. Particles & VFX
  {
    type: 'spark_shower',
    name: 'Sparks & Embers VFX',
    category: 'particles_vfx',
    description: 'Shower of bright glowing welding sparks and rising embers',
    defaultIntensity: 65,
    tags: ['sparks', 'embers', 'fire', 'particles', 'vfx'],
  },
  {
    type: 'smoke_haze',
    name: 'Cinematic Smoke Haze',
    category: 'particles_vfx',
    description: 'Layered atmospheric haze diffusing background depth',
    defaultIntensity: 50,
    tags: ['smoke', 'haze', 'fog', 'atmosphere', 'vfx'],
  },
  {
    type: 'energy_aura',
    name: 'Electric Energy Aura',
    category: 'particles_vfx',
    description: 'Pulsing electromagnetic aura with neon edge fringing',
    defaultIntensity: 60,
    tags: ['energy', 'aura', 'electric', 'shield', 'vfx'],
  },
  {
    type: 'embers',
    name: 'Campfire Floating Embers',
    category: 'particles_vfx',
    description: 'Slow-drifting hot golden particles rising through the frame',
    defaultIntensity: 55,
    tags: ['embers', 'fire', 'drifting', 'warm', 'vfx'],
  },
];

/**
 * Creates a new VideoEffect object with a unique ID from a preset
 */
export function createEffect(effectType: VideoEffectType): VideoEffect {
  const preset = EFFECT_PRESETS.find((p) => p.type === effectType) || EFFECT_PRESETS[0];
  return {
    id: 'eff_' + Math.random().toString(36).substring(2, 8),
    type: preset.type,
    name: preset.name,
    category: preset.category,
    intensity: preset.defaultIntensity,
    enabled: true,
  };
}

/**
 * Filter effect presets by category and/or query string
 */
export function filterEffectPresets(
  presets: EffectPresetDefinition[],
  categoryFilter: 'all' | EffectCategory,
  query = ''
): EffectPresetDefinition[] {
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
 * Composes CSS filter and transform styles for real-time preview in PreviewPlayer
 */
export function composeEffectsCss(effects?: VideoEffect[]): {
  filter: string;
  transform: string;
  overlayClass?: string;
} {
  if (!effects || effects.length === 0) {
    return { filter: '', transform: '' };
  }

  const filters: string[] = [];
  const transforms: string[] = [];

  for (const eff of effects) {
    if (!eff.enabled || eff.intensity <= 0) continue;
    const factor = eff.intensity / 100;

    switch (eff.type) {
      case 'gaussian_blur': {
        const px = Math.round(factor * 16);
        if (px > 0) filters.push(`blur(${px}px)`);
        break;
      }
      case 'bloom_glow': {
        const glowPx = Math.round(factor * 20);
        filters.push(`drop-shadow(0 0 ${glowPx}px rgba(255, 230, 180, ${factor.toFixed(2)}))`);
        break;
      }
      case 'vintage_film': {
        const sep = (factor * 35).toFixed(1);
        const con = (100 - factor * 15).toFixed(1);
        filters.push(`sepia(${sep}%) contrast(${con}%) saturate(110%)`);
        break;
      }
      case 'sepia_tone': {
        const sep = (factor * 90).toFixed(1);
        filters.push(`sepia(${sep}%) brightness(95%)`);
        break;
      }
      case 'film_noir': {
        const con = (100 + factor * 60).toFixed(1);
        filters.push(`grayscale(100%) contrast(${con}%)`);
        break;
      }
      case 'cinematic_teal_orange': {
        filters.push(`contrast(115%) saturate(125%) hue-rotate(-12deg)`);
        break;
      }
      case 'vivid_pop': {
        const sat = (100 + factor * 70).toFixed(1);
        const con = (100 + factor * 25).toFixed(1);
        filters.push(`saturate(${sat}%) contrast(${con}%)`);
        break;
      }
      case 'faded_retro': {
        const sat = (100 - factor * 35).toFixed(1);
        const con = (100 - factor * 25).toFixed(1);
        const bri = (100 + factor * 10).toFixed(1);
        filters.push(`saturate(${sat}%) contrast(${con}%) brightness(${bri}%)`);
        break;
      }
      case 'cyber_neon': {
        filters.push(`saturate(180%) contrast(125%) hue-rotate(90deg)`);
        break;
      }
      case 'mono_contrast': {
        filters.push(`grayscale(100%) contrast(140%) brightness(95%)`);
        break;
      }
      case 'flash_impact': {
        const bri = (100 + factor * 150).toFixed(1);
        filters.push(`brightness(${bri}%)`);
        break;
      }
      case 'zoom_pulse': {
        const scale = (1.0 + factor * 0.08).toFixed(3);
        transforms.push(`scale(${scale})`);
        break;
      }
      case 'camera_shake': {
        // Subtle offset based on intensity
        const shiftX = (factor * 2.5).toFixed(1);
        const shiftY = (factor * 1.5).toFixed(1);
        transforms.push(`translate(${shiftX}px, -${shiftY}px)`);
        break;
      }
      case 'rgb_split': {
        // Chromatic offset via drop-shadow
        const d = Math.max(1, Math.round(factor * 6));
        filters.push(`drop-shadow(${d}px 0 rgba(255,0,80,0.65)) drop-shadow(-${d}px 0 rgba(0,240,255,0.65))`);
        break;
      }
      case 'sharpen': {
        filters.push(`contrast(110%) brightness(102%)`);
        break;
      }
      default:
        break;
    }
  }

  return {
    filter: filters.join(' '),
    transform: transforms.join(' '),
  };
}

/**
 * Maps VideoEffect list to corresponding FFmpeg video filter strings
 */
export function composeEffectsFfmpeg(effects?: VideoEffect[]): string[] {
  if (!effects || effects.length === 0) return [];
  const filters: string[] = [];

  for (const eff of effects) {
    if (!eff.enabled || eff.intensity <= 0) continue;
    const factor = eff.intensity / 100;

    switch (eff.type) {
      case 'gaussian_blur': {
        const sigma = Math.max(0.5, factor * 8).toFixed(1);
        filters.push(`gblur=sigma=${sigma}`);
        break;
      }
      case 'sharpen': {
        const amt = Math.max(0.5, factor * 3).toFixed(2);
        filters.push(`unsharp=5:5:${amt}`);
        break;
      }
      case 'film_noir': {
        const c = (1 + factor * 0.5).toFixed(2);
        filters.push(`hue=s=0,eq=contrast=${c}`);
        break;
      }
      case 'sepia_tone': {
        // FFmpeg colorchannelmixer for authentic sepia
        filters.push(
          `colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0`
        );
        break;
      }
      case 'vintage_film': {
        const c = (1 - factor * 0.15).toFixed(2);
        const noiseAmt = Math.round(factor * 25);
        filters.push(`eq=contrast=${c}:saturation=1.1,noise=alls=${noiseAmt}:allf=t+u`);
        break;
      }
      case 'cinematic_teal_orange': {
        filters.push(`colorbalance=rs=0.15:gs=-0.05:bs=-0.15:rm=0.1:gm=-0.05:bm=-0.1`);
        break;
      }
      case 'vivid_pop': {
        const s = (1 + factor * 0.7).toFixed(2);
        const c = (1 + factor * 0.25).toFixed(2);
        filters.push(`eq=saturation=${s}:contrast=${c}`);
        break;
      }
      case 'faded_retro': {
        const s = (1 - factor * 0.35).toFixed(2);
        const c = (1 - factor * 0.2).toFixed(2);
        filters.push(`eq=saturation=${s}:contrast=${c}`);
        break;
      }
      case 'cyber_neon': {
        filters.push(`hue=h=45:s=1.8,eq=contrast=1.3`);
        break;
      }
      case 'mono_contrast': {
        filters.push(`hue=s=0,eq=contrast=1.4:brightness=-0.04`);
        break;
      }
      case 'rgb_split': {
        const shift = Math.max(2, Math.round(factor * 8));
        filters.push(`rgbashift=rh=${shift}:bv=-${shift}`);
        break;
      }
      case 'digital_glitch': {
        const noise = Math.round(factor * 40);
        filters.push(`noise=alls=${noise}:allf=t+u`);
        break;
      }
      case 'flash_impact': {
        // Flash on start of clip
        const flashBri = (factor * 0.8).toFixed(2);
        filters.push(`eq=brightness='if(lt(t,0.25),${flashBri}*(1-t/0.25),0)'`);
        break;
      }
      case 'bloom_glow': {
        filters.push(`eq=contrast=1.1:brightness=0.04`);
        break;
      }
      default:
        break;
    }
  }

  return filters;
}
