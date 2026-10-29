import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  FileText,
  Clock,
  Split,
  Merge,
  Trash2,
  Plus,
  Download,
  Check,
  AlertCircle,
  Play,
  RotateCcw,
  Palette,
  Type,
  FolderOpen,
  Volume2,
} from 'lucide-react';
import { Project, ProjectAsset } from '../../types/project';
import {
  CaptionSegment,
  CaptionStyle,
  DEFAULT_CAPTION_STYLE,
  TranscriptionProgress,
  TranscriptionModelId,
} from '../../core/captions/types';
import {
  formatSrtTimecode,
  parseTimecode,
  splitCaptionSegment,
  mergeCaptionSegments,
  generateSrt,
  generateVtt,
} from '../../core/captions/srtParser';
import { extractProjectCaptions } from '../../core/captions/projectCaptions';

interface AutoCaptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  assetPathResolver: (assetId: string) => string | null;
  onApplyCaptions: (segments: CaptionSegment[], style: CaptionStyle) => void;
}

export const AutoCaptionsModal: React.FC<AutoCaptionsModalProps> = ({
  isOpen,
  onClose,
  project,
  assetPathResolver,
  onApplyCaptions,
}) => {
  if (!isOpen) return null;

  // View state: 'select' -> 'transcribing' -> 'editor'
  const existingCaptions = extractProjectCaptions(project);
  const [currentStep, setCurrentStep] = useState<'select' | 'transcribing' | 'editor'>(
    existingCaptions.length > 0 ? 'editor' : 'select'
  );

  // Source selection
  const [sourceType, setSourceType] = useState<'project' | 'asset' | 'file'>('project');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    project.assets.find((a) => a.type === 'video' || a.type === 'audio')?.id || ''
  );
  const [customFilePath, setCustomFilePath] = useState<string>('');

  // Transcription options
  const [language, setLanguage] = useState<string>('auto');
  const [model, setModel] = useState<TranscriptionModelId>('Xenova/whisper-tiny.en');
  const [wordTimestamps, setWordTimestamps] = useState<boolean>(true);

  // Live progress
  const [progress, setProgress] = useState<TranscriptionProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transcript editing
  const [segments, setSegments] = useState<CaptionSegment[]>(existingCaptions);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');

  // Listen to Electron transcription progress
  useEffect(() => {
    if (window.vnestNative?.onTranscriptionProgress) {
      const cleanup = window.vnestNative.onTranscriptionProgress((prog) => {
        setProgress(prog);
      });
      return cleanup;
    }
  }, []);

  const handleSelectLocalFile = async () => {
    if (window.vnestNative?.selectMediaFiles) {
      const files = await window.vnestNative.selectMediaFiles();
      if (files && files.length > 0) {
        setCustomFilePath(files[0]);
        setSourceType('file');
      }
    }
  };

  const handleStartTranscription = async () => {
    setErrorMessage(null);

    let targetPath: string | null = null;
    if (sourceType === 'asset' && selectedAssetId) {
      targetPath = assetPathResolver(selectedAssetId);
    } else if (sourceType === 'file' && customFilePath) {
      targetPath = customFilePath;
    } else if (sourceType === 'project') {
      // Find the first audio or video clip on the timeline
      for (const track of project.tracks) {
        if (track.isMuted) continue;
        for (const clip of track.clips) {
          if (clip.assetId) {
            const p = assetPathResolver(clip.assetId);
            if (p) {
              targetPath = p;
              break;
            }
          }
        }
        if (targetPath) break;
      }
    }

    if (!targetPath) {
      // Fallback: If no media path resolved, check if custom file provided
      if (customFilePath) {
        targetPath = customFilePath;
      } else {
        setErrorMessage('Please select a media file or add a video/audio clip to the timeline first.');
        return;
      }
    }

    setCurrentStep('transcribing');
    setProgress({
      status: 'extracting-audio',
      progress: 5,
      message: 'Preparing audio track for speech recognition...',
    });

    try {
      if (window.vnestNative?.transcribeMedia) {
        const res = await window.vnestNative.transcribeMedia({
          inputPath: targetPath,
          language,
          model,
          wordTimestamps,
        });

        if (res.success && res.segments) {
          setSegments(res.segments);
          setCurrentStep('editor');
        } else {
          setErrorMessage(res.error || 'Speech transcription failed. Please check the media file format.');
          setCurrentStep('select');
        }
      } else {
        // Web simulation fallback for non-Electron environment
        for (let i = 10; i <= 100; i += 20) {
          setProgress({
            status: i < 50 ? 'downloading-model' : 'transcribing',
            progress: i,
            message: i < 50 ? `Simulating model download... ${i}%` : `Transcribing speech... ${i}%`,
          });
          await new Promise((r) => setTimeout(r, 200));
        }

        const simulated: CaptionSegment[] = [
          {
            id: `sim_1_${Date.now()}`,
            startMs: 0,
            endMs: 3200,
            text: 'Welcome to HL Video Editor with AI captions.',
            words: [
              { word: 'Welcome', startMs: 0, endMs: 600 },
              { word: 'to', startMs: 600, endMs: 900 },
              { word: 'HL', startMs: 900, endMs: 1400 },
              { word: 'Video', startMs: 1400, endMs: 1900 },
              { word: 'Editor.', startMs: 1900, endMs: 3200 },
            ],
          },
          {
            id: `sim_2_${Date.now()}`,
            startMs: 3500,
            endMs: 7000,
            text: 'Timestamped captions generated automatically.',
          },
        ];
        setSegments(simulated);
        setCurrentStep('editor');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during transcription.');
      setCurrentStep('select');
    }
  };

  const handleUpdateSegment = (id: string, updates: Partial<CaptionSegment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg))
    );
  };

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
  };

  const handleSplitSegment = (segment: CaptionSegment) => {
    const mid = segment.startMs + Math.round((segment.endMs - segment.startMs) / 2);
    const [part1, part2] = splitCaptionSegment(segment, mid);
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === segment.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1, part1, part2);
      return copy;
    });
  };

  const handleMergeNext = (index: number) => {
    if (index >= segments.length - 1) return;
    const current = segments[index];
    const next = segments[index + 1];
    const merged = mergeCaptionSegments(current, next);

    setSegments((prev) => {
      const copy = [...prev];
      copy.splice(index, 2, merged);
      return copy;
    });
  };

  const handleAddSegment = () => {
    const lastEnd = segments.length > 0 ? segments[segments.length - 1].endMs + 200 : 0;
    const newSeg: CaptionSegment = {
      id: `cap_man_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      startMs: lastEnd,
      endMs: lastEnd + 2500,
      text: 'New subtitle block',
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  const handleApplyToTimeline = () => {
    onApplyCaptions(segments, style);
    onClose();
  };

  const handleExportSrt = async () => {
    const srt = generateSrt(segments);
    if (window.vnestNative?.selectSubtitleDestination && window.vnestNative?.saveTextFile) {
      const path = await window.vnestNative.selectSubtitleDestination(`${project.name}.srt`, 'srt');
      if (path) {
        await window.vnestNative.saveTextFile(path, srt);
      }
    } else {
      // Browser download
      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.srt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportVtt = async () => {
    const vtt = generateVtt(segments);
    if (window.vnestNative?.selectSubtitleDestination && window.vnestNative?.saveTextFile) {
      const path = await window.vnestNative.selectSubtitleDestination(`${project.name}.vtt`, 'vtt');
      if (path) {
        await window.vnestNative.saveTextFile(path, vtt);
      }
    } else {
      // Browser download
      const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.vtt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="vnest-modal-backdrop">
      <div
        className="vnest-modal-content"
        style={{
          width: '90%',
          maxWidth: 900,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'var(--accent-sage-subtle)',
                color: 'var(--accent-sage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                AI Auto Captions & Speech-to-Text
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Local Whisper speech engine • Zero cloud fees • Fully editable
              </div>
            </div>
          </div>

          <button
            id="autocaptions-close-btn"
            onClick={onClose}
            className="vnest-btn-subtle"
            style={{ width: 30, height: 30, padding: 0 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#f87171',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Configuration & Source Selection */}
          {currentStep === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Audio Source Picker */}
              <div className="vnest-card">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Volume2 style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
                  1. Select Speech Audio Source
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div
                    onClick={() => setSourceType('project')}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${sourceType === 'project' ? 'var(--accent-sage)' : 'var(--border-subtle)'}`,
                      background: sourceType === 'project' ? 'var(--selected-surface)' : 'var(--bg-surface-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
                      Timeline Audio
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Transcribe active clips from project timeline
                    </div>
                  </div>

                  <div
                    onClick={() => setSourceType('asset')}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${sourceType === 'asset' ? 'var(--accent-sage)' : 'var(--border-subtle)'}`,
                      background: sourceType === 'asset' ? 'var(--selected-surface)' : 'var(--bg-surface-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
                      Media Asset
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Choose an imported video or audio file
                    </div>
                  </div>

                  <div
                    onClick={handleSelectLocalFile}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${sourceType === 'file' ? 'var(--accent-sage)' : 'var(--border-subtle)'}`,
                      background: sourceType === 'file' ? 'var(--selected-surface)' : 'var(--bg-surface-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
                      Browse File...
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {customFilePath ? customFilePath.split(/[\\/]/).pop() : 'Pick file from PC'}
                    </div>
                  </div>
                </div>

                {sourceType === 'asset' && project.assets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Choose Project Media:
                    </label>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {project.assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type}, {(a.durationMs / 1000).toFixed(1)}s)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Language & Whisper Model */}
              <div className="vnest-card">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
                  2. Speech Recognition Settings
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Spoken Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="auto">Auto-Detect Language</option>
                      <option value="en">English</option>
                      <option value="es">Spanish (Español)</option>
                      <option value="fr">French (Français)</option>
                      <option value="de">German (Deutsch)</option>
                      <option value="it">Italian (Italiano)</option>
                      <option value="pt">Portuguese (Português)</option>
                      <option value="ja">Japanese (日本語)</option>
                      <option value="zh">Chinese (中文)</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="ru">Russian (Русский)</option>
                      <option value="ko">Korean (한국어)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Whisper Model (Local ONNX)
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value as TranscriptionModelId)}
                      style={{ width: '100%' }}
                    >
                      <option value="Xenova/whisper-tiny.en">Whisper Tiny (English, ~39MB Fast)</option>
                      <option value="Xenova/whisper-tiny">Whisper Tiny (Multilingual, ~39MB)</option>
                      <option value="Xenova/whisper-base">Whisper Base (High Accuracy, ~74MB)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <input
                    type="checkbox"
                    id="chk-words"
                    checked={wordTimestamps}
                    onChange={(e) => setWordTimestamps(e.target.checked)}
                  />
                  <label htmlFor="chk-words" style={{ fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Generate accurate word-level timestamps (enables word karaoke highlighting)
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={onClose} className="vnest-btn-subtle">
                  Cancel
                </button>
                <button
                  onClick={handleStartTranscription}
                  className="vnest-btn-primary"
                  style={{ gap: 8 }}
                >
                  <Sparkles style={{ width: 14, height: 14 }} />
                  <span>Generate Auto Captions</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Progress & Downloading */}
          {currentStep === 'transcribing' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--accent-sage-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  animation: 'pulse 2s infinite',
                }}
              >
                <Sparkles style={{ width: 28, height: 28, color: 'var(--accent-sage)' }} />
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Generating AI Auto Captions
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {progress.message || 'Processing audio stream...'}
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 420,
                  height: 8,
                  borderRadius: 4,
                  background: 'var(--bg-surface-3)',
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(5, progress.progress)}%`,
                    background: 'var(--accent-sage)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {progress.progress}% complete {progress.detail ? `• ${progress.detail}` : ''}
              </div>
            </div>
          )}

          {/* STEP 3: Interactive Transcript Editor & Styling */}
          {currentStep === 'editor' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
              {/* Tab selector: Transcript vs Styling */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={activeTab === 'transcript' ? 'vnest-btn-primary' : 'vnest-btn-subtle'}
                    style={{ fontSize: 11, padding: '5px 12px' }}
                  >
                    <FileText style={{ width: 13, height: 13 }} />
                    <span>Editable Transcript ({segments.length} segments)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('style')}
                    className={activeTab === 'style' ? 'vnest-btn-primary' : 'vnest-btn-subtle'}
                    style={{ fontSize: 11, padding: '5px 12px' }}
                  >
                    <Palette style={{ width: 13, height: 13 }} />
                    <span>Caption Style & Typography</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setCurrentStep('select')}
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11, padding: '5px 10px' }}
                    title="Regenerate with different settings"
                  >
                    <RotateCcw style={{ width: 12, height: 12 }} />
                    <span>Re-run</span>
                  </button>
                  <button
                    onClick={handleAddSegment}
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11, padding: '5px 10px' }}
                    title="Add new subtitle cue"
                  >
                    <Plus style={{ width: 12, height: 12 }} />
                    <span>Add Cue</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Editable Transcript Table */}
              {activeTab === 'transcript' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: '46vh',
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="vnest-card"
                      style={{
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Timestamps */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>#{idx + 1}</span>
                          <input
                            type="text"
                            value={formatSrtTimecode(seg.startMs)}
                            onChange={(e) => handleUpdateSegment(seg.id, { startMs: parseTimecode(e.target.value) })}
                            style={{ width: 95, fontSize: 11, padding: '2px 4px', textAlign: 'center' }}
                            title="Start time (00:00:00,000)"
                          />
                          <span style={{ color: 'var(--text-muted)' }}>➔</span>
                          <input
                            type="text"
                            value={formatSrtTimecode(seg.endMs)}
                            onChange={(e) => handleUpdateSegment(seg.id, { endMs: parseTimecode(e.target.value) })}
                            style={{ width: 95, fontSize: 11, padding: '2px 4px', textAlign: 'center' }}
                            title="End time (00:00:00,000)"
                          />
                          <span style={{ fontSize: 10, color: 'var(--accent-sage)' }}>
                            {((seg.endMs - seg.startMs) / 1000).toFixed(2)}s
                          </span>
                        </div>

                        {/* Actions: Split, Merge, Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() => handleSplitSegment(seg)}
                            className="vnest-btn-subtle"
                            style={{ padding: '3px 6px', fontSize: 10 }}
                            title="Split segment into two"
                          >
                            <Split style={{ width: 12, height: 12 }} />
                            <span>Split</span>
                          </button>
                          {idx < segments.length - 1 && (
                            <button
                              onClick={() => handleMergeNext(idx)}
                              className="vnest-btn-subtle"
                              style={{ padding: '3px 6px', fontSize: 10 }}
                              title="Merge with next segment"
                            >
                              <Merge style={{ width: 12, height: 12 }} />
                              <span>Merge</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="vnest-btn-subtle"
                            style={{ padding: '3px 6px', color: '#f87171' }}
                            title="Delete segment"
                          >
                            <Trash2 style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      </div>

                      {/* Text Input */}
                      <textarea
                        rows={2}
                        value={seg.text}
                        onChange={(e) => handleUpdateSegment(seg.id, { text: e.target.value })}
                        style={{
                          width: '100%',
                          fontSize: 12,
                          background: 'var(--bg-surface-3)',
                          resize: 'vertical',
                          borderRadius: 6,
                          padding: 8,
                        }}
                      />

                      {/* Word Badges if available */}
                      {seg.words && seg.words.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {seg.words.map((w, wIdx) => (
                            <span
                              key={wIdx}
                              style={{
                                fontSize: 9,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: 'var(--accent-sage-subtle)',
                                color: 'var(--accent-sage)',
                                border: '1px solid var(--border-subtle)',
                              }}
                              title={`${w.startMs}ms - ${w.endMs}ms`}
                            >
                              {w.word}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Style & Typography Customization */}
              {activeTab === 'style' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    maxHeight: '46vh',
                    overflowY: 'auto',
                  }}
                >
                  <div className="vnest-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Font & Typography</div>

                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                        Font Family
                      </label>
                      <select
                        value={style.fontFamily}
                        onChange={(e) => setStyle((s) => ({ ...s, fontFamily: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="Inter">Inter</option>
                        <option value="Impact">Impact (Meme / Viral Bold)</option>
                        <option value="Arial">Arial Standard</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Courier New">Courier New (Typewriter)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                          Font Size ({style.fontSize}px)
                        </label>
                        <input
                          type="range"
                          min="16"
                          max="72"
                          value={style.fontSize}
                          onChange={(e) => setStyle((s) => ({ ...s, fontSize: parseInt(e.target.value, 10) }))}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                          Text Color
                        </label>
                        <input
                          type="color"
                          value={style.color}
                          onChange={(e) => setStyle((s) => ({ ...s, color: e.target.value }))}
                          style={{ width: '100%', height: 28, padding: 0 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                          Outline Width ({style.strokeWidth}px)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="8"
                          value={style.strokeWidth}
                          onChange={(e) => setStyle((s) => ({ ...s, strokeWidth: parseInt(e.target.value, 10) }))}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                          Outline Color
                        </label>
                        <input
                          type="color"
                          value={style.strokeColor}
                          onChange={(e) => setStyle((s) => ({ ...s, strokeColor: e.target.value }))}
                          style={{ width: '100%', height: 28, padding: 0 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="vnest-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Background & Position</div>

                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                        Vertical Position ({style.positionY > 0 ? `Bottom +${style.positionY}%` : style.positionY < 0 ? `Top ${style.positionY}%` : 'Center'})
                      </label>
                      <input
                        type="range"
                        min="-40"
                        max="45"
                        value={style.positionY}
                        onChange={(e) => setStyle((s) => ({ ...s, positionY: parseInt(e.target.value, 10) }))}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                        Background Box Style
                      </label>
                      <select
                        value={style.backgroundColor}
                        onChange={(e) => setStyle((s) => ({ ...s, backgroundColor: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="transparent">Transparent (None)</option>
                        <option value="rgba(0, 0, 0, 0.65)">Dark Semi-Transparent</option>
                        <option value="rgba(0, 0, 0, 0.9)">Solid Black Box</option>
                        <option value="rgba(15, 23, 42, 0.85)">Midnight Blue Slate</option>
                        <option value="rgba(234, 179, 8, 0.85)">Yellow Highlight Box</option>
                      </select>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          id="chk-highlight"
                          checked={style.highlightWord}
                          onChange={(e) => setStyle((s) => ({ ...s, highlightWord: e.target.checked }))}
                        />
                        <label htmlFor="chk-highlight" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                          Word Highlighting (Karaoke Pop)
                        </label>
                      </div>

                      {style.highlightWord && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Highlight Color:</label>
                          <input
                            type="color"
                            value={style.highlightColor || '#facc15'}
                            onChange={(e) => setStyle((s) => ({ ...s, highlightColor: e.target.value }))}
                            style={{ width: 40, height: 24, padding: 0 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 12,
                  marginTop: 4,
                }}
              >
                {/* Export Standalone Subtitles */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExportSrt}
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11 }}
                    title="Export standalone .srt file"
                  >
                    <Download style={{ width: 13, height: 13 }} />
                    <span>Export .SRT</span>
                  </button>
                  <button
                    onClick={handleExportVtt}
                    className="vnest-btn-subtle"
                    style={{ fontSize: 11 }}
                    title="Export standalone .vtt file"
                  >
                    <Download style={{ width: 13, height: 13 }} />
                    <span>Export .VTT</span>
                  </button>
                </div>

                {/* Apply / Close */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={onClose} className="vnest-btn-subtle">
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyToTimeline}
                    className="vnest-btn-primary"
                    style={{ gap: 6 }}
                  >
                    <Check style={{ width: 14, height: 14 }} />
                    <span>Add Captions to Timeline</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
