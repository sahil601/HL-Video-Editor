import React, { useState } from 'react';
import {
  Sliders,
  Move,
  Volume2,
  Gauge,
  Diamond,
  Type,
  Palette,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Sparkles,
  Music,
  Layout,
  Columns,
  Shapes,
  Eye,
  EyeOff,
  Layers,
  Wand2,
  RefreshCw,
  Upload,
  Focus,
} from 'lucide-react';
import { Clip, Project, BlendMode, VideoEffect, TransitionType, MaskShape, ClipMask, SpeedCurvePoint, WatermarkRemoverSettings } from '../../types/project';
import { SPEED_CURVE_PRESETS } from '../../core/speedCurves';
import { LOOK_PRESETS, getDefaultColorAdjustments } from '../../core/colorPresets';
import { formatTimecode } from '../../core/time';
import { applyPipPreset } from '../../core/pipPresets';
import { ELEMENT_PRESETS } from '../../core/elements/elementDefinitions';
import { EFFECT_PRESETS, createEffect } from '../../core/effects/effectDefinitions';
import { TRANSITION_PRESETS, clampTransitionDuration, createTransition } from '../../core/transitions/transitionDefinitions';
import { DEFAULT_WATERMARK_SETTINGS, WATERMARK_CORNER_PRESETS } from '../../core/watermark';
import { BUILTIN_LUT_PRESETS, parseCubeLut } from '../../core/lut';
import { ColorWheelsEditor } from './ColorWheelsEditor';
import { AudioProcessingEditor } from './AudioProcessingEditor';
import { getDefaultColorAdjustments as getDefaultGradingAdjustments, getDefaultColorWheels } from '../../core/colorGrading';

interface PropertiesPanelProps {
  project: Project;
  selectedClip: Clip | null;
  currentTimeMs: number;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => void;
  onAddKeyframe: (clipId: string, offsetMs: number) => void;
  onDeleteKeyframe: (clipId: string, keyframeId: string) => void;
  onExtractAudio?: (clipId: string) => void;
  style?: React.CSSProperties;
  onCollapse?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  project,
  selectedClip,
  currentTimeMs,
  onUpdateClip,
  onAddKeyframe,
  onDeleteKeyframe,
  onExtractAudio,
  style,
  onCollapse,
}) => {
  const [openSections, setOpenSections] = useState({
    transform: true,
    pip: true,
    element: true,
    crop: false,
    chroma: true,
    speed: true,
    audio: true,
    keyframes: true,
    text: true,
    color: true,
    effects: true,
    transition: true,
    overlay: true,
    mask: true,
    watermark: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!selectedClip) {
    return (
      <div className="vnest-sidebar-right" style={{ padding: 16, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Project Inspector
          </span>
          {onCollapse && (
            <button
              id="properties-collapse-btn"
              onClick={onCollapse}
              className="vnest-btn-icon"
              style={{ padding: '3px', color: 'var(--text-secondary)' }}
              title="Collapse Inspector"
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        <div className="vnest-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Name:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Resolution:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {project.settings.width} x {project.settings.height}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Aspect Ratio:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-sage)' }}>
              {project.settings.aspectRatio}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Frame Rate:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {project.settings.fps} fps
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
            <span className="font-mono-time" style={{ color: 'var(--text-primary)' }}>
              {formatTimecode(project.durationMs, project.settings.fps)}
            </span>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '24px 16px',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-muted)',
          }}
        >
          <Sliders style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.4, color: 'var(--accent-sage)' }} />
          <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            No Clip Selected
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Select any timeline clip to adjust its position, scale, crop, chroma key, speed curve, audio volume, or keyframes.
          </p>
        </div>
      </div>
    );
  }

  const clipOffsetMs = Math.max(0, currentTimeMs - selectedClip.startMs);
  const isPlayheadOverClip =
    currentTimeMs >= selectedClip.startMs &&
    currentTimeMs <= selectedClip.startMs + selectedClip.durationMs;

  const crop = selectedClip.transform.crop || { top: 0, bottom: 0, left: 0, right: 0 };
  const chroma = selectedClip.chromaKey || { enabled: false, color: '#00FF00', similarity: 0.35, smoothness: 0.1 };
  const colors = selectedClip.colorAdjustments || { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, vignette: 0, sharpen: 0 };

  return (
    <div className="vnest-sidebar-right" style={style}>
      {/* Clip Header */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="vnest-badge vnest-badge-indigo">
              {selectedClip.type} Clip
            </span>
            {selectedClip.isFrozen && (
              <span className="vnest-badge vnest-badge-cyan">
                Frozen Frame
              </span>
            )}
            {chroma.enabled && (
              <span className="vnest-badge vnest-badge-emerald">
                Chroma Key
              </span>
            )}
          </div>
          {onCollapse && (
            <button
              id="properties-collapse-btn"
              onClick={onCollapse}
              className="vnest-btn-icon"
              style={{ padding: '3px', color: 'var(--text-secondary)' }}
              title="Collapse Inspector"
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '4px 0 2px' }}>
          {selectedClip.name}
        </h4>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
          <span>Start: {formatTimecode(selectedClip.startMs, project.settings.fps)}</span>
          <span>•</span>
          <span>Dur: {(selectedClip.durationMs / 1000).toFixed(2)}s</span>
        </div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 1. Text Properties (if text clip) */}
        {selectedClip.type === 'text' && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('text')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Type style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
                Text Typography
              </div>
              {openSections.text ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.text && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Text Content</label>
                  <textarea
                    rows={2}
                    value={selectedClip.textProperties?.text || ''}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        textProperties: {
                          ...selectedClip.textProperties!,
                          text: e.target.value,
                        },
                      })
                    }
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Font Size ({selectedClip.textProperties?.fontSize || 36}px)
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="100"
                      value={selectedClip.textProperties?.fontSize || 36}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          textProperties: {
                            ...selectedClip.textProperties!,
                            fontSize: parseInt(e.target.value, 10),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Text Color</label>
                    <input
                      type="color"
                      value={selectedClip.textProperties?.color || '#ffffff'}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          textProperties: {
                            ...selectedClip.textProperties!,
                            color: e.target.value,
                          },
                        })
                      }
                      style={{ width: '100%', height: 26, padding: 0 }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Font Family</label>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const native = (window as any).vnestNative;
                          if (native?.selectFontFile) {
                            const res = await native.selectFontFile();
                            if (res && res.fontName && res.dataBase64) {
                              const fontFace = new FontFace(res.fontName, `url(data:font/${res.format};base64,${res.dataBase64})`);
                              await fontFace.load();
                              document.fonts.add(fontFace);
                              onUpdateClip(selectedClip.id, {
                                textProperties: {
                                  ...selectedClip.textProperties!,
                                  fontFamily: res.fontName,
                                  customFontPath: res.filePath,
                                },
                              });
                            }
                          } else {
                            // Browser file picker fallback
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.ttf,.otf,.woff2';
                            input.onchange = async () => {
                              const file = input.files?.[0];
                              if (file) {
                                const fontName = file.name.replace(/\.[^/.]+$/, '');
                                const arrayBuffer = await file.arrayBuffer();
                                const fontFace = new FontFace(fontName, arrayBuffer);
                                await fontFace.load();
                                document.fonts.add(fontFace);
                                onUpdateClip(selectedClip.id, {
                                  textProperties: {
                                    ...selectedClip.textProperties!,
                                    fontFamily: fontName,
                                  },
                                });
                              }
                            };
                            input.click();
                          }
                        } catch (err) {
                          console.error('Font import error:', err);
                        }
                      }}
                      className="vnest-btn-subtle"
                      style={{ padding: '2px 6px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-sage)' }}
                    >
                      <Upload size={10} />
                      <span>Import TTF/OTF</span>
                    </button>
                  </div>
                  <select
                    value={selectedClip.textProperties?.fontFamily || 'Plus Jakarta Sans'}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        textProperties: {
                          ...selectedClip.textProperties!,
                          fontFamily: e.target.value,
                        },
                      })
                    }
                    style={{ width: '100%' }}
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Inter">Inter</option>
                    <option value="Impact">Impact (Viral / Bold)</option>
                    <option value="Arial">Arial</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Courier New">Courier New</option>
                    {selectedClip.textProperties?.fontFamily &&
                      !['Plus Jakarta Sans', 'Inter', 'Impact', 'Arial', 'Montserrat', 'Courier New'].includes(
                        selectedClip.textProperties.fontFamily
                      ) && (
                        <option value={selectedClip.textProperties.fontFamily}>
                          {selectedClip.textProperties.fontFamily} (Custom)
                        </option>
                      )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Outline ({selectedClip.textProperties?.strokeWidth || 0}px)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      value={selectedClip.textProperties?.strokeWidth || 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          textProperties: {
                            ...selectedClip.textProperties!,
                            strokeWidth: parseInt(e.target.value, 10),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Outline Color</label>
                    <input
                      type="color"
                      value={selectedClip.textProperties?.strokeColor || '#000000'}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          textProperties: {
                            ...selectedClip.textProperties!,
                            strokeColor: e.target.value,
                          },
                        })
                      }
                      style={{ width: '100%', height: 26, padding: 0 }}
                    />
                  </div>
                </div>

                {/* Phase 3: Text Shadows */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Text Shadow
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        Offset X ({selectedClip.textProperties?.shadowOffsetX ?? 0}px)
                      </label>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        value={selectedClip.textProperties?.shadowOffsetX ?? 0}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              shadowOffsetX: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        Offset Y ({selectedClip.textProperties?.shadowOffsetY ?? 2}px)
                      </label>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        value={selectedClip.textProperties?.shadowOffsetY ?? 2}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              shadowOffsetY: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        Blur ({selectedClip.textProperties?.shadowBlur ?? 8}px)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={selectedClip.textProperties?.shadowBlur ?? 8}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              shadowBlur: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        Opacity ({selectedClip.textProperties?.shadowOpacity ?? 85}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedClip.textProperties?.shadowOpacity ?? 85}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              shadowOpacity: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>Color</label>
                      <input
                        type="color"
                        value={selectedClip.textProperties?.shadowColor || '#000000'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              shadowColor: e.target.value,
                            },
                          })
                        }
                        style={{ width: '100%', height: 24, padding: 0 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Phase 3: Text Entrance & Exit Animations */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Text Animations
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>In Animation</label>
                      <select
                        value={selectedClip.textProperties?.inAnimation || 'none'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              inAnimation: e.target.value as any,
                            },
                          })
                        }
                        style={{ width: '100%', fontSize: 10 }}
                      >
                        <option value="none">None</option>
                        <option value="fade">Fade In</option>
                        <option value="slide">Slide Up</option>
                        <option value="zoom">Zoom In</option>
                        <option value="typewriter">Typewriter</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Out Animation</label>
                      <select
                        value={selectedClip.textProperties?.outAnimation || 'none'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              outAnimation: e.target.value as any,
                            },
                          })
                        }
                        style={{ width: '100%', fontSize: 10 }}
                      >
                        <option value="none">None</option>
                        <option value="fade">Fade Out</option>
                        <option value="slide">Slide Down</option>
                        <option value="zoom">Zoom Out</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        In Dur ({((selectedClip.textProperties?.inAnimationDurationMs ?? 400) / 1000).toFixed(1)}s)
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="50"
                        value={selectedClip.textProperties?.inAnimationDurationMs ?? 400}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              inAnimationDurationMs: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>
                        Out Dur ({((selectedClip.textProperties?.outAnimationDurationMs ?? 400) / 1000).toFixed(1)}s)
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="50"
                        value={selectedClip.textProperties?.outAnimationDurationMs ?? 400}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              outAnimationDurationMs: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Background Box</label>
                  <select
                    value={selectedClip.textProperties?.backgroundColor || 'transparent'}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        textProperties: {
                          ...selectedClip.textProperties!,
                          backgroundColor: e.target.value,
                        },
                      })
                    }
                    style={{ width: '100%' }}
                  >
                    <option value="transparent">None (Transparent)</option>
                    <option value="rgba(0, 0, 0, 0.65)">Dark 65%</option>
                    <option value="rgba(0, 0, 0, 0.9)">Solid Black</option>
                    <option value="rgba(15, 23, 42, 0.85)">Midnight Slate</option>
                    <option value="rgba(234, 179, 8, 0.85)">Yellow Highlight</option>
                  </select>
                </div>

                {selectedClip.textProperties?.words && selectedClip.textProperties.words.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        id="prop-word-hl"
                        checked={selectedClip.textProperties?.highlightWord ?? true}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            textProperties: {
                              ...selectedClip.textProperties!,
                              highlightWord: e.target.checked,
                            },
                          })
                        }
                      />
                      <label htmlFor="prop-word-hl" style={{ fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        Word Karaoke Highlighting
                      </label>
                    </div>

                    <input
                      type="color"
                      value={selectedClip.textProperties?.highlightColor || '#facc15'}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          textProperties: {
                            ...selectedClip.textProperties!,
                            highlightColor: e.target.value,
                          },
                        })
                      }
                      style={{ width: 28, height: 22, padding: 0 }}
                      title="Word highlight color"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Element Graphic Properties (if element clip) */}
        {selectedClip.type === 'element' && selectedClip.elementProperties && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('element')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shapes style={{ width: 14, height: 14, color: 'var(--accent-purple)' }} />
                Element Graphics ({selectedClip.elementProperties.category.toUpperCase()})
              </div>
              {openSections.element ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.element && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Element type selector */}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Graphic Preset</label>
                  <select
                    value={selectedClip.elementProperties.elementType}
                    onChange={(e) => {
                      const found = ELEMENT_PRESETS.find((p) => p.id === e.target.value);
                      if (found) {
                        onUpdateClip(selectedClip.id, {
                          elementProperties: {
                            ...selectedClip.elementProperties!,
                            ...found.defaultProperties,
                          },
                          name: found.name,
                        });
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    {ELEMENT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary & Secondary Color */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fill Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={selectedClip.elementProperties.color.startsWith('#') ? selectedClip.elementProperties.color : '#3b82f6'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            elementProperties: {
                              ...selectedClip.elementProperties!,
                              color: e.target.value,
                            },
                          })
                        }
                        style={{ width: 32, height: 26, padding: 0, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={selectedClip.elementProperties.color}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            elementProperties: {
                              ...selectedClip.elementProperties!,
                              color: e.target.value,
                            },
                          })
                        }
                        style={{ width: '100%', fontSize: 11, padding: '3px 6px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Outline / Accent</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={selectedClip.elementProperties.secondaryColor?.startsWith('#') ? selectedClip.elementProperties.secondaryColor : '#ffffff'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            elementProperties: {
                              ...selectedClip.elementProperties!,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        style={{ width: 32, height: 26, padding: 0, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={selectedClip.elementProperties.secondaryColor || '#ffffff'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            elementProperties: {
                              ...selectedClip.elementProperties!,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        style={{ width: '100%', fontSize: 11, padding: '3px 6px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stroke width & Corner radius */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      Stroke Width ({selectedClip.elementProperties.strokeWidth || 0}px)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      value={selectedClip.elementProperties.strokeWidth || 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          elementProperties: {
                            ...selectedClip.elementProperties!,
                            strokeWidth: parseInt(e.target.value, 10),
                          },
                        })
                      }
                    />
                  </div>

                  {selectedClip.elementProperties.cornerRadius !== undefined && (
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                        Corner Radius ({selectedClip.elementProperties.cornerRadius}px)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={selectedClip.elementProperties.cornerRadius}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            elementProperties: {
                              ...selectedClip.elementProperties!,
                              cornerRadius: parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Text for bubbles & labeled shapes */}
                {('text' in selectedClip.elementProperties || selectedClip.elementProperties.category === 'bubble') && (
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Inner Text</label>
                    <input
                      type="text"
                      value={selectedClip.elementProperties.text || ''}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          elementProperties: {
                            ...selectedClip.elementProperties!,
                            text: e.target.value,
                          },
                        })
                      }
                      placeholder="Enter bubble or shape text..."
                      style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Transform (Scale, Position, Rotation, Flip, Opacity) */}
        <div className="vnest-card">
          <div
            onClick={() => toggleSection('transform')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Move style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />
              Transform & Flip
            </div>
            {openSections.transform ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          </div>

          {openSections.transform && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Scale */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Scale</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedClip.transform.scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={selectedClip.transform.scale}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      transform: { ...selectedClip.transform, scale: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>

              {/* Position X and Y */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pos X</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedClip.transform.positionX}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={selectedClip.transform.positionX}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, positionX: parseInt(e.target.value, 10) },
                      })
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pos Y</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedClip.transform.positionY}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={selectedClip.transform.positionY}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, positionY: parseInt(e.target.value, 10) },
                      })
                    }
                  />
                </div>
              </div>

              {/* Rotation & Quick buttons */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rotation</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(selectedClip.transform.rotation)}°</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedClip.transform.rotation}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, rotation: parseInt(e.target.value, 10) },
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, rotation: (selectedClip.transform.rotation - 90) % 360 },
                      })
                    }
                    className="vnest-btn-subtle"
                    style={{ padding: '3px 6px' }}
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, rotation: (selectedClip.transform.rotation + 90) % 360 },
                      })
                    }
                    className="vnest-btn-subtle"
                    style={{ padding: '3px 6px' }}
                    title="Rotate 90° CW"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>
              </div>

              {/* Flip Horizontal & Flip Vertical */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() =>
                    onUpdateClip(selectedClip.id, {
                      transform: { ...selectedClip.transform, flipH: !selectedClip.transform.flipH },
                    })
                  }
                  className="vnest-btn-subtle"
                  style={{
                    padding: '5px 8px',
                    fontSize: 11,
                    justifyContent: 'center',
                    backgroundColor: selectedClip.transform.flipH ? 'var(--selected-surface)' : 'transparent',
                    color: selectedClip.transform.flipH ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    borderColor: selectedClip.transform.flipH ? 'var(--accent-sage)' : 'var(--border-subtle)',
                  }}
                >
                  <FlipHorizontal size={13} />
                  <span>Flip Horizontal</span>
                </button>
                <button
                  onClick={() =>
                    onUpdateClip(selectedClip.id, {
                      transform: { ...selectedClip.transform, flipV: !selectedClip.transform.flipV },
                    })
                  }
                  className="vnest-btn-subtle"
                  style={{
                    padding: '5px 8px',
                    fontSize: 11,
                    justifyContent: 'center',
                    backgroundColor: selectedClip.transform.flipV ? 'var(--selected-surface)' : 'transparent',
                    color: selectedClip.transform.flipV ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    borderColor: selectedClip.transform.flipV ? 'var(--accent-sage)' : 'var(--border-subtle)',
                  }}
                >
                  <FlipVertical size={13} />
                  <span>Flip Vertical</span>
                </button>
              </div>

              {/* Opacity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Opacity</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(selectedClip.transform.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedClip.transform.opacity}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      transform: { ...selectedClip.transform, opacity: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* PIP & Split-Screen Presets */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('pip')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layout style={{ width: 14, height: 14, color: 'var(--accent-purple)' }} />
                PIP & Split-Screen Presets
              </div>
              {openSections.pip ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.pip && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* PIP Corner Buttons */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Picture-in-Picture (35% Corner)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'pip_top_left');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Corner PIP in top-left"
                    >
                      <span>↖</span> Top-Left PIP
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'pip_top_right');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Corner PIP in top-right"
                    >
                      <span>↗</span> Top-Right PIP
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'pip_bottom_left');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Corner PIP in bottom-left"
                    >
                      <span>↙</span> Bottom-Left PIP
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'pip_bottom_right');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Corner PIP in bottom-right"
                    >
                      <span>↘</span> Bottom-Right PIP
                    </button>
                  </div>
                </div>

                {/* 50/50 Split Screen Buttons */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>50/50 Split Screen</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'split_left_50');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Vertical split occupying left half"
                    >
                      <span>◧</span> Left 50%
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'split_right_50');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Vertical split occupying right half"
                    >
                      <span>◨</span> Right 50%
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'split_top_50');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Horizontal split occupying top half"
                    >
                      <span>⬒</span> Top 50%
                    </button>
                    <button
                      className="vnest-btn-subtle"
                      style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = applyPipPreset(selectedClip, 'split_bottom_50');
                        onUpdateClip(selectedClip.id, { transform: updated.transform });
                      }}
                      title="Horizontal split occupying bottom half"
                    >
                      <span>⬓</span> Bottom 50%
                    </button>
                  </div>
                </div>

                {/* 4-Way & Reset */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4 }}
                    onClick={() => {
                      const updated = applyPipPreset(selectedClip, 'split_four_quadrants');
                      onUpdateClip(selectedClip.id, { transform: updated.transform });
                    }}
                    title="Four-way quadrant layout (50% scale in corner quadrant)"
                  >
                    <span>⊞</span> 4-Way Quadrant
                  </button>
                  <button
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'center', gap: 4, color: 'var(--accent-sage)' }}
                    onClick={() => {
                      const updated = applyPipPreset(selectedClip, 'reset_fullscreen');
                      onUpdateClip(selectedClip.id, { transform: updated.transform });
                    }}
                    title="Reset to 100% centered full screen with no cropping"
                  >
                    <span>🗖</span> Fullscreen Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Crop Controls */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('crop')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crop style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />
                Crop Frame ({crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0 ? 'Active' : 'Off'})
              </div>
              {openSections.crop ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.crop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Top ({crop.top}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={crop.top}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            crop: { ...crop, top: parseInt(e.target.value, 10) },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Bottom ({crop.bottom}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={crop.bottom}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            crop: { ...crop, bottom: parseInt(e.target.value, 10) },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Left ({crop.left}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={crop.left}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            crop: { ...crop, left: parseInt(e.target.value, 10) },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Right ({crop.right}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={crop.right}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            crop: { ...crop, right: parseInt(e.target.value, 10) },
                          },
                        })
                      }
                    />
                  </div>
                </div>

                {(crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0) && (
                  <button
                    onClick={() =>
                      onUpdateClip(selectedClip.id, {
                        transform: { ...selectedClip.transform, crop: { top: 0, bottom: 0, left: 0, right: 0 } },
                      })
                    }
                    className="vnest-btn-subtle"
                    style={{ fontSize: 10, justifyContent: 'center', padding: '4px 8px' }}
                  >
                    Reset Crop
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Chroma Key (Green Screen / Blue Screen) */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('chroma')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-emerald)' }} />
                Chroma Key (Green Screen)
              </div>
              {openSections.chroma ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.chroma && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enable Keying</span>
                  <input
                    type="checkbox"
                    checked={chroma.enabled}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        chromaKey: { ...chroma, enabled: e.target.checked },
                      })
                    }
                    style={{ cursor: 'pointer' }}
                  />
                </div>

                {chroma.enabled && (
                  <>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() =>
                            onUpdateClip(selectedClip.id, {
                              chromaKey: { ...chroma, color: '#00FF00' },
                            })
                          }
                          className="vnest-btn-subtle"
                          style={{
                            padding: '3px 8px',
                            fontSize: 10,
                            borderColor: chroma.color.toUpperCase() === '#00FF00' ? '#00FF00' : 'var(--border-subtle)',
                            color: '#4ade80',
                          }}
                        >
                          Green Screen
                        </button>
                        <button
                          onClick={() =>
                            onUpdateClip(selectedClip.id, {
                              chromaKey: { ...chroma, color: '#0000FF' },
                            })
                          }
                          className="vnest-btn-subtle"
                          style={{
                            padding: '3px 8px',
                            fontSize: 10,
                            borderColor: chroma.color.toUpperCase() === '#0000FF' ? '#38bdf8' : 'var(--border-subtle)',
                            color: '#38bdf8',
                          }}
                        >
                          Blue Screen
                        </button>
                        <input
                          type="color"
                          value={chroma.color}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              chromaKey: { ...chroma, color: e.target.value },
                            })
                          }
                          style={{ width: 28, height: 24, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Pick custom key color"
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Similarity / Tolerance</span>
                        <span style={{ color: 'var(--text-primary)' }}>{Math.round(chroma.similarity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.80"
                        step="0.02"
                        value={chroma.similarity}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            chromaKey: { ...chroma, similarity: parseFloat(e.target.value) },
                          })
                        }
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Smoothness / Blend</span>
                        <span style={{ color: 'var(--text-primary)' }}>{Math.round(chroma.smoothness * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.40"
                        step="0.01"
                        value={chroma.smoothness}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            chromaKey: { ...chroma, smoothness: parseFloat(e.target.value) },
                          })
                        }
                      />
                    </div>

                    {/* Phase 3: Spill Suppression */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Spill Suppression (Despill)</span>
                        <span style={{ color: 'var(--text-primary)' }}>{chroma.spill ?? 40}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={chroma.spill ?? 40}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            chromaKey: { ...chroma, spill: parseInt(e.target.value, 10) },
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Advanced Masks & Matte */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('mask')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Focus style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
                Mask & Matte ({selectedClip.mask?.shape && selectedClip.mask.shape !== 'none' ? selectedClip.mask.shape.toUpperCase() : 'Off'})
              </div>
              {openSections.mask ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.mask && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Mask Shape</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {(['none', 'rectangle', 'circle', 'oval', 'linear'] as MaskShape[]).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, {
                            mask: {
                              shape,
                              positionX: selectedClip.mask?.positionX ?? 0,
                              positionY: selectedClip.mask?.positionY ?? 0,
                              scaleX: selectedClip.mask?.scaleX ?? 1.0,
                              scaleY: selectedClip.mask?.scaleY ?? 1.0,
                              feather: selectedClip.mask?.feather ?? 0,
                              inverted: selectedClip.mask?.inverted ?? false,
                              rotation: selectedClip.mask?.rotation ?? 0,
                            },
                          })
                        }
                        className="vnest-btn-subtle"
                        style={{
                          padding: '4px 6px',
                          fontSize: 10,
                          justifyContent: 'center',
                          textTransform: 'capitalize',
                          backgroundColor: (selectedClip.mask?.shape || 'none') === shape ? 'var(--selected-surface)' : 'transparent',
                          borderColor: (selectedClip.mask?.shape || 'none') === shape ? 'var(--accent-sage)' : 'var(--border-subtle)',
                          color: (selectedClip.mask?.shape || 'none') === shape ? 'var(--accent-sage)' : 'var(--text-secondary)',
                        }}
                      >
                        {shape === 'linear' ? 'Linear' : shape}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedClip.mask && selectedClip.mask.shape !== 'none' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Position X</span>
                          <span style={{ color: 'var(--text-primary)' }}>{selectedClip.mask.positionX ?? 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="-80"
                          max="80"
                          value={selectedClip.mask.positionX ?? 0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, positionX: parseInt(e.target.value, 10) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Position Y</span>
                          <span style={{ color: 'var(--text-primary)' }}>{selectedClip.mask.positionY ?? 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="-80"
                          max="80"
                          value={selectedClip.mask.positionY ?? 0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, positionY: parseInt(e.target.value, 10) },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Scale X / Width</span>
                          <span style={{ color: 'var(--text-primary)' }}>{(selectedClip.mask.scaleX ?? 1.0).toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.05"
                          value={selectedClip.mask.scaleX ?? 1.0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, scaleX: parseFloat(e.target.value) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Scale Y / Height</span>
                          <span style={{ color: 'var(--text-primary)' }}>{(selectedClip.mask.scaleY ?? 1.0).toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.05"
                          value={selectedClip.mask.scaleY ?? 1.0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, scaleY: parseFloat(e.target.value) },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Edge Feather</span>
                          <span style={{ color: 'var(--text-primary)' }}>{selectedClip.mask.feather ?? 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedClip.mask.feather ?? 0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, feather: parseInt(e.target.value, 10) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Rotation</span>
                          <span style={{ color: 'var(--text-primary)' }}>{selectedClip.mask.rotation ?? 0}°</span>
                        </div>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedClip.mask.rotation ?? 0}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, rotation: parseInt(e.target.value, 10) },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedClip.mask.inverted}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              mask: { ...selectedClip.mask!, inverted: e.target.checked },
                            })
                          }
                        />
                        Invert Mask
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, {
                            mask: { shape: 'none', positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, feather: 0, inverted: false, rotation: 0 },
                          })
                        }
                        className="vnest-btn-subtle"
                        style={{ fontSize: 9, padding: '2px 6px' }}
                      >
                        Reset Mask
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Speed & Retiming */}
        <div className="vnest-card">
          <div
            onClick={() => toggleSection('speed')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gauge style={{ width: 14, height: 14, color: 'var(--accent-yellow)' }} />
              Speed & Retiming {selectedClip.speedCurve && selectedClip.speedCurve.length >= 2 ? '(Curve)' : `(${selectedClip.speed.toFixed(1)}x)`}
            </div>
            {openSections.speed ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          </div>

          {openSections.speed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Uniform Speed Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uniform Speed</span>
                  <span style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>{selectedClip.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.1"
                  value={selectedClip.speed}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      speed: parseFloat(e.target.value),
                      speedCurve: undefined, // Clear curve when manually moving uniform slider
                    })
                  }
                />
              </div>

              {/* Phase 3: Speed Curve Interactive Visual Graph */}
              {selectedClip.speedCurve && selectedClip.speedCurve.length >= 2 && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 8, background: 'rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6 }}>
                    <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>Active Speed Curve Graph</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateClip(selectedClip.id, {
                          speedCurve: undefined,
                        })
                      }
                      className="vnest-btn-subtle"
                      style={{ fontSize: 9, padding: '1px 5px' }}
                    >
                      Reset to Uniform
                    </button>
                  </div>

                  <svg viewBox="0 0 200 80" style={{ width: '100%', height: 70, overflow: 'visible' }}>
                    {/* Background grid */}
                    <line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                    <text x="4" y="38" fill="rgba(255,255,255,0.4)" fontSize="8">1.0x</text>

                    {/* Speed curve polyline */}
                    <polyline
                      fill="none"
                      stroke="var(--accent-yellow)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={selectedClip.speedCurve
                        .map((pt) => {
                          const px = Math.round(pt.x * 200);
                          // Speed range 0.1x to 4.0x mapped to 75 to 5
                          const py = Math.round(75 - ((pt.y - 0.1) / 3.9) * 70);
                          return `${px},${py}`;
                        })
                        .join(' ')}
                    />

                    {/* Keyframe control points */}
                    {selectedClip.speedCurve.map((pt, idx) => {
                      const cx = Math.round(pt.x * 200);
                      const cy = Math.round(75 - ((pt.y - 0.1) / 3.9) * 70);
                      return (
                        <g key={idx}>
                          <circle cx={cx} cy={cy} r="4" fill="#ffffff" stroke="var(--accent-yellow)" strokeWidth="1.5" />
                          <text x={Math.min(180, Math.max(10, cx))} y={Math.max(12, cy - 6)} fill="#facc15" fontSize="8" textAnchor="middle">
                            {pt.y.toFixed(1)}x
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* Speed Curve Presets */}
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Speed Curve Presets</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {SPEED_CURVE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() =>
                        onUpdateClip(selectedClip.id, {
                          speedCurve: preset.points,
                          speedCurvePreset: preset.id,
                        })
                      }
                      className="vnest-btn-subtle"
                      style={{
                        padding: '6px 8px',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        backgroundColor: selectedClip.speedCurvePreset === preset.id ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                        borderColor: selectedClip.speedCurvePreset === preset.id ? 'var(--accent-yellow)' : 'var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{preset.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'left' }}>
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Timing & Pitch Controls */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedClip.pitchCorrection !== false}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        pitchCorrection: e.target.checked,
                      })
                    }
                  />
                  Preserve Audio Pitch (atempo)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!selectedClip.muteAudioOnSpeed}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        muteAudioOnSpeed: e.target.checked,
                      })
                    }
                  />
                  Mute Audio on Speed Changes
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 6. Audio & Volume (if video or audio) */}
        {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('audio')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Volume2 style={{ width: 14, height: 14, color: 'var(--accent-emerald)' }} />
                Audio & Volume
              </div>
              {openSections.audio ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.audio && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Volume</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{Math.round(selectedClip.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={selectedClip.volume}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        volume: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fade In ({(selectedClip.fadeInMs / 1000).toFixed(1)}s)</label>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="100"
                      value={selectedClip.fadeInMs}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          fadeInMs: parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fade Out ({(selectedClip.fadeOutMs / 1000).toFixed(1)}s)</label>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="100"
                      value={selectedClip.fadeOutMs}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          fadeOutMs: parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </div>
                </div>

                {selectedClip.type === 'video' && onExtractAudio && (
                  <button
                    onClick={() => onExtractAudio(selectedClip.id)}
                    className="vnest-btn-subtle"
                    style={{
                      justifyContent: 'center',
                      fontSize: 11,
                      padding: '6px 10px',
                      color: 'var(--accent-emerald)',
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    }}
                    title="Separate audio stream into an independent timeline track"
                  >
                    <Music size={13} />
                    <span>Extract Audio to Track</span>
                  </button>
                )}

                {/* Professional Audio Tools: 3-Band EQ, Noise Reduction, Normalization, Ducking, Limiter */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 4 }}>
                  <AudioProcessingEditor
                    settings={selectedClip.audioProcessing}
                    onChange={(ap) => onUpdateClip(selectedClip.id, { audioProcessing: ap })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Color Grading & Look Presets */}
        <div className="vnest-card">
          <div
            onClick={() => toggleSection('color')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Palette style={{ width: 14, height: 14, color: 'var(--accent-purple)' }} />
              Color Grading & Looks ({colors.presetName || 'Custom'})
            </div>
            {openSections.color ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          </div>

          {openSections.color && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              {/* Before / After Comparison & Reset */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: colors.bypassed ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={!!colors.bypassed}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, bypassed: e.target.checked },
                      })
                    }
                  />
                  <span>Bypass Grading (Before / After)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(selectedClip.id, {
                      colorAdjustments: getDefaultGradingAdjustments(),
                    })
                  }
                  className="vnest-btn-subtle"
                  style={{ fontSize: 10, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Reset all color parameters to default"
                >
                  <RefreshCw size={10} />
                  <span>Reset All</span>
                </button>
              </div>

              {/* 3D LUT Support (.cube import and presets) */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 8, background: 'var(--bg-surface-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>3D LUT (.cube)</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const native = (window as any).vnestNative;
                        if (native?.selectCubeLutFile) {
                          const res = await native.selectCubeLutFile();
                          if (res && res.filePath && res.content) {
                            const parsed = parseCubeLut(res.content);
                            onUpdateClip(selectedClip.id, {
                              colorAdjustments: {
                                ...colors,
                                lut: {
                                  name: parsed.title || res.fileName || 'Imported LUT',
                                  filePath: res.filePath,
                                  cubeData: res.content,
                                  enabled: true,
                                  intensity: 100,
                                },
                                presetName: parsed.title || res.fileName || 'Custom LUT',
                              },
                            });
                          }
                        } else {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.cube';
                          input.onchange = async () => {
                            const file = input.files?.[0];
                            if (file) {
                              const text = await file.text();
                              const parsed = parseCubeLut(text);
                              onUpdateClip(selectedClip.id, {
                                colorAdjustments: {
                                  ...colors,
                                  lut: {
                                    name: parsed.title || file.name,
                                    cubeData: text,
                                    enabled: true,
                                    intensity: 100,
                                  },
                                  presetName: parsed.title || file.name || 'Custom LUT',
                                },
                              });
                            }
                          };
                          input.click();
                        }
                      } catch (err) {
                        console.error('LUT load error:', err);
                      }
                    }}
                    className="vnest-btn-subtle"
                    style={{ padding: '2px 6px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-sage)' }}
                    title="Import external .cube 3D LUT file"
                  >
                    <Upload size={10} />
                    <span>Import .cube</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select
                    value={colors.lut?.preset || (colors.lut?.filePath || colors.lut?.cubeData ? 'custom' : 'none')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'none') {
                        onUpdateClip(selectedClip.id, {
                          colorAdjustments: { ...colors, lut: undefined },
                        });
                      } else if (val !== 'custom') {
                        const preset = BUILTIN_LUT_PRESETS.find((p) => p.id === val);
                        if (preset) {
                          onUpdateClip(selectedClip.id, {
                            colorAdjustments: {
                              ...colors,
                              lut: {
                                name: preset.name,
                                preset: preset.id,
                                enabled: true,
                                intensity: 100,
                              },
                              presetName: preset.name,
                            },
                          });
                        }
                      }
                    }}
                    style={{ width: '100%', fontSize: 11 }}
                  >
                    <option value="none">No 3D LUT</option>
                    {BUILTIN_LUT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                    {colors.lut && !colors.lut.preset && (colors.lut.filePath || colors.lut.cubeData) && (
                      <option value="custom">Custom: {colors.lut.name}</option>
                    )}
                  </select>

                  {colors.lut && colors.lut.enabled && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span>LUT Intensity</span>
                        <span>{colors.lut.intensity ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={colors.lut.intensity ?? 100}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            colorAdjustments: {
                              ...colors,
                              lut: {
                                ...colors.lut!,
                                intensity: parseInt(e.target.value, 10),
                              },
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3-Way Color Wheels (Lift, Gamma, Gain) */}
              <ColorWheelsEditor
                wheels={colors.colorWheels || getDefaultColorWheels()}
                onChange={(newWheels) =>
                  onUpdateClip(selectedClip.id, {
                    colorAdjustments: {
                      ...colors,
                      colorWheels: newWheels,
                      presetName: 'Custom',
                    },
                  })
                }
              />
              {/* Preset Selector */}
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Cinematic Look Presets</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                  {LOOK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() =>
                        onUpdateClip(selectedClip.id, {
                          colorAdjustments: { ...preset.adjustments },
                        })
                      }
                      className="vnest-btn-subtle"
                      style={{
                        padding: '4px 6px',
                        fontSize: 10,
                        justifyContent: 'center',
                        backgroundColor: colors.presetName === preset.name ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                        borderColor: colors.presetName === preset.name ? 'var(--accent-purple)' : 'var(--border-subtle)',
                        color: colors.presetName === preset.name ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exposure */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Exposure</span>
                  <span style={{ color: 'var(--text-primary)' }}>{colors.exposure ?? 0}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={colors.exposure ?? 0}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      colorAdjustments: { ...colors, exposure: parseInt(e.target.value, 10), presetName: 'Custom' },
                    })
                  }
                />
              </div>

              {/* Brightness */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Brightness</span>
                  <span style={{ color: 'var(--text-primary)' }}>{colors.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={colors.brightness}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      colorAdjustments: { ...colors, brightness: parseInt(e.target.value, 10), presetName: 'Custom' },
                    })
                  }
                />
              </div>

              {/* Contrast */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Contrast</span>
                  <span style={{ color: 'var(--text-primary)' }}>{colors.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={colors.contrast}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      colorAdjustments: { ...colors, contrast: parseInt(e.target.value, 10), presetName: 'Custom' },
                    })
                  }
                />
              </div>

              {/* Saturation */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Saturation</span>
                  <span style={{ color: 'var(--text-primary)' }}>{colors.saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={colors.saturation}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      colorAdjustments: { ...colors, saturation: parseInt(e.target.value, 10), presetName: 'Custom' },
                    })
                  }
                />
              </div>

              {/* Temperature & Tint */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Temperature</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.temperature ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={colors.temperature ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, temperature: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tint</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.tint ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={colors.tint ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, tint: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
              </div>

              {/* Highlights & Shadows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Highlights</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.highlights ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={colors.highlights ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, highlights: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Shadows</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.shadows ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={colors.shadows ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, shadows: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
              </div>

              {/* Gamma & Fade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Gamma</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.gamma ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={colors.gamma ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, gamma: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Fade (Lifted)</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.fade ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={colors.fade ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, fade: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
              </div>

              {/* Vignette & Sharpen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Vignette</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.vignette ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={colors.vignette ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, vignette: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Sharpen</span>
                    <span style={{ color: 'var(--text-primary)' }}>{colors.sharpen ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={colors.sharpen ?? 0}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        colorAdjustments: { ...colors, sharpen: parseInt(e.target.value, 10), presetName: 'Custom' },
                      })
                    }
                  />
                </div>
              </div>

              {/* Reset Controls Button */}
              <button
                type="button"
                onClick={() =>
                  onUpdateClip(selectedClip.id, {
                    colorAdjustments: getDefaultGradingAdjustments(),
                  })
                }
                className="vnest-btn-subtle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  fontSize: 11,
                  marginTop: 4,
                  color: 'var(--text-secondary)',
                }}
              >
                <RefreshCw size={12} />
                <span>Reset Color Controls</span>
              </button>
            </div>
          )}
        </div>

        {/* Phase 2: Transitions */}
        <div className="vnest-card">
          <div
            onClick={() => toggleSection('transition')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />
              Transition {selectedClip.transition ? `(${selectedClip.transition.type})` : ''}
            </div>
            {openSections.transition ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          </div>

          {openSections.transition && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedClip.transition ? (
                <>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Transition Type
                    </label>
                    <select
                      value={selectedClip.transition.type}
                      onChange={(e) => {
                        const newType = e.target.value as TransitionType;
                        onUpdateClip(selectedClip.id, {
                          transition: createTransition(newType, selectedClip.transition?.durationMs),
                        });
                      }}
                      style={{ width: '100%' }}
                    >
                      {TRANSITION_PRESETS.map((tp) => (
                        <option key={tp.type} value={tp.type}>
                          {tp.name} ({tp.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration</span>
                      <span style={{ color: 'var(--text-primary)' }}>{(selectedClip.transition.durationMs / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min="200"
                      max="2000"
                      step="50"
                      value={selectedClip.transition.durationMs}
                      onChange={(e) => {
                        const durationMs = parseInt(e.target.value, 10);
                        const clamped = clampTransitionDuration(durationMs, selectedClip.durationMs);
                        onUpdateClip(selectedClip.id, {
                          transition: {
                            ...selectedClip.transition!,
                            durationMs: clamped,
                          },
                        });
                      }}
                    />
                  </div>

                  {selectedClip.transition.direction && (
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                        Direction
                      </label>
                      <select
                        value={selectedClip.transition.direction}
                        onChange={(e) => {
                          onUpdateClip(selectedClip.id, {
                            transition: {
                              ...selectedClip.transition!,
                              direction: e.target.value as any,
                            },
                          });
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="in">Zoom In</option>
                        <option value="out">Zoom Out</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => onUpdateClip(selectedClip.id, { transition: undefined })}
                    className="vnest-btn-subtle"
                    style={{ color: 'var(--accent-rose)', width: '100%', justifyContent: 'center', marginTop: 4 }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} /> Remove Transition
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    No transition attached to clip entrance
                  </p>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onUpdateClip(selectedClip.id, {
                          transition: createTransition(e.target.value as TransitionType),
                        });
                      }
                    }}
                    style={{ width: '100%', fontSize: 11 }}
                  >
                    <option value="" disabled>+ Add Transition to Clip...</option>
                    {TRANSITION_PRESETS.map((tp) => (
                      <option key={tp.type} value={tp.type}>
                        {tp.name} ({tp.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phase 2: Video Effects & VFX */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image' || selectedClip.type === 'element') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('effects')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 style={{ width: 14, height: 14, color: 'var(--accent-amber)' }} />
                Effects & VFX ({selectedClip.effects?.length || 0})
              </div>
              {openSections.effects ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.effects && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                    Add Visual Effect
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const eff = createEffect(e.target.value as any);
                      const current = selectedClip.effects || [];
                      onUpdateClip(selectedClip.id, {
                        effects: [...current, eff],
                      });
                      e.target.value = '';
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="" disabled>+ Select effect to add...</option>
                    {EFFECT_PRESETS.map((ep) => (
                      <option key={ep.type} value={ep.type}>
                        {ep.name} ({ep.category})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClip.effects && selectedClip.effects.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {selectedClip.effects.map((eff) => (
                      <div
                        key={eff.id}
                        style={{
                          padding: 8,
                          background: 'var(--bg-surface-3)',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => {
                                const updated = (selectedClip.effects || []).map((e) =>
                                  e.id === eff.id ? { ...e, enabled: !e.enabled } : e
                                );
                                onUpdateClip(selectedClip.id, { effects: updated });
                              }}
                              style={{ color: eff.enabled ? 'var(--accent-sage)' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                              title={eff.enabled ? 'Disable effect' : 'Enable effect'}
                            >
                              {eff.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                            <span style={{ fontSize: 11, fontWeight: 600, color: eff.enabled ? '#ffffff' : 'var(--text-muted)' }}>
                              {eff.name}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = (selectedClip.effects || []).filter((e) => e.id !== eff.id);
                              onUpdateClip(selectedClip.id, { effects: updated });
                            }}
                            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
                            title="Delete effect"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                            <span>Intensity</span>
                            <span>{eff.intensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={eff.intensity}
                            disabled={!eff.enabled}
                            onChange={(e) => {
                              const intensity = parseInt(e.target.value, 10);
                              const updated = (selectedClip.effects || []).map((item) =>
                                item.id === eff.id ? { ...item, intensity } : item
                              );
                              onUpdateClip(selectedClip.id, { effects: updated });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Overlay & Blend Modes */}
        {(selectedClip.type === 'overlay' || selectedClip.overlayProperties || selectedClip.trackId.includes('overlay')) && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('overlay')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
                Overlay Blending & Mode
              </div>
              {openSections.overlay ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.overlay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                    Blend Mode
                  </label>
                  <select
                    value={selectedClip.overlayProperties?.blendMode || selectedClip.transform.blendMode || 'normal'}
                    onChange={(e) => {
                      const mode = e.target.value as BlendMode;
                      onUpdateClip(selectedClip.id, {
                        transform: {
                          ...selectedClip.transform,
                          blendMode: mode,
                        },
                        overlayProperties: selectedClip.overlayProperties
                          ? { ...selectedClip.overlayProperties, blendMode: mode }
                          : undefined,
                      });
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="normal">Normal (Default Alpha)</option>
                    <option value="screen">Screen (Light Leaks & Flares)</option>
                    <option value="multiply">Multiply (Film Grain & Shadows)</option>
                    <option value="overlay">Overlay (Color & Texture)</option>
                    <option value="lighten">Lighten (Highlights)</option>
                    <option value="color-dodge">Color Dodge (Intense Glow)</option>
                    <option value="soft-light">Soft Light (Subtle Ambient)</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Layer Opacity</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {Math.round((selectedClip.overlayProperties?.opacity ?? selectedClip.transform.opacity ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((selectedClip.overlayProperties?.opacity ?? selectedClip.transform.opacity ?? 1.0) * 100)}
                    onChange={(e) => {
                      const op = parseInt(e.target.value, 10) / 100;
                      onUpdateClip(selectedClip.id, {
                        transform: {
                          ...selectedClip.transform,
                          opacity: op,
                        },
                        overlayProperties: selectedClip.overlayProperties
                          ? { ...selectedClip.overlayProperties, opacity: op }
                          : undefined,
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. Keyframes */}
        <div className="vnest-card">
          <div
            onClick={() => toggleSection('keyframes')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Diamond style={{ width: 14, height: 14, color: 'var(--accent-rose)' }} />
              Keyframes ({selectedClip.keyframes.length})
            </div>
            {openSections.keyframes ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          </div>

          {openSections.keyframes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                disabled={!isPlayheadOverClip}
                onClick={() => onAddKeyframe(selectedClip.id, clipOffsetMs)}
                className="vnest-btn-subtle"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Add Keyframe at Playhead
              </button>

              {selectedClip.keyframes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, maxHeight: 120, overflowY: 'auto' }}>
                  {selectedClip.keyframes.map((kf, i) => (
                    <div
                      key={kf.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        background: 'var(--bg-surface-3)',
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Diamond style={{ width: 12, height: 12, color: 'var(--accent-rose)', fill: 'var(--accent-rose)' }} />
                        <span>KF #{i + 1}</span>
                        <span className="font-mono-time" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          +{(kf.offsetMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteKeyframe(selectedClip.id, kf.id)}
                        style={{ color: 'var(--text-muted)', padding: 2 }}
                        title="Delete keyframe"
                      >
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 9. Watermark Remover (Phase 4) */}
        {(selectedClip.type === 'video' || selectedClip.type === 'overlay' || selectedClip.type === 'image') && (
          <div className="vnest-card">
            <div
              onClick={() => toggleSection('watermark')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crop style={{ width: 14, height: 14, color: 'var(--accent-rose)' }} />
                Watermark Remover
                {selectedClip.watermarkRemover?.enabled && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)' }}>
                    ACTIVE
                  </span>
                )}
              </div>
              {openSections.watermark ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            </div>

            {openSections.watermark && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Enable Watermark Filter</span>
                  <input
                    type="checkbox"
                    checked={!!selectedClip.watermarkRemover?.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      onUpdateClip(selectedClip.id, {
                        watermarkRemover: enabled
                          ? (selectedClip.watermarkRemover || { ...DEFAULT_WATERMARK_SETTINGS, userConfirmed: true })
                          : (selectedClip.watermarkRemover ? { ...selectedClip.watermarkRemover, enabled: false } : undefined),
                      });
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </div>

                {selectedClip.watermarkRemover?.enabled && (
                  <>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 4 }}>
                        Removal Method
                      </label>
                      <select
                        value={selectedClip.watermarkRemover.method || 'delogo'}
                        onChange={(e) => {
                          const m = e.target.value as any;
                          onUpdateClip(selectedClip.id, {
                            watermarkRemover: { ...selectedClip.watermarkRemover!, method: m },
                          });
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="delogo">Delogo (Inpaint Edge Interpolation)</option>
                        <option value="blur">Gaussian Blur</option>
                        <option value="pixelate">Pixelate (Mosaic)</option>
                        <option value="crop">Crop / Reframe Out</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 4 }}>
                        Location Presets
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {WATERMARK_CORNER_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              onUpdateClip(selectedClip.id, {
                                watermarkRemover: {
                                  ...selectedClip.watermarkRemover!,
                                  positionX: p.positionX,
                                  positionY: p.positionY,
                                  width: p.width,
                                  height: p.height,
                                },
                              });
                            }}
                            className="vnest-btn-subtle"
                            style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                          >
                            {p.name.split(' (')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Pos X</span>
                          <span className="font-mono-time">{selectedClip.watermarkRemover.positionX}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="95"
                          value={selectedClip.watermarkRemover.positionX}
                          onChange={(e) => {
                            onUpdateClip(selectedClip.id, {
                              watermarkRemover: {
                                ...selectedClip.watermarkRemover!,
                                positionX: parseInt(e.target.value, 10),
                              },
                            });
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Pos Y</span>
                          <span className="font-mono-time">{selectedClip.watermarkRemover.positionY}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="95"
                          value={selectedClip.watermarkRemover.positionY}
                          onChange={(e) => {
                            onUpdateClip(selectedClip.id, {
                              watermarkRemover: {
                                ...selectedClip.watermarkRemover!,
                                positionY: parseInt(e.target.value, 10),
                              },
                            });
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Width</span>
                          <span className="font-mono-time">{selectedClip.watermarkRemover.width}%</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="60"
                          value={selectedClip.watermarkRemover.width}
                          onChange={(e) => {
                            onUpdateClip(selectedClip.id, {
                              watermarkRemover: {
                                ...selectedClip.watermarkRemover!,
                                width: parseInt(e.target.value, 10),
                              },
                            });
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Height</span>
                          <span className="font-mono-time">{selectedClip.watermarkRemover.height}%</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="40"
                          value={selectedClip.watermarkRemover.height}
                          onChange={(e) => {
                            onUpdateClip(selectedClip.id, {
                              watermarkRemover: {
                                ...selectedClip.watermarkRemover!,
                                height: parseInt(e.target.value, 10),
                              },
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Feather Band</span>
                        <span className="font-mono-time">{selectedClip.watermarkRemover.feather}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={selectedClip.watermarkRemover.feather}
                        onChange={(e) => {
                          onUpdateClip(selectedClip.id, {
                            watermarkRemover: {
                              ...selectedClip.watermarkRemover!,
                              feather: parseInt(e.target.value, 10),
                            },
                          });
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
