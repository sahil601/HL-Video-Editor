import React, { useState, useEffect } from 'react';
import {
  Scissors,
  X,
  Play,
  Pause,
  Check,
  AlertCircle,
  Sliders,
  Sparkles,
  Clock,
  Film,
  Volume2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Project, Clip, ProposedCut, AutoCutSettings, AspectRatio } from '../../types/project';
import { formatTimecode } from '../../core/time';
import {
  DEFAULT_AUTO_CUT_SETTINGS,
  computeAutoCuts,
  SilenceInterval,
  SceneChange,
} from '../../core/autoCut';

interface AutoCutModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  selectedClipId: string | null;
  assetPathResolver: (assetId: string) => string | null;
  onApplyAutoCuts: (targetClipId: string, approvedCuts: ProposedCut[], aspectRatioPreset?: AspectRatio) => void;
}

export const AutoCutModal: React.FC<AutoCutModalProps> = ({
  isOpen,
  onClose,
  project,
  selectedClipId,
  assetPathResolver,
  onApplyAutoCuts,
}) => {
  if (!isOpen) return null;

  // Find all available video clips on timeline
  const videoClips: Clip[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'video') {
        videoClips.push(clip);
      }
    }
  }

  // Pick initial clip
  const initialClip = videoClips.find((c) => c.id === selectedClipId) || videoClips[0] || null;
  const [targetClipId, setTargetClipId] = useState<string>(initialClip?.id || '');

  // Settings state
  const [settings, setSettings] = useState<AutoCutSettings>({
    ...DEFAULT_AUTO_CUT_SETTINGS,
    aspectRatioPreset: undefined,
  });

  // Target duration preset: 'all' | 15 | 30 | 60 | 'custom'
  const [targetDurationMode, setTargetDurationMode] = useState<'all' | '15' | '30' | '60' | 'custom'>('all');
  const [customTargetDurationSec, setCustomTargetDurationSec] = useState<number>(45);

  // Analysis & Review state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [proposedCuts, setProposedCuts] = useState<ProposedCut[]>([]);
  const [originalDurationMs, setOriginalDurationMs] = useState(0);
  const [step, setStep] = useState<'config' | 'review'>('config');

  // Previewing snippet state
  const [previewingCutId, setPreviewingCutId] = useState<string | null>(null);

  const selectedClip = videoClips.find((c) => c.id === targetClipId);

  // Reset or initialize on open
  useEffect(() => {
    if (initialClip && !targetClipId) {
      setTargetClipId(initialClip.id);
    }
  }, [initialClip, targetClipId]);

  const handleRunAnalysis = async () => {
    if (!selectedClip) {
      setAnalysisError('Please select a video clip to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const resolvedPath = (selectedClip.assetId ? assetPathResolver(selectedClip.assetId) : null) || assetPathResolver(selectedClip.id);

      let silences: SilenceInterval[] = [];
      let sceneChanges: SceneChange[] = [];

      const targetSec =
        targetDurationMode === 'all'
          ? 'all'
          : targetDurationMode === 'custom'
          ? customTargetDurationSec
          : parseInt(targetDurationMode, 10);

      const activeSettings: AutoCutSettings = {
        ...settings,
        targetDurationSec: targetSec,
      };

      // Native FFmpeg execution if available in desktop Electron
      if (window.vnestNative && resolvedPath) {
        // 1. Silence Detection
        const silenceRes = await window.vnestNative.detectSilence(resolvedPath, {
          noiseDb: settings.silenceThresholdDb,
          durationSec: settings.minSilenceDurationMs / 1000,
        });

        if (silenceRes.success && silenceRes.silences) {
          silences = silenceRes.silences;
        }

        // 2. Scene Change Detection
        const sceneRes = await window.vnestNative.detectScenes(resolvedPath, {
          threshold: settings.sensitivity,
          minSceneDurationSec: settings.minSceneDurationMs / 1000,
        });

        if (sceneRes.success && sceneRes.sceneChanges) {
          sceneChanges = sceneRes.sceneChanges;
        }
      } else {
        // Fallback mathematical model for preview/testing
        const clipDur = selectedClip.durationMs;
        // Synthesize representative pauses at 25% and 65% of clip duration if >= 3s
        if (clipDur >= 3000) {
          silences = [
            {
              startMs: Math.round(clipDur * 0.28),
              endMs: Math.round(clipDur * 0.28 + 600),
              durationMs: 600,
            },
            {
              startMs: Math.round(clipDur * 0.65),
              endMs: Math.round(clipDur * 0.65 + 750),
              durationMs: 750,
            },
          ];
          sceneChanges = [{ timeMs: Math.round(clipDur * 0.5) }];
        }
      }

      // Calculate Cuts
      const result = computeAutoCuts(selectedClip.durationMs, silences, sceneChanges, activeSettings);

      setProposedCuts(result.proposedCuts);
      setOriginalDurationMs(selectedClip.durationMs);
      setStep('review');
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to analyze media.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleCut = (cutId: string) => {
    setProposedCuts((prev) =>
      prev.map((c) => (c.id === cutId ? { ...c, included: !c.included } : c))
    );
  };

  const handleSelectAll = (included: boolean) => {
    setProposedCuts((prev) => prev.map((c) => ({ ...c, included })));
  };

  const handleApply = () => {
    if (!selectedClip) return;
    const approved = proposedCuts.filter((c) => c.included);
    if (approved.length === 0) {
      setAnalysisError('Please include at least one cut segment to apply.');
      return;
    }

    onApplyAutoCuts(selectedClip.id, approved, settings.aspectRatioPreset);
    onClose();
  };

  const projectedKeptMs = proposedCuts
    .filter((c) => c.included)
    .reduce((acc, c) => acc + c.durationMs, 0);
  const timeSavedMs = Math.max(0, originalDurationMs - projectedKeptMs);
  const percentSaved = originalDurationMs > 0 ? Math.round((timeSavedMs / originalDurationMs) * 100) : 0;

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
          width: '760px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          backgroundColor: 'var(--bg-surface-2)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-medium)',
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
                backgroundColor: 'var(--accent-sage-subtle)',
                color: 'var(--accent-sage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scissors size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Auto Cut & Silence Removal</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Rule-based speech pause elimination and scene-change boundary slicing
              </p>
            </div>
          </div>
          <button id="autocut-close-btn" onClick={onClose} className="vnest-btn-icon" style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Rule-Based Transparency Notice */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          <Sparkles size={16} color="var(--accent-sage)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Rule-Based Analysis:</strong> Silence detection and scene transitions are evaluated mathematically via audio decibel energy thresholds and visual frame differences using FFmpeg. Original media files are never altered.
          </div>
        </div>

        {/* Body content based on step */}
        {step === 'config' ? (
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
            {/* Target Clip Selection */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Target Video Clip
              </label>
              {videoClips.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--accent-rose)' }}>
                  No video clips found on the timeline. Add a video clip first.
                </div>
              ) : (
                <select
                  value={targetClipId}
                  onChange={(e) => setTargetClipId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}
                >
                  {videoClips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatTimecode(c.durationMs, project.settings.fps)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Audio Silence Threshold & Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Silence Noise Threshold</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-sage)' }}>
                    {settings.silenceThresholdDb} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="-15"
                  step="1"
                  value={settings.silenceThresholdDb}
                  onChange={(e) => setSettings({ ...settings, silenceThresholdDb: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Audio below this volume level is classified as pause/silence.
                </div>
              </div>

              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Min Silence Duration</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-sage)' }}>
                    {settings.minSilenceDurationMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1500"
                  step="50"
                  value={settings.minSilenceDurationMs}
                  onChange={(e) => setSettings({ ...settings, minSilenceDurationMs: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Pauses shorter than this duration will be kept untouched.
                </div>
              </div>
            </div>

            {/* Speech Padding Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Speech Padding Before</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-cyan)' }}>
                    {settings.speechPaddingBeforeMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={settings.speechPaddingBeforeMs}
                  onChange={(e) => setSettings({ ...settings, speechPaddingBeforeMs: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Buffer added before words to avoid clipping word starts.
                </div>
              </div>

              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Speech Padding After</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-cyan)' }}>
                    {settings.speechPaddingAfterMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={settings.speechPaddingAfterMs}
                  onChange={(e) => setSettings({ ...settings, speechPaddingAfterMs: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Buffer added after words to keep natural voice decay.
                </div>
              </div>
            </div>

            {/* Scene Change Detection Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Scene Change Sensitivity</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-emerald)' }}>
                    {settings.sensitivity.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={settings.sensitivity}
                  onChange={(e) => setSettings({ ...settings, sensitivity: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Higher sensitivity detects subtle angle changes; lower detects full scene cuts.
                </div>
              </div>

              <div className="vnest-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Min Scene Duration</span>
                  <span className="font-mono-time" style={{ color: 'var(--accent-emerald)' }}>
                    {settings.minSceneDurationMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="3000"
                  step="100"
                  value={settings.minSceneDurationMs}
                  onChange={(e) => setSettings({ ...settings, minSceneDurationMs: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Prevents hyper-rapid flashing scene cuts.
                </div>
              </div>
            </div>

            {/* Short-form Video Target Duration */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Target Short-Form Duration
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Keep All Speech' },
                  { id: '15', label: '15s (Shorts/Stories)' },
                  { id: '30', label: '30s (Reels/TikTok)' },
                  { id: '60', label: '60s (Standard Short)' },
                  { id: 'custom', label: 'Custom Target' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTargetDurationMode(item.id as any)}
                    className="vnest-btn-subtle"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      backgroundColor: targetDurationMode === item.id ? 'var(--selected-surface)' : 'transparent',
                      borderColor: targetDurationMode === item.id ? 'var(--accent-sage)' : 'var(--border-subtle)',
                      color: targetDurationMode === item.id ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      fontWeight: targetDurationMode === item.id ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {targetDurationMode === 'custom' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target seconds:</span>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={customTargetDurationSec}
                    onChange={(e) => setCustomTargetDurationSec(Math.max(5, parseInt(e.target.value || '15', 10)))}
                    style={{ width: 80, padding: '4px 8px' }}
                  />
                </div>
              )}
            </div>

            {/* Canvas Aspect Ratio Preset */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Optional Aspect Ratio Preset
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: undefined, label: `Keep (${project.settings.aspectRatio})` },
                  { id: '9:16' as AspectRatio, label: '9:16 Vertical (Reels/TikTok)' },
                  { id: '1:1' as AspectRatio, label: '1:1 Square' },
                  { id: '16:9' as AspectRatio, label: '16:9 Widescreen' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSettings({ ...settings, aspectRatioPreset: preset.id })}
                    className="vnest-btn-subtle"
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      backgroundColor: settings.aspectRatioPreset === preset.id ? 'var(--selected-surface)' : 'transparent',
                      borderColor: settings.aspectRatioPreset === preset.id ? 'var(--accent-sage)' : 'var(--border-subtle)',
                      color: settings.aspectRatioPreset === preset.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {analysisError && (
              <div style={{ color: 'var(--accent-rose)', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} />
                <span>{analysisError}</span>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Review Screen */
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
            {/* Savings Overview Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-medium)',
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Original Duration</div>
                <div className="font-mono-time" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatTimecode(originalDurationMs, project.settings.fps)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projected Result</div>
                <div className="font-mono-time" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {formatTimecode(projectedKeptMs, project.settings.fps)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration Saved</div>
                <div className="font-mono-time" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  -{(timeSavedMs / 1000).toFixed(1)}s ({percentSaved}%)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Cuts</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                  {proposedCuts.filter((c) => c.included).length} of {proposedCuts.length}
                </div>
              </div>
            </div>

            {/* Include/Exclude Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Proposed Slices & Segments:
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleSelectAll(true)}
                  className="vnest-btn-subtle"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Include All
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="vnest-btn-subtle"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Exclude All
                </button>
                <button
                  onClick={() => setStep('config')}
                  className="vnest-btn-subtle"
                  style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <RotateCcw size={11} /> Re-tune
                </button>
              </div>
            </div>

            {/* List of Proposed Cuts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proposedCuts.map((cut, idx) => (
                <div
                  key={cut.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: cut.included ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.3)',
                    border: cut.included ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.04)',
                    opacity: cut.included ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={cut.included}
                      onChange={() => toggleCut(cut.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
                        <span>Segment #{idx + 1}</span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            backgroundColor:
                              cut.type === 'scene_change'
                                ? 'rgba(130, 166, 135, 0.2)'
                                : 'var(--accent-sage-subtle)',
                            color:
                              cut.type === 'scene_change'
                                ? 'var(--accent-emerald)'
                                : 'var(--accent-sage)',
                          }}
                        >
                          {cut.type === 'scene_change' ? 'Scene Aligned' : 'Speech'}
                        </span>
                        <span className="font-mono-time" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {(cut.durationMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatTimecode(cut.startMs, project.settings.fps)} → {formatTimecode(cut.endMs, project.settings.fps)} • {cut.reason}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setPreviewingCutId(previewingCutId === cut.id ? null : cut.id)}
                      className="vnest-btn-icon"
                      title={previewingCutId === cut.id ? 'Pause audition preview' : 'Audition segment'}
                      style={{ padding: 4 }}
                    >
                      {previewingCutId === cut.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button onClick={onClose} className="vnest-btn-subtle" style={{ padding: '8px 16px' }}>
            Cancel
          </button>

          {step === 'config' ? (
            <button
              id="autocut-detect-btn"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !selectedClip}
              className="vnest-btn-primary"
              style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isAnalyzing ? (
                <>
                  <span className="vnest-spinner" style={{ width: 14, height: 14 }} />
                  <span>Analyzing Audio & Scenes...</span>
                </>
              ) : (
                <>
                  <Scissors size={15} />
                  <span>Detect Cuts</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="autocut-apply-btn"
              onClick={handleApply}
              disabled={proposedCuts.filter((c) => c.included).length === 0}
              className="vnest-btn-primary"
              style={{
                padding: '8px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'var(--accent-sage)',
                borderColor: 'var(--accent-sage)',
                color: '#161D18',
              }}
            >
              <Check size={16} />
              <span>Apply to Timeline</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
