import { ElementCategory, ElementProperties, ElementShapeType } from '../../types/project';

export interface ElementPresetDefinition {
  id: ElementShapeType;
  name: string;
  category: ElementCategory;
  description: string;
  defaultProperties: ElementProperties;
}

export const ELEMENT_PRESETS: ElementPresetDefinition[] = [
  // 1. Shapes
  {
    id: 'rectangle',
    name: 'Rectangle',
    category: 'shape',
    description: 'Customizable rounded rectangle shape',
    defaultProperties: {
      elementType: 'rectangle',
      category: 'shape',
      color: '#3b82f6', // Bright blue
      secondaryColor: '#ffffff',
      strokeWidth: 0,
      cornerRadius: 12,
      opacity: 1.0,
    },
  },
  {
    id: 'circle',
    name: 'Circle',
    category: 'shape',
    description: 'Smooth circle or ellipse badge',
    defaultProperties: {
      elementType: 'circle',
      category: 'shape',
      color: '#ec4899', // Pink accent
      secondaryColor: '#ffffff',
      strokeWidth: 0,
      cornerRadius: 50,
      opacity: 1.0,
    },
  },
  {
    id: 'star',
    name: '5-Point Star',
    category: 'shape',
    description: 'Five-point star badge for highlights and ratings',
    defaultProperties: {
      elementType: 'star',
      category: 'shape',
      color: '#f59e0b', // Amber / Gold
      secondaryColor: '#d97706',
      strokeWidth: 2,
      opacity: 1.0,
    },
  },
  {
    id: 'triangle',
    name: 'Triangle',
    category: 'shape',
    description: 'Equilateral warning or pointer triangle',
    defaultProperties: {
      elementType: 'triangle',
      category: 'shape',
      color: '#ef4444', // Red
      secondaryColor: '#ffffff',
      strokeWidth: 0,
      opacity: 1.0,
    },
  },

  // 2. Arrows
  {
    id: 'arrow_right',
    name: 'Right Arrow',
    category: 'arrow',
    description: 'Bold directional arrow pointing right',
    defaultProperties: {
      elementType: 'arrow_right',
      category: 'arrow',
      color: '#10b981', // Emerald green
      secondaryColor: '#ffffff',
      strokeWidth: 2,
      opacity: 1.0,
    },
  },
  {
    id: 'arrow_curved',
    name: 'Curved Arrow',
    category: 'arrow',
    description: 'Dynamic curved swoop arrow pointing to key focus areas',
    defaultProperties: {
      elementType: 'arrow_curved',
      category: 'arrow',
      color: '#8b5cf6', // Violet
      secondaryColor: '#ffffff',
      strokeWidth: 2,
      opacity: 1.0,
    },
  },

  // 3. Frames
  {
    id: 'frame_cinema',
    name: 'Cinematic Bars',
    category: 'frame',
    description: 'Letterbox top and bottom widescreen cinematic borders',
    defaultProperties: {
      elementType: 'frame_cinema',
      category: 'frame',
      color: '#000000',
      secondaryColor: 'transparent',
      strokeWidth: 0,
      opacity: 0.95,
    },
  },
  {
    id: 'frame_border',
    name: 'Border Frame',
    category: 'frame',
    description: 'Clean video overlay border frame with rounded corners',
    defaultProperties: {
      elementType: 'frame_border',
      category: 'frame',
      color: 'transparent',
      secondaryColor: '#38bdf8', // Sky blue
      strokeWidth: 8,
      cornerRadius: 16,
      opacity: 1.0,
    },
  },

  // 4. Speech Bubbles
  {
    id: 'bubble_speech',
    name: 'Speech Bubble',
    category: 'bubble',
    description: 'Dialogue speech bubble with pointer tail and editable text',
    defaultProperties: {
      elementType: 'bubble_speech',
      category: 'bubble',
      color: '#ffffff',
      secondaryColor: '#1e293b',
      strokeWidth: 3,
      cornerRadius: 14,
      text: 'Hello!',
      opacity: 1.0,
    },
  },
  {
    id: 'bubble_thought',
    name: 'Thought Bubble',
    category: 'bubble',
    description: 'Cloud thought bubble with trailing thought circles',
    defaultProperties: {
      elementType: 'bubble_thought',
      category: 'bubble',
      color: '#f8fafc',
      secondaryColor: '#334155',
      strokeWidth: 3,
      cornerRadius: 20,
      text: 'Hmm...',
      opacity: 1.0,
    },
  },
];

/**
 * Generate an SVG string representation for an Element based on its properties.
 * Designed using scalable vector geometry without any proprietary assets.
 */
export function generateElementSvg(props: ElementProperties, width = 400, height = 300): string {
  const fill = props.color || '#3b82f6';
  const stroke = props.secondaryColor || '#ffffff';
  const strokeWidth = props.strokeWidth ?? 0;
  const radius = props.cornerRadius ?? 8;
  const opacity = props.opacity ?? 1.0;
  const text = props.text ?? '';

  let content = '';

  switch (props.elementType) {
    case 'rectangle': {
      content = `
        <rect
          x="${strokeWidth / 2 + 10}"
          y="${strokeWidth / 2 + 10}"
          width="${width - strokeWidth - 20}"
          height="${height - strokeWidth - 20}"
          rx="${radius}"
          ry="${radius}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
        />
        ${text ? `<text x="${width / 2}" y="${height / 2 + 6}" font-family="sans-serif" font-size="24" font-weight="600" fill="${stroke || '#ffffff'}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>` : ''}
      `;
      break;
    }

    case 'circle': {
      const rx = (width - strokeWidth - 20) / 2;
      const ry = (height - strokeWidth - 20) / 2;
      const cx = width / 2;
      const cy = height / 2;
      content = `
        <ellipse
          cx="${cx}"
          cy="${cy}"
          rx="${rx}"
          ry="${ry}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
        />
        ${text ? `<text x="${cx}" y="${cy + 6}" font-family="sans-serif" font-size="24" font-weight="600" fill="${stroke || '#ffffff'}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>` : ''}
      `;
      break;
    }

    case 'star': {
      // 5-point star path centered
      const cx = width / 2;
      const cy = height / 2;
      const outerR = Math.min(width, height) * 0.42;
      const innerR = outerR * 0.48;
      const points: string[] = [];

      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }

      content = `
        <polygon
          points="${points.join(' ')}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
          stroke-linejoin="round"
        />
      `;
      break;
    }

    case 'triangle': {
      const pad = 12 + strokeWidth;
      const p1 = `${width / 2},${pad}`;
      const p2 = `${width - pad},${height - pad}`;
      const p3 = `${pad},${height - pad}`;

      content = `
        <polygon
          points="${p1} ${p2} ${p3}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
          stroke-linejoin="round"
        />
        ${text ? `<text x="${width / 2}" y="${height * 0.65}" font-family="sans-serif" font-size="20" font-weight="700" fill="${stroke || '#ffffff'}" text-anchor="middle">${escapeXml(text)}</text>` : ''}
      `;
      break;
    }

    case 'arrow_right': {
      // Dynamic bold block arrow
      const hHalf = height / 2;
      const tailTop = hHalf - height * 0.16;
      const tailBottom = hHalf + height * 0.16;
      const headX = width * 0.65;
      const tipX = width - 16;
      const leftX = 16;
      const headTop = hHalf - height * 0.38;
      const headBottom = hHalf + height * 0.38;

      const path = `M ${leftX} ${tailTop} L ${headX} ${tailTop} L ${headX} ${headTop} L ${tipX} ${hHalf} L ${headX} ${headBottom} L ${headX} ${tailBottom} L ${leftX} ${tailBottom} Z`;

      content = `
        <path
          d="${path}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
          stroke-linejoin="round"
        />
      `;
      break;
    }

    case 'arrow_curved': {
      // Sleek curved sweep arrow
      content = `
        <path
          d="M 30,${height - 30} Q ${width * 0.4},${height * 0.1} ${width - 50},${height * 0.35}"
          fill="none"
          stroke="${fill}"
          stroke-width="${Math.max(6, strokeWidth * 2 + 10)}"
          stroke-linecap="round"
        />
        <polygon
          points="${width - 15},${height * 0.35} ${width - 55},${height * 0.18} ${width - 45},${height * 0.52}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
          stroke-linejoin="round"
        />
      `;
      break;
    }

    case 'frame_cinema': {
      // Letterbox top and bottom bars
      const barH = height * 0.14;
      content = `
        <rect x="0" y="0" width="${width}" height="${barH}" fill="${fill}" />
        <rect x="0" y="${height - barH}" width="${width}" height="${barH}" fill="${fill}" />
      `;
      break;
    }

    case 'frame_border': {
      const bWidth = Math.max(4, strokeWidth || 8);
      content = `
        <rect
          x="${bWidth / 2 + 8}"
          y="${bWidth / 2 + 8}"
          width="${width - bWidth - 16}"
          height="${height - bWidth - 16}"
          rx="${radius}"
          ry="${radius}"
          fill="none"
          stroke="${stroke || fill}"
          stroke-width="${bWidth}"
        />
      `;
      break;
    }

    case 'bubble_speech': {
      // Chat bubble with bottom-left pointer tail
      const bubbleH = height * 0.72;
      const bubbleW = width - 30;
      const tailPath = `M 40,${bubbleH + 10} L 25,${height - 15} L 65,${bubbleH + 10}`;

      content = `
        <g>
          <rect
            x="15"
            y="10"
            width="${bubbleW}"
            height="${bubbleH}"
            rx="${radius}"
            ry="${radius}"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="${strokeWidth}"
          />
          <polygon
            points="35,${bubbleH + 9} 18,${height - 12} 65,${bubbleH + 9}"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="${strokeWidth}"
            stroke-linejoin="round"
          />
          ${text ? `<text x="${width / 2}" y="${bubbleH / 2 + 16}" font-family="sans-serif" font-size="22" font-weight="600" fill="${stroke || '#0f172a'}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>` : ''}
        </g>
      `;
      break;
    }

    case 'bubble_thought': {
      // Cloud thought bubble with trailing circles
      const cx = width / 2;
      const cy = height * 0.42;
      const rw = width * 0.42;
      const rh = height * 0.32;

      content = `
        <g>
          <ellipse
            cx="${cx}"
            cy="${cy}"
            rx="${rw}"
            ry="${rh}"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="${strokeWidth}"
          />
          <!-- Thought dots -->
          <circle cx="${cx - rw * 0.4}" cy="${cy + rh + 12}" r="${height * 0.055}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <circle cx="${cx - rw * 0.55}" cy="${cy + rh + 28}" r="${height * 0.035}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          ${text ? `<text x="${cx}" y="${cy + 7}" font-family="sans-serif" font-size="20" font-weight="600" fill="${stroke || '#0f172a'}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>` : ''}
        </g>
      `;
      break;
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" opacity="${opacity}">
      ${content}
    </svg>
  `.trim();
}

/**
 * Return data:image/svg+xml URI for direct consumption in <img> or canvas
 */
export function getElementSvgDataUrl(props: ElementProperties, width = 400, height = 300): string {
  const svg = generateElementSvg(props, width, height);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Helper to escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert an Element SVG to PNG data URL using an Offscreen or standard HTMLCanvasElement.
 * Works seamlessly in browser and Electron renderer.
 */
export async function renderElementToPngDataUrl(
  props: ElementProperties,
  width = 1920,
  height = 1080
): Promise<string> {
  const svg = generateElementSvg(props, width, height);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Failed to get 2D canvas context'));
      }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load element SVG into image: ${e}`));
    };
    img.src = url;
  });
}
