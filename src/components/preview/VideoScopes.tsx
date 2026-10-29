/**
 * HL Video Editor — Real-Time Video Scopes
 * Displays authentic frame data via Waveform (Luma), RGB Parade, and Vectorscope.
 * Renders on high-DPI HTML5 canvas using actual video/canvas pixels.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Activity, BarChart2, Disc, Eye, X } from 'lucide-react';

export type ScopeType = 'waveform' | 'parade' | 'vectorscope';

interface VideoScopesProps {
  videoElement: HTMLVideoElement | HTMLCanvasElement | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoScopes: React.FC<VideoScopesProps> = ({ videoElement, isOpen, onClose }) => {
  const [activeScope, setActiveScope] = useState<ScopeType>('waveform');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Offscreen sampling canvas
    const sampleW = 160;
    const sampleH = 90;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return;

    const renderScope = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Dark background with subtle grid
      ctx.fillStyle = '#090B0A';
      ctx.fillRect(0, 0, w, h);

      if (videoElement) {
        try {
          sampleCtx.drawImage(videoElement, 0, 0, sampleW, sampleH);
          const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH);
          const data = imgData.data;

          if (activeScope === 'waveform') {
            drawWaveform(ctx, w, h, data, sampleW, sampleH);
          } else if (activeScope === 'parade') {
            drawRgbParade(ctx, w, h, data, sampleW, sampleH);
          } else if (activeScope === 'vectorscope') {
            drawVectorscope(ctx, w, h, data, sampleW, sampleH);
          }
        } catch {
          // If cross-origin or video not ready
          drawPlaceholder(ctx, w, h);
        }
      } else {
        drawPlaceholder(ctx, w, h);
      }

      animRef.current = requestAnimationFrame(renderScope);
    };

    animRef.current = requestAnimationFrame(renderScope);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen, activeScope, videoElement]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 16,
        width: 320,
        backgroundColor: 'var(--bg-surface-2)',
        border: '1px solid var(--border-medium)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setActiveScope('waveform')}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: activeScope === 'waveform' ? 700 : 500,
              color: activeScope === 'waveform' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              backgroundColor: activeScope === 'waveform' ? 'var(--selected-surface)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Activity size={11} /> Waveform
          </button>
          <button
            onClick={() => setActiveScope('parade')}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: activeScope === 'parade' ? 700 : 500,
              color: activeScope === 'parade' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              backgroundColor: activeScope === 'parade' ? 'var(--selected-surface)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <BarChart2 size={11} /> RGB Parade
          </button>
          <button
            onClick={() => setActiveScope('vectorscope')}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: activeScope === 'vectorscope' ? 700 : 500,
              color: activeScope === 'vectorscope' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              backgroundColor: activeScope === 'vectorscope' ? 'var(--selected-surface)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Disc size={11} /> Vectorscope
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
          }}
          title="Close Scopes"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scope Canvas */}
      <canvas
        ref={canvasRef}
        width={320}
        height={220}
        style={{ width: '100%', height: 220, display: 'block' }}
      />
    </div>
  );
};

function drawPlaceholder(ctx: CanvasContext2D, w: number, h: number) {
  ctx.strokeStyle = '#262D29';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.fillStyle = '#657067';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No active video frame to analyze', w / 2, h / 2);
}

type CanvasContext2D = CanvasRenderingContext2D;

function drawWaveform(
  ctx: CanvasContext2D,
  w: number,
  h: number,
  data: Uint8ClampedArray,
  sw: number,
  sh: number
) {
  const padTop = 15;
  const padBottom = 20;
  const plotH = h - padTop - padBottom;

  // Graticule lines (0, 50, 100 IRE)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  [0, 50, 100].forEach((ire) => {
    const y = padTop + plotH * (1 - ire / 100);
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${ire}`, 22, y + 3);
  });

  // Plot green phosphor luma points
  ctx.fillStyle = 'rgba(110, 231, 183, 0.15)';
  const xScale = (w - 35) / sw;

  for (let sy = 0; sy < sh; sy += 2) {
    for (let sx = 0; sx < sw; sx += 1) {
      const idx = (sy * sw + sx) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b; // 0 to 255

      const plotX = 28 + sx * xScale;
      const plotY = padTop + plotH * (1 - luma / 255);
      ctx.fillRect(plotX, plotY, 1.5, 1.5);
    }
  }
}

function drawRgbParade(
  ctx: CanvasContext2D,
  w: number,
  h: number,
  data: Uint8ClampedArray,
  sw: number,
  sh: number
) {
  const padTop = 15;
  const padBottom = 20;
  const plotH = h - padTop - padBottom;
  const colW = (w - 40) / 3;

  // Horizontal reference lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  [0, 50, 100].forEach((ire) => {
    const y = padTop + plotH * (1 - ire / 100);
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
  });

  const channels: { color: string; offsetIdx: number; left: number; label: string }[] = [
    { color: 'rgba(248, 113, 113, 0.22)', offsetIdx: 0, left: 28, label: 'R' },
    { color: 'rgba(74, 222, 128, 0.22)', offsetIdx: 1, left: 28 + colW + 4, label: 'G' },
    { color: 'rgba(96, 165, 250, 0.22)', offsetIdx: 2, left: 28 + colW * 2 + 8, label: 'B' },
  ];

  channels.forEach((ch) => {
    ctx.fillStyle = ch.color;
    const xScale = (colW - 8) / sw;

    for (let sy = 0; sy < sh; sy += 2) {
      for (let sx = 0; sx < sw; sx += 1) {
        const idx = (sy * sw + sx) * 4;
        const val = data[idx + ch.offsetIdx];
        const plotX = ch.left + sx * xScale;
        const plotY = padTop + plotH * (1 - val / 255);
        ctx.fillRect(plotX, plotY, 1.5, 1.5);
      }
    }

    // Label
    ctx.fillStyle = ch.color.replace('0.22', '0.85');
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch.label, ch.left + colW / 2, h - 5);
  });
}

function drawVectorscope(
  ctx: CanvasContext2D,
  w: number,
  h: number,
  data: Uint8ClampedArray,
  sw: number,
  sh: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 20;

  // Reference circles (75% and 100% saturation)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.75, 0, 2 * Math.PI);
  ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Skin tone I-line (~57 degrees from top)
  const skinAngle = (57 * Math.PI) / 180;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - Math.sin(skinAngle) * radius * 0.9, cy - Math.cos(skinAngle) * radius * 0.9);
  ctx.stroke();

  // 75% Target boxes: R, Mg, B, Cy, G, Yl
  const targets = [
    { label: 'R', r: 191, g: 0, b: 0 },
    { label: 'Mg', r: 191, g: 0, b: 191 },
    { label: 'B', r: 0, g: 0, b: 191 },
    { label: 'Cy', r: 0, g: 191, b: 191 },
    { label: 'G', r: 0, g: 191, b: 0 },
    { label: 'Yl', r: 191, g: 191, b: 0 },
  ];

  targets.forEach((t) => {
    const cb = -0.168736 * t.r - 0.331264 * t.g + 0.5 * t.b;
    const cr = 0.5 * t.r - 0.418688 * t.g - 0.081312 * t.b;
    const tx = cx + (cb / 128) * (radius * 0.85);
    const ty = cy - (cr / 128) * (radius * 0.85);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(tx - 4, ty - 4, 8, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, tx, ty - 6);
  });

  // Plot chrominance points from actual pixels
  ctx.fillStyle = 'rgba(147, 197, 253, 0.2)';
  const total = sw * sh;
  for (let i = 0; i < total; i += 2) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;

    const px = cx + (cb / 128) * (radius * 0.85);
    const py = cy - (cr / 128) * (radius * 0.85);
    ctx.fillRect(px, py, 1.5, 1.5);
  }
}
