import React, { useEffect, useRef } from 'react';

interface ClipWaveformProps {
  peaks: number[];
  width: number;
  height: number;
  color?: string;
  backgroundColor?: string;
}

export const ClipWaveform: React.FC<ClipWaveformProps> = ({
  peaks,
  width,
  height,
  color = '#9BAF9B', // Sage accent for audio waveforms
  backgroundColor = 'transparent',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    if (!peaks || peaks.length === 0) return;

    const barWidth = 2;
    const barGap = 1.5;
    const totalBarSlot = barWidth + barGap;
    const numBars = Math.floor(width / totalBarSlot);
    if (numBars <= 0) return;

    const centerY = height / 2;
    const maxHalfHeight = Math.max(4, (height - 6) / 2);

    ctx.fillStyle = color;

    for (let i = 0; i < numBars; i++) {
      const peakIdx = Math.floor((i / numBars) * peaks.length);
      const peakVal = peaks[peakIdx] ?? 0.1;
      const barHalfH = Math.max(1.5, peakVal * maxHalfHeight);

      const x = i * totalBarSlot;
      const y = centerY - barHalfH;
      const barH = barHalfH * 2;

      // Draw rounded vertical bar
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, 1) : ctx.rect(x, y, barWidth, barH);
      ctx.fill();
    }
  }, [peaks, width, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        opacity: 0.85,
      }}
    />
  );
};
