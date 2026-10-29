/**
 * HL Video Editor — 3D LUT (Look-Up Table) Parser & Generator
 * Supports standard Adobe / DaVinci Resolve .cube files (1D and 3D)
 */

export interface ParsedLut {
  title: string;
  type: '1d' | '3d';
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // Flattened [r0, g0, b0, r1, g1, b1, ...]
}

/**
 * Parses a standard .cube LUT file string
 */
export function parseCubeLut(cubeContent: string): ParsedLut {
  const lines = cubeContent.split(/\r?\n/);
  let title = 'Custom LUT';
  let type: '1d' | '3d' = '3d';
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const tableData: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0].toUpperCase();

    if (keyword === 'TITLE') {
      const match = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (match) title = match[1];
    } else if (keyword === 'LUT_3D_SIZE') {
      type = '3d';
      size = parseInt(parts[1], 10);
    } else if (keyword === 'LUT_1D_SIZE') {
      type = '1d';
      size = parseInt(parts[1], 10);
    } else if (keyword === 'DOMAIN_MIN') {
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else if (keyword === 'DOMAIN_MAX') {
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else if (parts.length >= 3 && !isNaN(parseFloat(parts[0]))) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      tableData.push(r, g, b);
    }
  }

  if (size <= 0) {
    // Infer size if missing from header
    const totalEntries = tableData.length / 3;
    const cbrt = Math.round(Math.cbrt(totalEntries));
    if (cbrt * cbrt * cbrt === totalEntries) {
      size = cbrt;
      type = '3d';
    } else {
      size = totalEntries;
      type = '1d';
    }
  }

  return {
    title,
    type,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(tableData),
  };
}

/**
 * Applies a parsed 3D/1D LUT to an RGB color (normalized 0.0 to 1.0)
 * Uses trilinear interpolation for 3D LUTs.
 */
export function applyLutToRgb(
  lut: ParsedLut,
  r: number,
  g: number,
  b: number,
  intensity = 1.0
): [number, number, number] {
  // Normalize against domain
  const [minR, minG, minB] = lut.domainMin;
  const [maxR, maxG, maxB] = lut.domainMax;

  const normR = Math.max(0, Math.min(1, (r - minR) / (maxR - minR || 1)));
  const normG = Math.max(0, Math.min(1, (g - minG) / (maxG - minG || 1)));
  const normB = Math.max(0, Math.min(1, (b - minB) / (maxB - minB || 1)));

  let outR = r;
  let outG = g;
  let outB = b;

  if (lut.type === '3d' && lut.size > 1) {
    const s = lut.size;
    const maxIdx = s - 1;

    const rPos = normR * maxIdx;
    const gPos = normG * maxIdx;
    const bPos = normB * maxIdx;

    const r0 = Math.floor(rPos);
    const r1 = Math.min(maxIdx, r0 + 1);
    const g0 = Math.floor(gPos);
    const g1 = Math.min(maxIdx, g0 + 1);
    const b0 = Math.floor(bPos);
    const b1 = Math.min(maxIdx, b0 + 1);

    const rFrac = rPos - r0;
    const gFrac = gPos - g0;
    const bFrac = bPos - b0;

    // Helper to get RGB from flattened 3D array: index = (r + g * s + b * s * s) * 3
    const getVal = (ri: number, gi: number, bi: number): [number, number, number] => {
      const idx = (ri + gi * s + bi * s * s) * 3;
      return [lut.data[idx] ?? 0, lut.data[idx + 1] ?? 0, lut.data[idx + 2] ?? 0];
    };

    const c000 = getVal(r0, g0, b0);
    const c100 = getVal(r1, g0, b0);
    const c010 = getVal(r0, g1, b0);
    const c110 = getVal(r1, g1, b0);
    const c001 = getVal(r0, g0, b1);
    const c101 = getVal(r1, g0, b1);
    const c011 = getVal(r0, g1, b1);
    const c111 = getVal(r1, g1, b1);

    // Trilinear interpolation
    const interp = (v0: number, v1: number, frac: number) => v0 + (v1 - v0) * frac;

    const c00 = [
      interp(c000[0], c100[0], rFrac),
      interp(c000[1], c100[1], rFrac),
      interp(c000[2], c100[2], rFrac),
    ];
    const c10 = [
      interp(c010[0], c110[0], rFrac),
      interp(c010[1], c110[1], rFrac),
      interp(c010[2], c110[2], rFrac),
    ];
    const c01 = [
      interp(c001[0], c101[0], rFrac),
      interp(c001[1], c101[1], rFrac),
      interp(c001[2], c101[2], rFrac),
    ];
    const c11 = [
      interp(c011[0], c111[0], rFrac),
      interp(c011[1], c111[1], rFrac),
      interp(c011[2], c111[2], rFrac),
    ];

    const c0 = [
      interp(c00[0], c10[0], gFrac),
      interp(c00[1], c10[1], gFrac),
      interp(c00[2], c10[2], gFrac),
    ];
    const c1 = [
      interp(c01[0], c11[0], gFrac),
      interp(c01[1], c11[1], gFrac),
      interp(c01[2], c11[2], gFrac),
    ];

    outR = interp(c0[0], c1[0], bFrac);
    outG = interp(c0[1], c1[1], bFrac);
    outB = interp(c0[2], c1[2], bFrac);
  } else if (lut.type === '1d' && lut.size > 1) {
    const maxIdx = lut.size - 1;
    const rIdx = Math.round(normR * maxIdx) * 3;
    const gIdx = Math.round(normG * maxIdx) * 3;
    const bIdx = Math.round(normB * maxIdx) * 3;
    outR = lut.data[rIdx] ?? r;
    outG = lut.data[gIdx + 1] ?? g;
    outB = lut.data[bIdx + 2] ?? b;
  }

  // Blend with original by intensity
  const factor = Math.max(0, Math.min(1, intensity));
  return [
    Math.max(0, Math.min(1, r * (1 - factor) + outR * factor)),
    Math.max(0, Math.min(1, g * (1 - factor) + outG * factor)),
    Math.max(0, Math.min(1, b * (1 - factor) + outB * factor)),
  ];
}

/**
 * Generates standard .cube file format text from a ParsedLut object
 */
export function generateCubeStringFromLut(lut: ParsedLut): string {
  const lines: string[] = [
    `# Created by HL Video Editor (v1.0.0)`,
    `TITLE "${lut.title || 'Exported LUT'}"`,
    `${lut.type === '3d' ? 'LUT_3D_SIZE' : 'LUT_1D_SIZE'} ${lut.size}`,
    `DOMAIN_MIN ${lut.domainMin.join(' ')}`,
    `DOMAIN_MAX ${lut.domainMax.join(' ')}`,
    '',
  ];

  for (let i = 0; i < lut.data.length; i += 3) {
    const r = lut.data[i];
    const g = lut.data[i + 1];
    const b = lut.data[i + 2];
    lines.push(`${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)}`);
  }

  return lines.join('\n');
}

/**
 * Generates valid standard .cube file format text for a given color grading formula
 */
export function generateCubeString(
  title: string,
  size = 17,
  colorTransform: (r: number, g: number, b: number) => [number, number, number]
): string {
  const lines: string[] = [
    `# Created by HL Video Editor (v1.0.0)`,
    `TITLE "${title}"`,
    `LUT_3D_SIZE ${size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
    ``,
  ];

  // Standard .cube loop order: r outermost fast, then g, then b outermost
  for (let b = 0; b < size; b++) {
    const normB = b / (size - 1);
    for (let g = 0; g < size; g++) {
      const normG = g / (size - 1);
      for (let r = 0; r < size; r++) {
        const normR = r / (size - 1);
        const [outR, outG, outB] = colorTransform(normR, normG, normB);
        lines.push(
          `${outR.toFixed(6)} ${outG.toFixed(6)} ${outB.toFixed(6)}`
        );
      }
    }
  }

  return lines.join('\n');
}

/**
 * Built-in Cinema 3D LUT Presets
 */
export interface BuiltinLutPreset {
  id: string;
  name: string;
  description: string;
  category: 'cinematic' | 'mood' | 'vintage' | 'creative';
  generateCube: () => string;
}

export const BUILTIN_LUT_PRESETS: BuiltinLutPreset[] = [
  {
    id: 'teal_orange',
    name: 'Teal & Orange',
    description: 'Hollywood blockbuster dual-tone with rich skin tones and teal shadows',
    category: 'cinematic',
    generateCube: () =>
      generateCubeString('Teal and Orange', 17, (r, g, b) => {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const shadowFactor = Math.max(0, 1 - luma * 1.5);
        const highlightFactor = Math.max(0, (luma - 0.4) * 1.6);

        // Warm up highlights (orange/gold), cool down shadows (teal)
        const newR = Math.min(1, r * 1.05 + highlightFactor * 0.18 - shadowFactor * 0.06);
        const newG = Math.min(1, g * 0.98 + shadowFactor * 0.08 + highlightFactor * 0.05);
        const newB = Math.min(1, b * 0.92 + shadowFactor * 0.18 - highlightFactor * 0.12);
        return [Math.max(0, newR), Math.max(0, newG), Math.max(0, newB)];
      }),
  },
  {
    id: 'warm_sunset',
    name: 'Warm Sunset',
    description: 'Golden hour warmth with rich amber highlights and soft shadows',
    category: 'mood',
    generateCube: () =>
      generateCubeString('Warm Sunset', 17, (r, g, b) => {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const newR = Math.min(1, r * 1.15 + (1 - luma) * 0.08);
        const newG = Math.min(1, g * 1.02 + luma * 0.05);
        const newB = Math.min(1, b * 0.82 - (1 - luma) * 0.05);
        return [Math.max(0, newR), Math.max(0, newG), Math.max(0, newB)];
      }),
  },
  {
    id: 'faded_cinema',
    name: 'Faded Film',
    description: 'Vintage cinematic print with lifted blacks and muted highlights',
    category: 'vintage',
    generateCube: () =>
      generateCubeString('Faded Film', 17, (r, g, b) => {
        // Lift blacks to 0.08, compress peak to 0.92
        const lift = 0.08;
        const scale = 0.86;
        const newR = r * scale + lift + (r > 0.5 ? 0.03 : -0.01);
        const newG = g * scale + lift;
        const newB = b * scale + lift + (b < 0.4 ? 0.04 : -0.02);
        return [Math.max(0, Math.min(1, newR)), Math.max(0, Math.min(1, newG)), Math.max(0, Math.min(1, newB))];
      }),
  },
  {
    id: 'bw_noir',
    name: 'B&W Film Noir',
    description: 'Punchy monochrome with high contrast and deep inky shadows',
    category: 'vintage',
    generateCube: () =>
      generateCubeString('B&W Film Noir', 17, (r, g, b) => {
        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
        // S-curve contrast
        luma = luma < 0.5 ? 2 * luma * luma : 1 - 2 * (1 - luma) * (1 - luma);
        return [Math.max(0, Math.min(1, luma)), Math.max(0, Math.min(1, luma)), Math.max(0, Math.min(1, luma))];
      }),
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    description: 'Moody synthwave aesthetic with magenta highlights and cyan shadows',
    category: 'creative',
    generateCube: () =>
      generateCubeString('Cyber Neon', 17, (r, g, b) => {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const newR = Math.min(1, r * 1.1 + (luma > 0.5 ? 0.15 : -0.05));
        const newG = Math.min(1, g * 0.85 + (luma < 0.4 ? 0.08 : 0));
        const newB = Math.min(1, b * 1.25 + (luma < 0.5 ? 0.18 : 0.08));
        return [Math.max(0, newR), Math.max(0, newG), Math.max(0, newB)];
      }),
  },
];
