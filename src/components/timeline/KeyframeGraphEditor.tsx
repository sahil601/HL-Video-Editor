import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Activity,
  Maximize2,
  Sliders,
  Move,
  RotateCw,
  Sun,
  Volume2,
} from 'lucide-react';
import { Clip, Keyframe, KeyframeEasing, BezierControlPoints } from '../../types/project';
import { interpolateKeyframes } from '../../core/keyframes';

export type KeyframeProperty =
  | 'positionX'
  | 'positionY'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'volume';

interface KeyframeGraphEditorProps {
  clip: Clip;
  currentTimeMs: number;
  onSeek: (timeMs: number) => void;
  onUpdateKeyframes: (updatedKeyframes: Keyframe[]) => void;
  onClose: () => void;
}

interface PropertyConfig {
  id: KeyframeProperty;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
  icon: React.ReactNode;
}

const PROPERTY_CONFIGS: PropertyConfig[] = [
  {
    id: 'positionX',
    label: 'Position X',
    min: -100,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: 0,
    icon: <Move size={13} />,
  },
  {
    id: 'positionY',
    label: 'Position Y',
    min: -100,
    max: 100,
    step: 1,
    unit: '%',
    defaultValue: 0,
    icon: <Move size={13} />,
  },
  {
    id: 'scale',
    label: 'Scale',
    min: 0.1,
    max: 3.0,
    step: 0.05,
    unit: 'x',
    defaultValue: 1.0,
    icon: <Maximize2 size={13} />,
  },
  {
    id: 'opacity',
    label: 'Opacity',
    min: 0,
    max: 1.0,
    step: 0.02,
    unit: '',
    defaultValue: 1.0,
    icon: <Sun size={13} />,
  },
  {
    id: 'volume',
    label: 'Volume',
    min: 0,
    max: 2.0,
    step: 0.05,
    unit: 'x',
    defaultValue: 1.0,
    icon: <Volume2 size={13} />,
  },
  {
    id: 'rotation',
    label: 'Rotation',
    min: -180,
    max: 180,
    step: 1,
    unit: '°',
    defaultValue: 0,
    icon: <RotateCw size={13} />,
  },
];

export const KeyframeGraphEditor: React.FC<KeyframeGraphEditorProps> = ({
  clip,
  currentTimeMs,
  onSeek,
  onUpdateKeyframes,
  onClose,
}) => {
  const [selectedProperty, setSelectedProperty] = useState<KeyframeProperty>('scale');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<{
    type: 'point' | 'handle1' | 'handle2';
    keyframeId: string;
  } | null>(null);

  const activeConfig = PROPERTY_CONFIGS.find((p) => p.id === selectedProperty) || PROPERTY_CONFIGS[0];

  const clipOffsetMs = Math.max(0, Math.min(clip.durationMs, currentTimeMs - clip.startMs));

  // Extract keyframes for selected property
  const propertyKeyframes = useMemo(() => {
    return clip.keyframes
      .filter((kf) => (kf.properties as any)[selectedProperty] !== undefined)
      .sort((a, b) => a.offsetMs - b.offsetMs);
  }, [clip.keyframes, selectedProperty]);

  // Selected keyframe
  const selectedKeyframe = useMemo(() => {
    return clip.keyframes.find((kf) => kf.id === selectedKeyframeId) || null;
  }, [clip.keyframes, selectedKeyframeId]);

  // Graph dimensions
  const graphWidth = 720;
  const graphHeight = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const plotWidth = graphWidth - padLeft - padRight;
  const plotHeight = graphHeight - padTop - padBottom;

  // Coordinate mapping
  const timeToX = (timeMs: number) => {
    const frac = clip.durationMs > 0 ? timeMs / clip.durationMs : 0;
    return padLeft + frac * plotWidth;
  };

  const xToTime = (x: number) => {
    const frac = Math.max(0, Math.min(1, (x - padLeft) / plotWidth));
    return Math.round(frac * clip.durationMs);
  };

  const valueToY = (val: number) => {
    const range = activeConfig.max - activeConfig.min;
    const norm = (val - activeConfig.min) / range;
    return padTop + (1 - Math.max(0, Math.min(1, norm))) * plotHeight;
  };

  const yToValue = (y: number) => {
    const norm = 1 - Math.max(0, Math.min(1, (y - padTop) / plotHeight));
    const range = activeConfig.max - activeConfig.min;
    const raw = activeConfig.min + norm * range;
    return Math.round(raw / activeConfig.step) * activeConfig.step;
  };

  // Sample curve path points
  const curvePoints = useMemo(() => {
    const steps = 60;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * clip.durationMs;
      const evaluated = interpolateKeyframes(clip.transform, clip.volume, clip.keyframes, t);
      const val = (evaluated as any)[selectedProperty] ?? activeConfig.defaultValue;
      pts.push({ x: timeToX(t), y: valueToY(val) });
    }
    return pts;
  }, [clip.transform, clip.volume, clip.keyframes, clip.durationMs, selectedProperty, activeConfig]);

  const curvePathD = useMemo(() => {
    if (curvePoints.length === 0) return '';
    return curvePoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [curvePoints]);

  const areaPathD = useMemo(() => {
    if (curvePoints.length === 0) return '';
    const bottomY = padTop + plotHeight;
    return `${curvePathD} L ${curvePoints[curvePoints.length - 1].x} ${bottomY} L ${curvePoints[0].x} ${bottomY} Z`;
  }, [curvePathD, curvePoints, plotHeight]);

  // Add keyframe at playhead
  const handleAddKeyframe = () => {
    const evaluated = interpolateKeyframes(clip.transform, clip.volume, clip.keyframes, clipOffsetMs);
    const curVal = (evaluated as any)[selectedProperty] ?? activeConfig.defaultValue;

    const existingIdx = clip.keyframes.findIndex((kf) => Math.abs(kf.offsetMs - clipOffsetMs) < 30);

    let updated: Keyframe[];
    const newId = 'kf_' + Math.random().toString(36).substring(2, 8);

    if (existingIdx !== -1) {
      const existing = clip.keyframes[existingIdx];
      const updatedKf: Keyframe = {
        ...existing,
        properties: {
          ...existing.properties,
          [selectedProperty]: curVal,
        },
      };
      updated = [...clip.keyframes];
      updated[existingIdx] = updatedKf;
      setSelectedKeyframeId(existing.id);
    } else {
      const newKf: Keyframe = {
        id: newId,
        offsetMs: clipOffsetMs,
        properties: {
          [selectedProperty]: curVal,
        },
        easing: 'easeInOut',
        bezierHandles: { cp1x: 0.42, cp1y: 0.0, cp2x: 0.58, cp2y: 1.0 },
      };
      updated = [...clip.keyframes, newKf].sort((a, b) => a.offsetMs - b.offsetMs);
      setSelectedKeyframeId(newId);
    }

    onUpdateKeyframes(updated);
  };

  // Delete keyframe
  const handleDeleteKeyframe = () => {
    if (!selectedKeyframeId) return;
    const updated = clip.keyframes.filter((kf) => kf.id !== selectedKeyframeId);
    onUpdateKeyframes(updated);
    setSelectedKeyframeId(null);
  };

  // Change easing
  const handleChangeEasing = (easing: KeyframeEasing) => {
    if (!selectedKeyframeId) return;
    const updated = clip.keyframes.map((kf) => {
      if (kf.id === selectedKeyframeId) {
        return {
          ...kf,
          easing,
          bezierHandles:
            easing === 'bezier'
              ? kf.bezierHandles || { cp1x: 0.42, cp1y: 0.0, cp2x: 0.58, cp2y: 1.0 }
              : kf.bezierHandles,
        };
      }
      return kf;
    });
    onUpdateKeyframes(updated);
  };

  // Update value manually
  const handleUpdateValue = (val: number) => {
    if (!selectedKeyframeId) return;
    const clamped = Math.max(activeConfig.min, Math.min(activeConfig.max, val));
    const updated = clip.keyframes.map((kf) => {
      if (kf.id === selectedKeyframeId) {
        return {
          ...kf,
          properties: {
            ...kf.properties,
            [selectedProperty]: clamped,
          },
        };
      }
      return kf;
    });
    onUpdateKeyframes(updated);
  };

  // Mouse drag handling for keyframe points and handles
  const handleMouseDownPoint = (e: React.MouseEvent, keyframeId: string) => {
    e.stopPropagation();
    setSelectedKeyframeId(keyframeId);
    setDraggingTarget({ type: 'point', keyframeId });
  };

  const handleMouseDownHandle = (
    e: React.MouseEvent,
    keyframeId: string,
    handleType: 'handle1' | 'handle2'
  ) => {
    e.stopPropagation();
    setSelectedKeyframeId(keyframeId);
    setDraggingTarget({ type: handleType, keyframeId });
  };

  const handleMouseMoveSvg = (e: React.MouseEvent) => {
    if (!draggingTarget || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * graphWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * graphHeight;

    if (draggingTarget.type === 'point') {
      const newTime = xToTime(mouseX);
      const newVal = yToValue(mouseY);

      const updated = clip.keyframes.map((kf) => {
        if (kf.id === draggingTarget.keyframeId) {
          return {
            ...kf,
            offsetMs: Math.max(0, Math.min(clip.durationMs, newTime)),
            properties: {
              ...kf.properties,
              [selectedProperty]: newVal,
            },
          };
        }
        return kf;
      });
      onUpdateKeyframes(updated);
    } else if (draggingTarget.type === 'handle1' || draggingTarget.type === 'handle2') {
      const kf = clip.keyframes.find((k) => k.id === draggingTarget.keyframeId);
      if (!kf) return;
      const kfX = timeToX(kf.offsetMs);
      const kfY = valueToY((kf.properties as any)[selectedProperty] ?? activeConfig.defaultValue);

      // Relative offset
      const dx = (mouseX - kfX) / 80;
      const dy = -(mouseY - kfY) / 80;

      const curHandles: BezierControlPoints = kf.bezierHandles || {
        cp1x: 0.42,
        cp1y: 0.0,
        cp2x: 0.58,
        cp2y: 1.0,
      };

      const newHandles: BezierControlPoints =
        draggingTarget.type === 'handle1'
          ? {
              ...curHandles,
              cp1x: Math.max(0, Math.min(1, 0.5 + dx)),
              cp1y: Math.max(-1, Math.min(2, dy)),
            }
          : {
              ...curHandles,
              cp2x: Math.max(0, Math.min(1, 0.5 + dx)),
              cp2y: Math.max(-1, Math.min(2, dy)),
            };

      const updated = clip.keyframes.map((k) =>
        k.id === draggingTarget.keyframeId ? { ...k, bezierHandles: newHandles } : k
      );
      onUpdateKeyframes(updated);
    }
  };

  const handleMouseUpSvg = () => {
    setDraggingTarget(null);
  };

  const playheadX = timeToX(clipOffsetMs);

  return (
    <div
      className="vnest-keyframe-editor-container"
      style={{
        backgroundColor: 'var(--bg-surface-2)',
        border: '1px solid var(--border-medium)',
        borderRadius: '8px',
        padding: '12px 16px',
        margin: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
      onMouseUp={handleMouseUpSvg}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={15} style={{ color: 'var(--accent-sage)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Keyframe Graph Editor
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            — {clip.name}
          </span>
        </div>

        {/* Property Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Property:</label>
          <div style={{ display: 'flex', gap: '3px', backgroundColor: 'var(--bg-surface-1)', padding: '2px', borderRadius: '4px' }}>
            {PROPERTY_CONFIGS.map((cfg) => {
              const active = cfg.id === selectedProperty;
              return (
                <button
                  key={cfg.id}
                  onClick={() => {
                    setSelectedProperty(cfg.id);
                    setSelectedKeyframeId(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    border: 'none',
                    borderRadius: '3px',
                    backgroundColor: active ? 'var(--selected-surface)' : 'transparent',
                    color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {cfg.icon}
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="vnest-btn-icon"
            style={{ marginLeft: '8px', padding: '4px' }}
            title="Close Graph Editor"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 2. Keyframe Control Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleAddKeyframe}
            className="vnest-btn-secondary"
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              gap: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Add or update keyframe at playhead position"
          >
            <Plus size={13} style={{ color: 'var(--accent-sage)' }} />
            <span>Add Keyframe @ {(clipOffsetMs / 1000).toFixed(2)}s</span>
          </button>

          <button
            onClick={handleDeleteKeyframe}
            disabled={!selectedKeyframeId}
            className="vnest-btn-icon"
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              color: selectedKeyframeId ? 'var(--accent-rose)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
            }}
            title="Delete selected keyframe"
          >
            <Trash2 size={13} />
            <span style={{ marginLeft: '4px' }}>Delete</span>
          </button>

          {selectedKeyframe && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Value:</span>
              <input
                type="number"
                step={activeConfig.step}
                min={activeConfig.min}
                max={activeConfig.max}
                value={(selectedKeyframe.properties as any)[selectedProperty] ?? activeConfig.defaultValue}
                onChange={(e) => handleUpdateValue(parseFloat(e.target.value) || 0)}
                style={{
                  width: '60px',
                  backgroundColor: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '3px',
                  color: 'var(--text-primary)',
                  padding: '2px 6px',
                  fontSize: '11px',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>{activeConfig.unit}</span>
            </div>
          )}
        </div>

        {/* Easing Selector */}
        {selectedKeyframe && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Easing:</span>
            {(['linear', 'easeIn', 'easeOut', 'easeInOut', 'bezier'] as KeyframeEasing[]).map((easing) => {
              const active = selectedKeyframe.easing === easing;
              return (
                <button
                  key={easing}
                  onClick={() => handleChangeEasing(easing)}
                  style={{
                    padding: '2px 7px',
                    fontSize: '10px',
                    border: active ? '1px solid var(--accent-sage)' : '1px solid var(--border-subtle)',
                    borderRadius: '3px',
                    backgroundColor: active ? 'var(--selected-surface)' : 'transparent',
                    color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {easing === 'bezier' ? 'Bézier' : easing}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Interactive SVG Curve Graph */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${graphHeight}px`,
          backgroundColor: 'var(--bg-surface-1)',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          style={{ width: '100%', height: '100%', display: 'block', cursor: draggingTarget ? 'grabbing' : 'crosshair' }}
          onMouseMove={handleMouseMoveSvg}
        >
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-sage)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent-sage)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const y = padTop + frac * plotHeight;
            const val = activeConfig.max - frac * (activeConfig.max - activeConfig.min);
            return (
              <g key={`y_${frac}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={graphWidth - padRight}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  fontSize="9"
                  fill="var(--text-muted)"
                  textAnchor="end"
                >
                  {val.toFixed(activeConfig.step < 1 ? 1 : 0)}
                  {activeConfig.unit}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const x = padLeft + frac * plotWidth;
            const timeSec = ((frac * clip.durationMs) / 1000).toFixed(1);
            return (
              <g key={`x_${frac}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotHeight}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={graphHeight - 8}
                  fontSize="9"
                  fill="var(--text-muted)"
                  textAnchor="middle"
                >
                  {timeSec}s
                </text>
              </g>
            );
          })}

          {/* Shaded Area Under Curve */}
          {areaPathD && <path d={areaPathD} fill="url(#curveGradient)" />}

          {/* Curve Path */}
          {curvePathD && (
            <path
              d={curvePathD}
              fill="none"
              stroke="var(--accent-sage)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Playhead Indicator Line */}
          <line
            x1={playheadX}
            y1={padTop}
            x2={playheadX}
            y2={padTop + plotHeight}
            stroke="var(--accent-sage-hover)"
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />

          {/* Keyframe Points & Tangent Handles */}
          {propertyKeyframes.map((kf) => {
            const kfX = timeToX(kf.offsetMs);
            const val = (kf.properties as any)[selectedProperty] ?? activeConfig.defaultValue;
            const kfY = valueToY(val);
            const isSelected = kf.id === selectedKeyframeId;

            return (
              <g key={kf.id}>
                {/* Bézier Tangent Handles if easing is bezier and selected */}
                {isSelected && kf.easing === 'bezier' && kf.bezierHandles && (
                  <g>
                    {/* Handle 1 */}
                    <line
                      x1={kfX}
                      y1={kfY}
                      x2={kfX - 35 * (kf.bezierHandles.cp1x || 0.42)}
                      y2={kfY - 35 * (kf.bezierHandles.cp1y || 0.0)}
                      stroke="var(--accent-sage-hover)"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx={kfX - 35 * (kf.bezierHandles.cp1x || 0.42)}
                      cy={kfY - 35 * (kf.bezierHandles.cp1y || 0.0)}
                      r="4.5"
                      fill="var(--accent-sage-hover)"
                      stroke="var(--bg-surface-1)"
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(e) => handleMouseDownHandle(e, kf.id, 'handle1')}
                    />

                    {/* Handle 2 */}
                    <line
                      x1={kfX}
                      y1={kfY}
                      x2={kfX + 35 * (kf.bezierHandles.cp2x || 0.58)}
                      y2={kfY - 35 * (kf.bezierHandles.cp2y || 1.0)}
                      stroke="var(--accent-sage-hover)"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx={kfX + 35 * (kf.bezierHandles.cp2x || 0.58)}
                      cy={kfY - 35 * (kf.bezierHandles.cp2y || 1.0)}
                      r="4.5"
                      fill="var(--accent-sage-hover)"
                      stroke="var(--bg-surface-1)"
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(e) => handleMouseDownHandle(e, kf.id, 'handle2')}
                    />
                  </g>
                )}

                {/* Keyframe Point Diamond */}
                <polygon
                  points={`${kfX},${kfY - 6} ${kfX + 6},${kfY} ${kfX},${kfY + 6} ${kfX - 6},${kfY}`}
                  fill={isSelected ? 'var(--accent-sage-hover)' : 'var(--selected-surface)'}
                  stroke={isSelected ? '#FFFFFF' : 'var(--accent-sage)'}
                  strokeWidth={isSelected ? '2' : '1.5'}
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleMouseDownPoint(e, kf.id)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
