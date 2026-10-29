export type SfxCategory = 'whoosh' | 'impact' | 'cinematic' | 'glitch' | 'ui' | 'ambient';

export interface SfxPreset {
  id: string;
  name: string;
  category: SfxCategory;
  durationSec: number;
  description: string;
  isFavorite?: boolean;
}

export const SFX_CATEGORIES: { id: SfxCategory; name: string }[] = [
  { id: 'whoosh', name: 'Whooshes & Sweeps' },
  { id: 'impact', name: 'Impacts & Hits' },
  { id: 'cinematic', name: 'Risers & Drops' },
  { id: 'glitch', name: 'Glitch & Beeps' },
  { id: 'ui', name: 'UI & Shutters' },
  { id: 'ambient', name: 'Ambient & Nature' },
];

export const SFX_PRESETS: SfxPreset[] = [
  // 1. Whooshes & Transition Sweeps
  {
    id: 'whoosh_fast',
    name: 'Fast Air Whoosh',
    category: 'whoosh',
    durationSec: 0.45,
    description: 'Quick dynamic transition whoosh for fast cuts',
  },
  {
    id: 'swoosh_deep',
    name: 'Deep Low Swoosh',
    category: 'whoosh',
    durationSec: 0.8,
    description: 'Cinematic low-end pass-by swoosh',
  },
  {
    id: 'whip_pan',
    name: 'Whip Pan Snap',
    category: 'whoosh',
    durationSec: 0.35,
    description: 'High velocity whip movement accent',
  },
  {
    id: 'air_sweep_slow',
    name: 'Slow Atmospheric Sweep',
    category: 'whoosh',
    durationSec: 1.2,
    description: 'Gradual airy pass-by transition sweep',
  },

  // 2. Pops, Clicks, Impacts & Cinematic Hits
  {
    id: 'impact_pop',
    name: 'Clean Pop Hit',
    category: 'impact',
    durationSec: 0.25,
    description: 'Snappy UI pop or cut hit',
  },
  {
    id: 'cinematic_hit',
    name: 'Heavy Cinematic Hit',
    category: 'impact',
    durationSec: 1.1,
    description: 'Punchy action impact with sub rumble',
  },
  {
    id: 'wood_click',
    name: 'Organic Percussion Click',
    category: 'impact',
    durationSec: 0.2,
    description: 'Natural wooden block tap and snap',
  },
  {
    id: 'metal_slam',
    name: 'Industrial Metal Slam',
    category: 'impact',
    durationSec: 1.2,
    description: 'Heavy metallic slam and reverberation',
  },

  // 3. Risers, Drops, Booms & Bass Impacts
  {
    id: 'bass_drop',
    name: 'Sub Bass Drop',
    category: 'cinematic',
    durationSec: 1.5,
    description: 'Dramatic low frequency 808 pitch drop',
  },
  {
    id: 'deep_boom',
    name: 'Sub Boom Rumble',
    category: 'cinematic',
    durationSec: 2.0,
    description: 'Low thunderous cinematic explosion rumble',
  },
  {
    id: 'tension_riser',
    name: 'Tension Riser',
    category: 'cinematic',
    durationSec: 2.4,
    description: 'Building suspense audio rise for build-ups',
  },
  {
    id: 'sci_fi_drop',
    name: 'Sci-Fi Warp Drop',
    category: 'cinematic',
    durationSec: 1.6,
    description: 'Futuristic energy drain and pitch sweep',
  },

  // 4. Glitch Sounds, Digital Beeps & Interface Sounds
  {
    id: 'digital_glitch',
    name: 'Cyber Glitch Zap',
    category: 'glitch',
    durationSec: 0.45,
    description: 'Electronic glitch frequency burst',
  },
  {
    id: 'laser_burst',
    name: 'Sci-Fi Laser Pulse',
    category: 'glitch',
    durationSec: 0.4,
    description: 'Synthesized high-energy laser zap',
  },
  {
    id: 'digital_beep',
    name: 'Crisp Confirm Beep',
    category: 'glitch',
    durationSec: 0.25,
    description: 'Short dual-tone interface confirmation beep',
  },
  {
    id: 'data_scramble',
    name: 'Data Stream Scramble',
    category: 'glitch',
    durationSec: 0.6,
    description: 'Rapid digital bitstream noise chatter',
  },

  // 5. Camera Shutters, Typing, Notifications & Mouse Clicks
  {
    id: 'camera_shutter',
    name: 'Mechanical Shutter',
    category: 'ui',
    durationSec: 0.35,
    description: 'Crisp camera snapshot and aperture click',
  },
  {
    id: 'mouse_click',
    name: 'Tactile Mouse Click',
    category: 'ui',
    durationSec: 0.15,
    description: 'Realistic microswitch button click',
  },
  {
    id: 'typewriter_key',
    name: 'Mechanical Key Tap',
    category: 'ui',
    durationSec: 0.12,
    description: 'Haptic mechanical keyboard switch stroke',
  },
  {
    id: 'bell_notification',
    name: 'Modern Bell Chime',
    category: 'ui',
    durationSec: 0.85,
    description: 'Warm harmonic notification chime',
  },

  // 6. Ambient Wind, Rain, Nature & Atmosphere
  {
    id: 'wind_breeze',
    name: 'Howling Wind Gust',
    category: 'ambient',
    durationSec: 3.0,
    description: 'Atmospheric whistling cold wind gust',
  },
  {
    id: 'rain_gentle',
    name: 'Soft Rain Ambience',
    category: 'ambient',
    durationSec: 3.0,
    description: 'Soothing continuous raindrops on glass',
  },
  {
    id: 'cosmic_drone',
    name: 'Deep Space Drone',
    category: 'ambient',
    durationSec: 3.2,
    description: 'Ethereal resonant sub atmospheric pad',
  },
  {
    id: 'forest_rustle',
    name: 'Whispering Leaves',
    category: 'ambient',
    durationSec: 2.8,
    description: 'Gentle nature wind through forest trees',
  },
];

/**
 * Encodes Float32Array PCM samples (-1.0 to 1.0) into a standard 16-bit mono WAV Blob
 */
export function pcmToWavBlob(samples: Float32Array, sampleRate = 44100): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Helper to write ASCII string
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true); // chunkSize
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // audioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // numChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // sampleRate
  view.setUint32(28, sampleRate * 2, true); // byteRate
  view.setUint16(32, 2, true);  // blockAlign
  view.setUint16(34, 16, true); // bitsPerSample

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Pure procedural mathematical synthesis of sound effects.
 * 100% offline, reproducible, zero external dependencies, works in both browser and Vitest.
 */
export function synthesizeSfxSamples(presetId: string, sampleRate = 44100): Float32Array {
  const preset = SFX_PRESETS.find((p) => p.id === presetId) || SFX_PRESETS[0];
  const numSamples = Math.ceil(preset.durationSec * sampleRate);
  const samples = new Float32Array(numSamples);

  switch (presetId) {
    case 'whoosh_fast': {
      // Bandpass swept noise with fast envelope
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 2;
        const freq = 300 + 1600 * Math.sin(progress * Math.PI);
        const noise = (Math.random() * 2 - 1) * 0.7;
        const tone = Math.sin(2 * Math.PI * freq * t) * 0.3;
        samples[i] = (noise + tone) * env * 0.9;
      }
      break;
    }

    case 'swoosh_deep': {
      // Low resonant swoosh
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 1.8;
        const freq = 80 + 350 * Math.sin(progress * Math.PI);
        const noise = (Math.random() * 2 - 1) * 0.5;
        const sub = Math.sin(2 * Math.PI * freq * t) * 0.5;
        samples[i] = (noise + sub) * env * 0.95;
      }
      break;
    }

    case 'whip_pan': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 3;
        const freq = 600 + 2400 * progress;
        const noise = (Math.random() * 2 - 1) * 0.8;
        samples[i] = (noise * Math.sin(2 * Math.PI * freq * t)) * env * 0.95;
      }
      break;
    }

    case 'air_sweep_slow': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 1.5;
        const freq = 200 + 800 * Math.sin(progress * Math.PI);
        const noise = (Math.random() * 2 - 1);
        samples[i] = noise * Math.sin(2 * Math.PI * freq * t) * env * 0.8;
      }
      break;
    }

    case 'impact_pop': {
      // Snappy sine drop
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 24);
        const freq = 550 * Math.exp(-t * 30) + 60;
        samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.95;
      }
      break;
    }

    case 'cinematic_hit': {
      // Punchy transient + decaying sub rumble
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const clickEnv = Math.exp(-t * 80);
        const subEnv = Math.exp(-t * 3.5);
        const click = (Math.random() * 2 - 1) * clickEnv * 0.8;
        const subFreq = 90 * Math.exp(-t * 2) + 38;
        const sub = Math.sin(2 * Math.PI * subFreq * t) * subEnv * 0.9;
        samples[i] = Math.max(-1, Math.min(1, click + sub));
      }
      break;
    }

    case 'wood_click': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 70);
        const tone1 = Math.sin(2 * Math.PI * 800 * t);
        const tone2 = Math.sin(2 * Math.PI * 1450 * t) * 0.5;
        samples[i] = (tone1 + tone2) * env * 0.9;
      }
      break;
    }

    case 'metal_slam': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 4);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.6;
        const m1 = Math.sin(2 * Math.PI * 180 * t) * 0.4;
        const m2 = Math.sin(2 * Math.PI * 420 * t) * 0.3;
        const m3 = Math.sin(2 * Math.PI * 680 * t) * 0.2;
        samples[i] = (noise + m1 + m2 + m3) * env * 0.9;
      }
      break;
    }

    case 'bass_drop': {
      // 808 sub bass pitch slide down
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 1.8);
        const freq = 140 * Math.exp(-t * 1.6) + 32;
        samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.95;
      }
      break;
    }

    case 'deep_boom': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 1.5);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 10) * 0.4;
        const sub = Math.sin(2 * Math.PI * (55 * Math.exp(-t * 0.8) + 25) * t) * 0.8;
        samples[i] = (noise + sub) * env * 0.95;
      }
      break;
    }

    case 'tension_riser': {
      // Exponential frequency rise
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.pow(progress, 1.8);
        const freq = 65 * Math.exp(progress * 2.3);
        const saw = (2 * ((freq * t) % 1) - 1) * 0.5;
        const sine = Math.sin(2 * Math.PI * freq * t) * 0.5;
        samples[i] = (saw + sine) * env * 0.9;
      }
      break;
    }

    case 'sci_fi_drop': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.exp(-progress * 2.5);
        const freq = 800 * Math.exp(-progress * 3.5) + 40;
        const fm = Math.sin(2 * Math.PI * 25 * t) * 40;
        samples[i] = Math.sin(2 * Math.PI * (freq + fm) * t) * env * 0.9;
      }
      break;
    }

    case 'digital_glitch': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 6);
        const step = Math.floor(t * 40);
        const freq = (step % 3 === 0 ? 1200 : step % 3 === 1 ? 440 : 1800);
        const bitcrush = Math.sign(Math.sin(2 * Math.PI * freq * t));
        samples[i] = bitcrush * env * 0.7;
      }
      break;
    }

    case 'laser_burst': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 12);
        const freq = 2200 * Math.exp(-t * 18) + 120;
        samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
      }
      break;
    }

    case 'digital_beep': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 15);
        const tone = t < 0.1 ? Math.sin(2 * Math.PI * 880 * t) : Math.sin(2 * Math.PI * 1320 * t);
        samples[i] = tone * env * 0.8;
      }
      break;
    }

    case 'data_scramble': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.sin((t / preset.durationSec) * Math.PI);
        const freq = 800 + ((Math.floor(t * 30) * 317) % 1600);
        const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
        samples[i] = square * env * 0.65;
      }
      break;
    }

    case 'camera_shutter': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Double click: mirror slap at 0.0s, curtain at 0.12s
        const click1 = Math.exp(-t * 90) * Math.sin(2 * Math.PI * 1200 * t);
        const t2 = Math.max(0, t - 0.12);
        const click2 = Math.exp(-t2 * 80) * Math.sin(2 * Math.PI * 900 * t2);
        samples[i] = (click1 + click2) * 0.9;
      }
      break;
    }

    case 'mouse_click': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 120);
        const pop = Math.sin(2 * Math.PI * 1800 * t) * 0.6;
        const snap = (Math.random() * 2 - 1) * 0.4;
        samples[i] = (pop + snap) * env * 0.9;
      }
      break;
    }

    case 'typewriter_key': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 100);
        const thud = Math.sin(2 * Math.PI * 320 * t) * 0.6;
        const click = (Math.random() * 2 - 1) * 0.4;
        samples[i] = (thud + click) * env * 0.85;
      }
      break;
    }

    case 'bell_notification': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 4);
        const h1 = Math.sin(2 * Math.PI * 587.33 * t) * 0.5; // D5
        const h2 = Math.sin(2 * Math.PI * 880 * t) * 0.35;   // A5
        const h3 = Math.sin(2 * Math.PI * 1174.66 * t) * 0.2; // D6
        samples[i] = (h1 + h2 + h3) * env * 0.85;
      }
      break;
    }

    case 'wind_breeze': {
      let lastNoise = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 1.2;
        // Lowpass filtered noise for warm gust
        const raw = Math.random() * 2 - 1;
        lastNoise = lastNoise * 0.92 + raw * 0.08;
        const whistle = Math.sin(2 * Math.PI * (280 + 80 * Math.sin(t * 3)) * t) * 0.15;
        samples[i] = (lastNoise * 2.5 + whistle) * env * 0.85;
      }
      break;
    }

    case 'rain_gentle': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 0.5;
        const noise = (Math.random() * 2 - 1) * 0.3;
        const drop = Math.random() > 0.995 ? (Math.random() * 2 - 1) * 0.7 : 0;
        samples[i] = (noise + drop) * env * 0.75;
      }
      break;
    }

    case 'cosmic_drone': {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 0.8;
        const root = Math.sin(2 * Math.PI * 55 * t) * 0.5;
        const fifth = Math.sin(2 * Math.PI * 82.4 * t) * 0.3;
        const mod = Math.sin(2 * Math.PI * 0.5 * t);
        const shimmer = Math.sin(2 * Math.PI * 220 * t) * 0.15 * mod;
        samples[i] = (root + fifth + shimmer) * env * 0.85;
      }
      break;
    }

    case 'forest_rustle': {
      let filtered = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        const env = Math.sin(progress * Math.PI) ** 0.6;
        const raw = (Math.random() * 2 - 1);
        filtered = filtered * 0.85 + raw * 0.15;
        const flutter = Math.sin(t * 8) * 0.2;
        samples[i] = filtered * (0.8 + flutter) * env * 0.8;
      }
      break;
    }

    default: {
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = t / preset.durationSec;
        samples[i] = Math.sin(2 * Math.PI * 440 * t) * Math.sin(progress * Math.PI) * 0.5;
      }
      break;
    }
  }

  // Ensure all samples strictly stay within [-1.0, 1.0]
  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.max(-1.0, Math.min(1.0, samples[i]));
  }

  return samples;
}

/**
 * Synthesizes pure procedural audio effects into a standard WAV Blob
 */
export async function generateSfxAudioBlob(presetId: string): Promise<Blob> {
  const samples = synthesizeSfxSamples(presetId, 44100);
  return pcmToWavBlob(samples, 44100);
}

/**
 * Filter sound effects by category and/or query string
 */
export function filterSfxPresets(
  presets: SfxPreset[],
  categoryFilter: 'all' | SfxCategory,
  query = ''
): SfxPreset[] {
  return presets.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });
}

