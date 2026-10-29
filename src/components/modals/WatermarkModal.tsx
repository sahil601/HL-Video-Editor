import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Check,
  RotateCcw,
  Sliders,
  Crop,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Project,
  Clip,
  WatermarkRemoverSettings,
  WatermarkMethod,
} from '../../types/project';
import { formatTimecode } from '../../core/time';
import {
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_CORNER_PRESETS,
  detectWatermarkCornerCandidate,
} from '../../core/watermark';

interface WatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  selectedClip: Clip | null;
  onUpdateClipWatermark: (clipId: string, settings: WatermarkRemoverSettings | undefined) => void;
  onUpdateProjectWatermark?: (settings: WatermarkRemoverSettings | undefined) => void;
}

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  isOpen,
  onClose,
  project,
  selectedClip,
  onUpdateClipWatermark,
  onUpdateProjectWatermark,
}) => {
  if (!isOpen) return null;

  // Active settings: clip-level if selected, or project-level
  const initialSettings: WatermarkRemoverSettings =
    selectedClip?.watermarkRemover ||
    project.watermarkRemover || {
      ...DEFAULT_WATERMARK_SETTINGS,
      startMs: 0,
      endMs: selectedClip ? selectedClip.durationMs : project.durationMs,
    };

  const [settings, setSettings] = useState<WatermarkRemoverSettings>(initialSettings);
  const [scope, setScope] = useState<'clip' | 'project'>(selectedClip ? 'clip' : 'project');
  const [userAcknowledgedNotice, setUserAcknowledgedNotice] = useState(settings.userConfirmed || false);
  const [detectedCandidateNotice, setDetectedCandidateNotice] = useState<string | null>(null);

  // Method options
  const methods: { id: WatermarkMethod; name: string; description: string }[] = [
    { id: 'delogo', name: 'Delogo (Inpaint)', description: 'FFmpeg edge pixel inpainting interpolation' },
    { id: 'blur', name: 'Gaussian Blur', description: 'Smooth Gaussian blurring with feathered edges' },
    { id: 'pixelate', name: 'Pixelate (Mosaic)', description: 'Downscale-upscale pixel mosaic sampling' },
    { id: 'crop', name: 'Crop / Reframe', description: 'Edge crop reframe past the watermark zone' },
  ];

  const handleApplyPreset = (preset: typeof WATERMARK_CORNER_PRESETS[0]) => {
    setSettings((prev) => ({
      ...prev,
      positionX: preset.positionX,
      positionY: preset.positionY,
      width: preset.width,
      height: preset.height,
    }));
  };

  const handleDetectCandidate = async () => {
    try {
      if (window.vnestNative) {
        const res = await window.vnestNative.detectWatermarkCandidate('');
        if (res.success && res.candidate) {
          setSettings((prev) => ({
            ...prev,
            positionX: res.candidate!.positionX,
            positionY: res.candidate!.positionY,
            width: res.candidate!.width,
            height: res.candidate!.height,
            detectedCandidate: true,
          }));
          setDetectedCandidateNotice(
            `Candidate logo badge found in ${res.candidate.corner} corner with ${(res.candidate.confidence * 100).toFixed(0)}% confidence. Please review the highlighted box.`
          );
          return;
        }
      }

      // Mathematical corner fallback
      const candidateInfo = detectWatermarkCornerCandidate(project.settings.width, project.settings.height);
      setSettings((prev) => ({
        ...prev,
        positionX: candidateInfo.candidate.positionX,
        positionY: candidateInfo.candidate.positionY,
        width: candidateInfo.candidate.width,
        height: candidateInfo.candidate.height,
        detectedCandidate: true,
      }));
      setDetectedCandidateNotice(candidateInfo.description);
    } catch {
      // Fallback preset
      handleApplyPreset(WATERMARK_CORNER_PRESETS[0]);
    }
  };

  const handleAddTrackingKeyframe = () => {
    const kfs = settings.trackingKeyframes || [];
    const newKf = {
      offsetMs: kfs.length > 0 ? kfs[kfs.length - 1].offsetMs + 1000 : 0,
      positionX: settings.positionX,
      positionY: settings.positionY,
      width: settings.width,
      height: settings.height,
      confidence: 0.92,
    };
    setSettings((prev) => ({
      ...prev,
      trackingKeyframes: [...kfs, newKf].sort((a, b) => a.offsetMs - b.offsetMs),
    }));
  };

  const handleRemoveTrackingKeyframe = (index: number) => {
    const kfs = settings.trackingKeyframes || [];
    setSettings((prev) => ({
      ...prev,
      trackingKeyframes: kfs.filter((_, idx) => idx !== index),
    }));
  };

  const handleSave = () => {
    const finalSettings: WatermarkRemoverSettings = {
      ...settings,
      userConfirmed: true,
    };

    if (scope === 'clip' && selectedClip) {
      onUpdateClipWatermark(selectedClip.id, finalSettings);
    } else if (onUpdateProjectWatermark) {
      onUpdateProjectWatermark(finalSettings);
    }
    onClose();
  };

  const handleReset = () => {
    if (scope === 'clip' && selectedClip) {
      onUpdateClipWatermark(selectedClip.id, undefined);
    } else if (onUpdateProjectWatermark) {
      onUpdateProjectWatermark(undefined);
    }
    onClose();
  };

  const isOval = settings.shape === 'oval';
  const borderRadius = isOval ? '50%' : `${settings.feather}px`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="vnest-card"
        style={{
          width: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          backgroundColor: '#0f1117',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crop size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Watermark & Region Remover</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Delogo inpainting, Gaussian blur, and mosaic masking for authorized user media
              </p>
            </div>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Legal & Authorization Notice Warning */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: 'rgba(120, 53, 15, 0.25)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: 11,
            color: '#fde68a',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          <ShieldAlert size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Authorized Media Notice:</strong> This tool is designed strictly for media you own or have permission to edit (e.g. personal broadcast logs, watermark restyling, or timestamp removal).
            <div style={{ marginTop: 3, opacity: 0.9 }}>
              <em>Quality notice:</em> Removal uses edge interpolation or blurring. Minor visual softness or artifacts may be visible on high-motion backgrounds or large marks.
            </div>
          </div>
        </div>

        {/* Scope Toggle: Selected Clip vs Entire Project Canvas */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {selectedClip && (
            <button
              onClick={() => setScope('clip')}
              className="vnest-btn-subtle"
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: 12,
                backgroundColor: scope === 'clip' ? 'var(--selected-surface)' : 'transparent',
                borderColor: scope === 'clip' ? 'var(--accent-sage)' : 'var(--border-subtle)',
                color: scope === 'clip' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                fontWeight: scope === 'clip' ? 600 : 400,
              }}
            >
              Apply to Selected Clip ({selectedClip.name})
            </button>
          )}
          <button
            onClick={() => setScope('project')}
            className="vnest-btn-subtle"
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: 12,
              backgroundColor: scope === 'project' ? 'var(--selected-surface)' : 'transparent',
              borderColor: scope === 'project' ? 'var(--accent-sage)' : 'var(--border-subtle)',
              color: scope === 'project' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              fontWeight: scope === 'project' ? 600 : 400,
            }}
          >
            Apply to Entire Canvas / Export
          </button>
        </div>

        {/* Scrollable Configuration Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
          {/* Quick Corner Presets & Auto Candidate Detection */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Watermark Location Presets
              </label>
              <button
                onClick={handleDetectCandidate}
                className="vnest-btn-subtle"
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--accent-sage)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Sparkles size={12} /> Auto-Detect Candidate
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {WATERMARK_CORNER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="vnest-btn-subtle"
                  style={{
                    padding: '6px 4px',
                    fontSize: 11,
                    textAlign: 'center',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {preset.name.split(' (')[0]}
                </button>
              ))}
            </div>

            {detectedCandidateNotice && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent-sage)',
                  marginTop: 6,
                  padding: '4px 8px',
                  borderRadius: 4,
                  backgroundColor: 'var(--accent-sage-subtle)',
                }}
              >
                {detectedCandidateNotice}
              </div>
            )}
          </div>

          {/* Interactive Bounding Box Visualization Preview */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Region Mask Preview
            </label>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                backgroundColor: '#000000',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 50%, #0f172a 100%)',
              }}
            >
              {/* Simulated frame content */}
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', pointerEvents: 'none' }}>
                <div>HL Video Canvas ({project.settings.width}x{project.settings.height})</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>Simulated frame preview</div>
              </div>

              {/* Watermark Region Highlight Box */}
              <div
                style={{
                  position: 'absolute',
                  left: `${settings.positionX}%`,
                  top: `${settings.positionY}%`,
                  width: `${settings.width}%`,
                  height: `${settings.height}%`,
                  borderRadius,
                  border: '2px dashed var(--accent-rose)',
                  boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    settings.method === 'delogo'
                      ? 'var(--accent-sage-subtle)'
                      : settings.method === 'blur'
                      ? 'rgba(127, 167, 163, 0.25)'
                      : settings.method === 'pixelate'
                      ? 'rgba(197, 180, 123, 0.25)'
                      : 'rgba(0, 0, 0, 0.6)',
                  backdropFilter:
                    settings.method === 'blur'
                      ? 'blur(8px)'
                      : settings.method === 'delogo'
                      ? 'blur(4px)'
                      : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#ffffff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    textTransform: 'uppercase',
                  }}
                >
                  {settings.method}
                </span>
              </div>
            </div>
          </div>

          {/* Mask Shape & Processing Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 16 }}>
            {/* Shape selection */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Mask Shape
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSettings({ ...settings, shape: 'rectangle' })}
                  className="vnest-btn-subtle"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: 12,
                    backgroundColor: settings.shape === 'rectangle' ? 'var(--selected-surface)' : 'transparent',
                    borderColor: settings.shape === 'rectangle' ? 'var(--accent-sage)' : 'var(--border-subtle)',
                    color: settings.shape === 'rectangle' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                  }}
                >
                  Rectangle
                </button>
                <button
                  onClick={() => setSettings({ ...settings, shape: 'oval' })}
                  className="vnest-btn-subtle"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: 12,
                    backgroundColor: settings.shape === 'oval' ? 'var(--selected-surface)' : 'transparent',
                    borderColor: settings.shape === 'oval' ? 'var(--accent-sage)' : 'var(--border-subtle)',
                    color: settings.shape === 'oval' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                  }}
                >
                  Oval / Circle
                </button>
              </div>
            </div>

            {/* Method selection */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Processing Method
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSettings({ ...settings, method: m.id })}
                    className="vnest-btn-subtle"
                    title={m.description}
                    style={{
                      padding: '8px 6px',
                      fontSize: 11,
                      textAlign: 'center',
                      backgroundColor: settings.method === m.id ? 'var(--selected-surface)' : 'transparent',
                      borderColor: settings.method === m.id ? 'var(--accent-sage)' : 'var(--border-subtle)',
                      color: settings.method === m.id ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      fontWeight: settings.method === m.id ? 600 : 400,
                    }}
                  >
                    {m.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Geometry Adjustments: Position X, Position Y, Width, Height */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="vnest-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Position X</span>
                <span className="font-mono-time">{settings.positionX}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="95"
                step="1"
                value={settings.positionX}
                onChange={(e) => setSettings({ ...settings, positionX: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="vnest-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Position Y</span>
                <span className="font-mono-time">{settings.positionY}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="95"
                step="1"
                value={settings.positionY}
                onChange={(e) => setSettings({ ...settings, positionY: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="vnest-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Width</span>
                <span className="font-mono-time">{settings.width}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="60"
                step="1"
                value={settings.width}
                onChange={(e) => setSettings({ ...settings, width: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="vnest-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Height</span>
                <span className="font-mono-time">{settings.height}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="40"
                step="1"
                value={settings.height}
                onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Feather & Method-specific parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="vnest-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Edge Feather Band</span>
                <span className="font-mono-time">{settings.feather} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.feather}
                onChange={(e) => setSettings({ ...settings, feather: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Blends perimeter boundary smoothly with adjacent background pixels.
              </div>
            </div>

            {settings.method === 'blur' && (
              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Blur Intensity</span>
                  <span className="font-mono-time">{settings.blurIntensity || 10}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={settings.blurIntensity || 10}
                  onChange={(e) => setSettings({ ...settings, blurIntensity: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {settings.method === 'pixelate' && (
              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Pixel Block Size</span>
                  <span className="font-mono-time">{settings.pixelSize || 12} px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="32"
                  step="2"
                  value={settings.pixelSize || 12}
                  onChange={(e) => setSettings({ ...settings, pixelSize: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          {/* Optional Moving Watermark Tracking Keyframes */}
          <div className="vnest-card" style={{ padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc' }}>
                Keyframe Motion Tracking ({settings.trackingKeyframes?.length || 0} keyframes)
              </div>
              <button
                onClick={handleAddTrackingKeyframe}
                className="vnest-btn-subtle"
                style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={12} /> Add Keyframe Position
              </button>
            </div>

            {(!settings.trackingKeyframes || settings.trackingKeyframes.length === 0) ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Watermark position is static. For moving logos or animated watermarks, add keyframes to interpolate position over time.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
                {settings.trackingKeyframes.map((kf, kfIdx) => (
                  <div
                    key={kfIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 4,
                    }}
                  >
                    <span>
                      Kf #{kfIdx + 1} at {formatTimecode(kf.offsetMs, project.settings.fps)}: ({kf.positionX}%, {kf.positionY}%) • {kf.width}x{kf.height}%
                    </span>
                    <button
                      onClick={() => handleRemoveTrackingKeyframe(kfIdx)}
                      className="vnest-btn-icon"
                      style={{ padding: 2, color: 'var(--accent-rose)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Confirmation Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11, color: '#cbd5e1' }}>
            <input
              type="checkbox"
              id="watermark-auth-ack"
              checked={userAcknowledgedNotice}
              onChange={(e) => setUserAcknowledgedNotice(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="watermark-auth-ack" style={{ cursor: 'pointer' }}>
              I confirm that I own or am authorized to edit this video content.
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={handleReset}
            className="vnest-btn-subtle"
            style={{ padding: '8px 14px', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCcw size={14} />
            <span>Reset / Disable</span>
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="vnest-btn-subtle" style={{ padding: '8px 16px' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!userAcknowledgedNotice}
              className="vnest-btn-primary"
              style={{
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'var(--accent-emerald)',
                borderColor: 'var(--accent-emerald)',
                opacity: userAcknowledgedNotice ? 1 : 0.5,
              }}
            >
              <Check size={16} />
              <span>Apply Remover</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
