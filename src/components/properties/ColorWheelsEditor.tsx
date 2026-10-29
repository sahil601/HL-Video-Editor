/**
 * HL Video Editor — 3-Way Color Wheels Editor (Lift, Gamma, Gain)
 * Professional color grading interface styled in Soft Charcoal + Sage.
 */

import React, { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ColorWheels, ColorWheelValue } from '../../types/project';
import { getDefaultColorWheels } from '../../core/colorGrading';

interface ColorWheelsEditorProps {
  wheels: ColorWheels;
  onChange: (updated: ColorWheels) => void;
}

interface SingleWheelProps {
  label: string;
  sublabel: string;
  value: ColorWheelValue;
  onChange: (val: ColorWheelValue) => void;
  accentColor: string;
}

const SingleWheel: React.FC<SingleWheelProps> = ({
  label,
  sublabel,
  value,
  onChange,
  accentColor,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const size = 80;
  const radius = size / 2;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePuckFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePuckFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const updatePuckFromEvent = (e: React.PointerEvent) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + radius;
    const centerY = rect.top + radius;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(radius - 4, dist);
    const angle = Math.atan2(dy, dx);

    const normX = (clampedDist / (radius - 4)) * Math.cos(angle);
    const normY = (clampedDist / (radius - 4)) * Math.sin(angle);

    onChange({
      ...value,
      x: parseFloat(normX.toFixed(3)),
      y: parseFloat(normY.toFixed(3)),
    });
  };

  const handleReset = () => {
    onChange({ x: 0, y: 0, luma: 0 });
  };

  const puckX = radius + value.x * (radius - 4);
  const puckY = radius + value.y * (radius - 4);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        minWidth: 90,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 4px' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>({sublabel})</span>
        </div>
        <button
          onClick={handleReset}
          className="vnest-btn-icon"
          style={{ padding: 2 }}
          title={`Reset ${label}`}
        >
          <RotateCcw size={10} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Circular Color Disk */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleReset}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'crosshair',
          background: `
            radial-gradient(circle at center, #262D29 10%, transparent 75%),
            conic-gradient(
              from 0deg,
              #ef4444 0deg,
              #eab308 60deg,
              #22c55e 120deg,
              #06b6d4 180deg,
              #3b82f6 240deg,
              #a855f7 300deg,
              #ef4444 360deg
            )
          `,
          boxShadow: 'inset 0 0 4px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.4)',
          border: '1px solid var(--border-medium)',
        }}
        title={`${label}: Drag to adjust color bias, double-click to center`}
      >
        {/* Neutral center crosshair */}
        <div
          style={{
            position: 'absolute',
            left: radius - 3,
            top: radius - 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            pointerEvents: 'none',
          }}
        />

        {/* Draggable Puck Indicator */}
        <div
          style={{
            position: 'absolute',
            left: puckX - 4,
            top: puckY - 4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 4px rgba(0, 0, 0, 0.8), 0 0 2px #000000',
            border: `1.5px solid ${accentColor}`,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Master Luminance Slider */}
      <div style={{ width: '100%', marginTop: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)', marginBottom: 1 }}>
          <span>Luma</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value.luma ?? 0}</span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={value.luma ?? 0}
          onChange={(e) =>
            onChange({
              ...value,
              luma: parseInt(e.target.value, 10),
            })
          }
          style={{ width: '100%', height: 4 }}
          title={`${label} master luminance offset`}
        />
      </div>
    </div>
  );
};

export const ColorWheelsEditor: React.FC<ColorWheelsEditorProps> = ({ wheels, onChange }) => {
  const currentWheels = wheels || getDefaultColorWheels();

  const handleUpdate = (key: keyof ColorWheels, val: ColorWheelValue) => {
    onChange({
      ...currentWheels,
      [key]: val,
    });
  };

  const handleResetAll = () => {
    onChange(getDefaultColorWheels());
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        backgroundColor: 'var(--bg-surface-1)',
        padding: '10px 8px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          3-Way Color Wheels
        </span>
        <button
          onClick={handleResetAll}
          className="vnest-btn-subtle"
          style={{ padding: '2px 6px', fontSize: 9 }}
          title="Reset all 3 wheels to neutral"
        >
          Reset Wheels
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <SingleWheel
          label="Lift"
          sublabel="Shadows"
          value={currentWheels.lift}
          onChange={(val) => handleUpdate('lift', val)}
          accentColor="#60a5fa"
        />
        <SingleWheel
          label="Gamma"
          sublabel="Mids"
          value={currentWheels.gamma}
          onChange={(val) => handleUpdate('gamma', val)}
          accentColor="#34d399"
        />
        <SingleWheel
          label="Gain"
          sublabel="Highlights"
          value={currentWheels.gain}
          onChange={(val) => handleUpdate('gain', val)}
          accentColor="#fbbf24"
        />
      </div>
    </div>
  );
};
