import { OverlayCategory, BlendMode } from '../../types/project';

export interface OverlayPresetDefinition {
  id: string;
  name: string;
  category: OverlayCategory;
  description: string;
  recommendedBlendMode: BlendMode;
  defaultOpacity: number;
  tags: string[];
}

export const OVERLAY_CATEGORIES: { id: OverlayCategory; name: string }[] = [
  { id: 'light_leaks', name: 'Light Leaks & Flares' },
  { id: 'film_grain', name: 'Film Grain & Dust' },
  { id: 'particles', name: 'Rain, Snow & Particles' },
  { id: 'retro_vhs', name: 'VHS & Glitch' },
  { id: 'cinematic', name: 'Letterbox & Gradients' },
  { id: 'frames', name: 'Frames & Borders' },
];

export const OVERLAY_PRESETS: OverlayPresetDefinition[] = [
  // 1. Light Leaks & Flares
  {
    id: 'light_leak_warm',
    name: 'Warm Sunset Light Leak',
    category: 'light_leaks',
    description: 'Golden hour corner lens burn with warm amber glow',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.85,
    tags: ['light', 'sun', 'warm', 'glow', 'golden', 'leak'],
  },
  {
    id: 'lens_flare_anamorphic',
    name: 'Anamorphic Blue Flare',
    category: 'light_leaks',
    description: 'Cinematic horizontal anamorphic cyan streak with optical artifacts',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.9,
    tags: ['flare', 'anamorphic', 'streak', 'blue', 'cinema'],
  },
  {
    id: 'bokeh_orbs',
    name: 'Floating Bokeh Orbs',
    category: 'light_leaks',
    description: 'Soft out-of-focus circular light discs floating gracefully',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.75,
    tags: ['bokeh', 'orbs', 'blur', 'lights', 'dreamy'],
  },
  {
    id: 'glow_corona',
    name: 'Radiant Corona Glow',
    category: 'light_leaks',
    description: 'Center-weighted radiant starburst with soft atmospheric bleed',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.7,
    tags: ['corona', 'glow', 'sunburst', 'atmospheric'],
  },

  // 2. Film Grain & Dust
  {
    id: 'film_grain_35mm',
    name: '35mm Film Grain',
    category: 'film_grain',
    description: 'Authentic 35mm analog emulsion texture with fine grain',
    recommendedBlendMode: 'overlay',
    defaultOpacity: 0.5,
    tags: ['grain', '35mm', 'film', 'analog', 'vintage'],
  },
  {
    id: 'dust_scratches',
    name: 'Dust & Film Scratches',
    category: 'film_grain',
    description: 'Vintage projector dust specks, fibers, and vertical emulsion scratches',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.65,
    tags: ['dust', 'scratch', 'projector', 'retro', 'grunge'],
  },
  {
    id: 'vintage_paper',
    name: 'Aged Parchment Texture',
    category: 'film_grain',
    description: 'Subtle sepia fiber texture giving an aged archival document look',
    recommendedBlendMode: 'multiply',
    defaultOpacity: 0.45,
    tags: ['paper', 'parchment', 'texture', 'vintage'],
  },
  {
    id: 'heavy_grit',
    name: 'Grungy Film Grit',
    category: 'film_grain',
    description: 'Intense cinematic rough texture for dramatic urban looks',
    recommendedBlendMode: 'overlay',
    defaultOpacity: 0.6,
    tags: ['grit', 'rough', 'grunge', 'coarse'],
  },

  // 3. Rain, Snow & Particles
  {
    id: 'rain_streaks',
    name: 'Cinematic Rain Streaks',
    category: 'particles',
    description: 'Diagonal falling rain streaks with subtle water mist',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.8,
    tags: ['rain', 'weather', 'water', 'storm', 'drops'],
  },
  {
    id: 'snow_flurries',
    name: 'Gentle Snow Flurries',
    category: 'particles',
    description: 'Floating multi-depth soft snowflakes drifting across frame',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.85,
    tags: ['snow', 'winter', 'flakes', 'flurries', 'particles'],
  },
  {
    id: 'fog_mist',
    name: 'Atmospheric Fog & Mist',
    category: 'particles',
    description: 'Soft layered low mist drift adding depth and mystery',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.6,
    tags: ['fog', 'mist', 'smoke', 'haze', 'atmosphere'],
  },
  {
    id: 'smoke_wisps',
    name: 'Wispy Smoke Tendrils',
    category: 'particles',
    description: 'Organic rising smoke plumes with soft density gradient',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.65,
    tags: ['smoke', 'steam', 'wisps', 'plumes'],
  },

  // 4. VHS & Glitch
  {
    id: 'vhs_tracking',
    name: 'VHS Tape Tracking',
    category: 'retro_vhs',
    description: 'Retro VCR static tracking bar with noise lines at bottom',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.85,
    tags: ['vhs', 'tape', 'tracking', 'static', '90s', 'retro'],
  },
  {
    id: 'crt_scanlines',
    name: 'CRT Monitor Scanlines',
    category: 'retro_vhs',
    description: 'Horizontal phosphor cathode ray scanlines and subtle grid',
    recommendedBlendMode: 'multiply',
    defaultOpacity: 0.7,
    tags: ['crt', 'scanlines', 'monitor', 'arcade', 'retro'],
  },
  {
    id: 'rgb_glitch_bars',
    name: 'RGB Glitch Blocks',
    category: 'retro_vhs',
    description: 'Digital signal artifact stripes with cyan, red, and blue offsets',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.75,
    tags: ['glitch', 'rgb', 'digital', 'blocks', 'cyber'],
  },
  {
    id: 'tape_damage',
    name: 'Warped Tape Distortion',
    category: 'retro_vhs',
    description: 'Analog video magnetic tape crease distortion band',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.8,
    tags: ['tape', 'distortion', 'vhs', 'crease'],
  },

  // 5. Letterbox & Gradients
  {
    id: 'letterbox_235',
    name: 'Cinemascope 2.35:1 Bars',
    category: 'cinematic',
    description: 'Classic matte black cinematic top and bottom letterbox bars',
    recommendedBlendMode: 'normal',
    defaultOpacity: 1.0,
    tags: ['letterbox', 'cinema', 'bars', 'matte', 'wide'],
  },
  {
    id: 'letterbox_240',
    name: 'Ultrawide 2.40:1 Scope',
    category: 'cinematic',
    description: 'Modern widescreen 2.40 scope aspect ratio matte',
    recommendedBlendMode: 'normal',
    defaultOpacity: 1.0,
    tags: ['letterbox', 'scope', 'ultrawide', 'anamorphic'],
  },
  {
    id: 'gradient_sunset',
    name: 'Sunset Duo Wash',
    category: 'cinematic',
    description: 'Rich amber orange top gradient blending to deep purple shadows',
    recommendedBlendMode: 'overlay',
    defaultOpacity: 0.5,
    tags: ['gradient', 'sunset', 'amber', 'purple', 'wash'],
  },
  {
    id: 'gradient_teal_orange',
    name: 'Blockbuster Teal & Orange',
    category: 'cinematic',
    description: 'Complementary cinema color wash pushing shadows teal and highlights warm',
    recommendedBlendMode: 'overlay',
    defaultOpacity: 0.55,
    tags: ['teal', 'orange', 'hollywood', 'cinema', 'gradient'],
  },

  // 6. Frames & Borders
  {
    id: 'frame_vintage_polaroid',
    name: 'Instant Polaroid Border',
    category: 'frames',
    description: 'Classic vintage instant snapshot photo frame with bottom margin',
    recommendedBlendMode: 'normal',
    defaultOpacity: 1.0,
    tags: ['polaroid', 'photo', 'frame', 'vintage', 'instant'],
  },
  {
    id: 'frame_social_reels',
    name: 'Social Media Safe Zone',
    category: 'frames',
    description: 'Viewfinder overlay with TikTok/Reels UI safe zones and center crosshair',
    recommendedBlendMode: 'normal',
    defaultOpacity: 0.85,
    tags: ['social', 'reels', 'tiktok', 'safezone', 'viewfinder'],
  },
  {
    id: 'frame_grunge_border',
    name: 'Distressed Film Border',
    category: 'frames',
    description: 'Heavy ragged photographic sprocket edge and dark vignette frame',
    recommendedBlendMode: 'multiply',
    defaultOpacity: 0.9,
    tags: ['border', 'grunge', 'sprocket', 'distressed', 'film'],
  },
  {
    id: 'frame_cyber_hud',
    name: 'Cyberpunk HUD Viewfinder',
    category: 'frames',
    description: 'Tech sci-fi corner bracket guides, coordinate crosshairs, and frame index',
    recommendedBlendMode: 'screen',
    defaultOpacity: 0.85,
    tags: ['hud', 'cyberpunk', 'tech', 'brackets', 'scifi'],
  },
];

/**
 * Generates an SVG string representation of an overlay.
 * These SVGs are resolution-independent and render crisp at any resolution.
 */
export function generateOverlaySvg(
  presetId: string,
  width = 1920,
  height = 1080,
  options?: { opacity?: number; color?: string }
): string {
  const opacity = options?.opacity ?? 1.0;

  switch (presetId) {
    // 1. Light Leaks
    case 'light_leak_warm': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="leak1" cx="0%" cy="0%" r="75%">
              <stop offset="0%" stop-color="#ff7b00" stop-opacity="0.95" />
              <stop offset="35%" stop-color="#ff0055" stop-opacity="0.6" />
              <stop offset="70%" stop-color="#9900ff" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="leak2" cx="100%" cy="100%" r="60%">
              <stop offset="0%" stop-color="#ffb700" stop-opacity="0.8" />
              <stop offset="40%" stop-color="#ff3300" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#leak1)" />
          <rect width="${width}" height="${height}" fill="url(#leak2)" />
        </svg>
      `.trim();
    }

    case 'lens_flare_anamorphic': {
      const midY = height / 2;
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <linearGradient id="streak" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stop-color="#00e5ff" stop-opacity="0" />
              <stop offset="30%" stop-color="#00e5ff" stop-opacity="0.3" />
              <stop offset="48%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="52%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="70%" stop-color="#0091ff" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#0091ff" stop-opacity="0" />
            </linearGradient>
            <radialGradient id="flareCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="25%" stop-color="#00e5ff" stop-opacity="0.8" />
              <stop offset="60%" stop-color="#0055ff" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
          </defs>
          <!-- Horizontal Anamorphic Streak -->
          <rect x="0" y="${midY - 12}" width="${width}" height="24" fill="url(#streak)" />
          <rect x="0" y="${midY - 4}" width="${width}" height="8" fill="url(#streak)" />
          <!-- Central Glow Core -->
          <circle cx="${width / 2}" cy="${midY}" r="${Math.min(width, height) * 0.22}" fill="url(#flareCore)" />
          <!-- Optical Rings -->
          <circle cx="${width * 0.38}" cy="${midY}" r="35" fill="none" stroke="#00e5ff" stroke-width="2" opacity="0.4" />
          <circle cx="${width * 0.65}" cy="${midY}" r="55" fill="none" stroke="#7000ff" stroke-width="2" opacity="0.3" />
        </svg>
      `.trim();
    }

    case 'bokeh_orbs': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="bokehGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffe6aa" stop-opacity="0.75" />
              <stop offset="70%" stop-color="#ffaa55" stop-opacity="0.3" />
              <stop offset="95%" stop-color="#ff7733" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="${width * 0.15}" cy="${height * 0.25}" r="${height * 0.14}" fill="url(#bokehGlow)" />
          <circle cx="${width * 0.28}" cy="${height * 0.7}" r="${height * 0.22}" fill="url(#bokehGlow)" />
          <circle cx="${width * 0.72}" cy="${height * 0.35}" r="${height * 0.18}" fill="url(#bokehGlow)" />
          <circle cx="${width * 0.85}" cy="${height * 0.8}" r="${height * 0.12}" fill="url(#bokehGlow)" />
          <circle cx="${width * 0.48}" cy="${height * 0.18}" r="${height * 0.08}" fill="url(#bokehGlow)" />
          <circle cx="${width * 0.58}" cy="${height * 0.62}" r="${height * 0.15}" fill="url(#bokehGlow)" />
        </svg>
      `.trim();
    }

    case 'glow_corona': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="corona" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
              <stop offset="20%" stop-color="#fff1bd" stop-opacity="0.75" />
              <stop offset="50%" stop-color="#ffaa44" stop-opacity="0.35" />
              <stop offset="80%" stop-color="#ff4400" stop-opacity="0.1" />
              <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.45}" ry="${height * 0.45}" fill="url(#corona)" />
        </svg>
      `.trim();
    }

    // 2. Film Grain & Dust
    case 'film_grain_35mm': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <filter id="grainFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.4" intercept="-0.2" />
                <feFuncG type="linear" slope="1.4" intercept="-0.2" />
                <feFuncB type="linear" slope="1.4" intercept="-0.2" />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="${width}" height="${height}" filter="url(#grainFilter)" opacity="0.6" />
        </svg>
      `.trim();
    }

    case 'dust_scratches': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <!-- Vertical fine film scratches -->
          <line x1="${width * 0.22}" y1="0" x2="${width * 0.222}" y2="${height}" stroke="#ffffff" stroke-width="1.2" opacity="0.45" />
          <line x1="${width * 0.68}" y1="0" x2="${width * 0.678}" y2="${height}" stroke="#ffffff" stroke-width="0.8" opacity="0.35" />
          <line x1="${width * 0.81}" y1="0" x2="${width * 0.811}" y2="${height}" stroke="#ffffff" stroke-width="1.5" opacity="0.5" />
          <!-- Random specks of dust and fibers -->
          <circle cx="${width * 0.12}" cy="${height * 0.35}" r="2" fill="#ffffff" opacity="0.7" />
          <circle cx="${width * 0.18}" cy="${height * 0.82}" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="${width * 0.42}" cy="${height * 0.15}" r="3" fill="#ffffff" opacity="0.8" />
          <circle cx="${width * 0.53}" cy="${height * 0.58}" r="2.2" fill="#ffffff" opacity="0.75" />
          <circle cx="${width * 0.74}" cy="${height * 0.28}" r="2.5" fill="#ffffff" opacity="0.65" />
          <circle cx="${width * 0.88}" cy="${height * 0.72}" r="1.8" fill="#ffffff" opacity="0.7" />
          <circle cx="${width * 0.93}" cy="${height * 0.19}" r="2" fill="#ffffff" opacity="0.6" />
          <!-- Small hair filament -->
          <path d="M${width * 0.35} ${height * 0.4} Q${width * 0.36} ${height * 0.43} ${width * 0.355} ${height * 0.45}" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="0.6" />
        </svg>
      `.trim();
    }

    case 'vintage_paper': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="vignettePaper" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stop-color="#fff5e6" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#8c6239" stop-opacity="0.85" />
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#vignettePaper)" />
        </svg>
      `.trim();
    }

    case 'heavy_grit': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <filter id="gritFilter">
              <feTurbulence type="turbulence" baseFrequency="0.45" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  1 1 1 0 0" />
            </filter>
          </defs>
          <rect width="${width}" height="${height}" filter="url(#gritFilter)" opacity="0.4" />
        </svg>
      `.trim();
    }

    // 3. Rain, Snow & Particles
    case 'rain_streaks': {
      const streaks: string[] = [];
      const cols = 24;
      for (let i = 0; i < cols; i++) {
        const x = (i / cols) * width + (i % 3) * 20;
        const y1 = ((i * 47) % height);
        const len = 70 + ((i * 31) % 110);
        streaks.push(
          `<line x1="${x}" y1="${y1}" x2="${x + 22}" y2="${y1 + len}" stroke="#d0e8ff" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />`
        );
      }
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          ${streaks.join('\n')}
        </svg>
      `.trim();
    }

    case 'snow_flurries': {
      const flakes: string[] = [];
      const count = 48;
      for (let i = 0; i < count; i++) {
        const cx = ((i * 137.5) % width);
        const cy = ((i * 79.3) % height);
        const r = 2 + (i % 5) * 1.5;
        const op = 0.4 + (i % 4) * 0.18;
        flakes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="${op}" />`);
      }
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          ${flakes.join('\n')}
        </svg>
      `.trim();
    }

    case 'fog_mist': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <linearGradient id="fogGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
              <stop offset="40%" stop-color="#ffffff" stop-opacity="0.35" />
              <stop offset="80%" stop-color="#ffffff" stop-opacity="0.05" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <rect y="${height * 0.4}" width="${width}" height="${height * 0.6}" fill="url(#fogGrad)" />
        </svg>
      `.trim();
    }

    case 'smoke_wisps': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="smoke1" cx="30%" cy="70%" r="40%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5" />
              <stop offset="50%" stop-color="#ffffff" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="smoke2" cx="70%" cy="50%" r="45%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
              <stop offset="60%" stop-color="#ffffff" stop-opacity="0.15" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="${width * 0.3}" cy="${height * 0.7}" r="${height * 0.4}" fill="url(#smoke1)" />
          <circle cx="${width * 0.7}" cy="${height * 0.5}" r="${height * 0.45}" fill="url(#smoke2)" />
        </svg>
      `.trim();
    }

    // 4. VHS & Glitch
    case 'vhs_tracking': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <!-- Top distortion line -->
          <rect x="0" y="24" width="${width}" height="6" fill="#ffffff" opacity="0.4" />
          <!-- Bottom thick tracking static bar -->
          <rect x="0" y="${height - 110}" width="${width}" height="70" fill="#ffffff" opacity="0.3" />
          <line x1="0" y1="${height - 85}" x2="${width}" y2="${height - 85}" stroke="#00ffff" stroke-width="4" opacity="0.6" />
          <line x1="0" y1="${height - 75}" x2="${width}" y2="${height - 75}" stroke="#ff0055" stroke-width="4" opacity="0.6" />
          <!-- PLAY icon in corner -->
          <text x="50" y="70" fill="#00ff66" font-family="monospace" font-size="28" font-weight="bold">PLAY &#9658; 0:12:45</text>
          <text x="${width - 160}" y="70" fill="#00ff66" font-family="monospace" font-size="28" font-weight="bold">SP</text>
        </svg>
      `.trim();
    }

    case 'crt_scanlines': {
      const lines: string[] = [];
      const step = 6;
      for (let y = 0; y < height; y += step) {
        lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#000000" stroke-width="2" opacity="0.45" />`);
      }
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          ${lines.join('\n')}
        </svg>
      `.trim();
    }

    case 'rgb_glitch_bars': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <rect x="0" y="${height * 0.18}" width="${width}" height="18" fill="#ff0055" opacity="0.5" />
          <rect x="15" y="${height * 0.18 + 4}" width="${width}" height="14" fill="#00ffff" opacity="0.6" />
          <rect x="0" y="${height * 0.48}" width="${width}" height="28" fill="#00ff66" opacity="0.4" />
          <rect x="-20" y="${height * 0.48 + 6}" width="${width}" height="22" fill="#ff00ff" opacity="0.5" />
          <rect x="0" y="${height * 0.78}" width="${width}" height="16" fill="#ffff00" opacity="0.45" />
        </svg>
      `.trim();
    }

    case 'tape_damage': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <path d="M0 ${height * 0.42} Q${width * 0.25} ${height * 0.48} ${width * 0.5} ${height * 0.43} T${width} ${height * 0.46} L${width} ${height * 0.5} L0 ${height * 0.5} Z" fill="#ffffff" opacity="0.4" />
          <line x1="0" y1="${height * 0.44}" x2="${width}" y2="${height * 0.44}" stroke="#ff3300" stroke-width="3" opacity="0.5" />
          <line x1="0" y1="${height * 0.46}" x2="${width}" y2="${height * 0.46}" stroke="#00ccff" stroke-width="3" opacity="0.5" />
        </svg>
      `.trim();
    }

    // 5. Letterbox & Gradients
    case 'letterbox_235': {
      // 2.35:1 aspect ratio on 16:9 canvas
      // active height = width / 2.35
      const activeHeight = width / 2.35;
      const barHeight = Math.max(0, Math.round((height - activeHeight) / 2));
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#000000" />
          <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="#000000" />
        </svg>
      `.trim();
    }

    case 'letterbox_240': {
      // 2.40:1 aspect ratio on 16:9 canvas
      const activeHeight = width / 2.4;
      const barHeight = Math.max(0, Math.round((height - activeHeight) / 2));
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#000000" />
          <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="#000000" />
        </svg>
      `.trim();
    }

    case 'gradient_sunset': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <linearGradient id="sunsetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ff7700" stop-opacity="0.7" />
              <stop offset="50%" stop-color="#ff0077" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#330066" stop-opacity="0.75" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#sunsetGrad)" />
        </svg>
      `.trim();
    }

    case 'gradient_teal_orange': {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <linearGradient id="toGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff9900" stop-opacity="0.65" />
              <stop offset="50%" stop-color="#000000" stop-opacity="0" />
              <stop offset="100%" stop-color="#00a2b8" stop-opacity="0.7" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#toGrad)" />
        </svg>
      `.trim();
    }

    // 6. Frames & Borders
    case 'frame_vintage_polaroid': {
      const pad = Math.round(width * 0.04);
      const bottomPad = Math.round(height * 0.16);
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <!-- Outer border -->
          <path d="
            M0,0 H${width} V${height} H0 Z
            M${pad},${pad} V${height - bottomPad} H${width - pad} V${pad} Z
          " fill="#fcf9f2" fill-rule="evenodd" />
        </svg>
      `.trim();
    }

    case 'frame_social_reels': {
      const radius = 24;
      const pad = 36;
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <!-- Safe area border -->
          <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" rx="${radius}" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.6" />
          <!-- Center crosshair -->
          <line x1="${width / 2 - 20}" y1="${height / 2}" x2="${width / 2 + 20}" y2="${height / 2}" stroke="#ffffff" stroke-width="2" opacity="0.75" />
          <line x1="${width / 2}" y1="${height / 2 - 20}" x2="${width / 2}" y2="${height / 2 + 20}" stroke="#ffffff" stroke-width="2" opacity="0.75" />
          <!-- Top / bottom safe indicators -->
          <text x="${width / 2}" y="${pad + 30}" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="600" text-anchor="middle" opacity="0.7">HEADER SAFE AREA</text>
          <text x="${width / 2}" y="${height - pad - 16}" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="600" text-anchor="middle" opacity="0.7">ACTION SAFE AREA</text>
        </svg>
      `.trim();
    }

    case 'frame_grunge_border': {
      const t = 40;
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <defs>
            <radialGradient id="grungeVig" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stop-color="#000000" stop-opacity="0" />
              <stop offset="95%" stop-color="#000000" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#000000" stop-opacity="1.0" />
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#grungeVig)" />
          <!-- Sprocket holes on left and right -->
          <rect x="0" y="0" width="${t}" height="${height}" fill="#000000" />
          <rect x="${width - t}" y="0" width="${t}" height="${height}" fill="#000000" />
        </svg>
      `.trim();
    }

    case 'frame_cyber_hud': {
      const len = 60;
      const pad = 40;
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <!-- Top Left Corner -->
          <path d="M${pad} ${pad + len} V${pad} H${pad + len}" stroke="#00e5ff" stroke-width="3" fill="none" />
          <!-- Top Right Corner -->
          <path d="M${width - pad - len} ${pad} H${width - pad} V${pad + len}" stroke="#00e5ff" stroke-width="3" fill="none" />
          <!-- Bottom Left Corner -->
          <path d="M${pad} ${height - pad - len} V${height - pad} H${pad + len}" stroke="#00e5ff" stroke-width="3" fill="none" />
          <!-- Bottom Right Corner -->
          <path d="M${width - pad - len} ${height - pad} H${width - pad} V${height - pad - len}" stroke="#00e5ff" stroke-width="3" fill="none" />
          <!-- Center targeting circle -->
          <circle cx="${width / 2}" cy="${height / 2}" r="32" stroke="#00e5ff" stroke-width="1.5" stroke-dasharray="6 4" fill="none" opacity="0.6" />
          <!-- Telemetry indices -->
          <text x="${pad + 8}" y="${pad - 12}" fill="#00e5ff" font-family="monospace" font-size="14" font-weight="bold">SYS.REC // 4K 60FPS</text>
          <text x="${width - pad - 120}" y="${height - pad + 24}" fill="#00e5ff" font-family="monospace" font-size="14" font-weight="bold">GRID: LOCKED</text>
        </svg>
      `.trim();
    }

    default: {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" opacity="${opacity}">
          <rect width="${width}" height="${height}" fill="none" stroke="#6366f1" stroke-width="4" />
        </svg>
      `.trim();
    }
  }
}

/**
 * Filter overlays by category and/or search query
 */
export function filterOverlayPresets(
  presets: OverlayPresetDefinition[],
  categoryFilter: 'all' | OverlayCategory,
  query = ''
): OverlayPresetDefinition[] {
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
 * Converts an SVG string into a transparent PNG Blob using Canvas
 */
export async function rasterizeOverlayToPngBlob(
  svgString: string,
  width = 1920,
  height = 1080
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to generate PNG blob from overlay canvas'));
          },
          'image/png'
        );
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to rasterize overlay SVG: ${e}`));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}
