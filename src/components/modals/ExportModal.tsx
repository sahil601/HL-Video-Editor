import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Download,
  Film,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  StopCircle,
  ListOrdered,
  History,
  Sliders,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Trash2,
  ShieldAlert,
  HardDrive,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Project } from '../../types/project';
import { EXPORT_PRESETS } from '../../core/ffmpeg';
import {
  ProfessionalExportPreset,
  ExportPlatformCategory,
  CustomExportConfig,
  DetectedEncoder,
  ExportQueueJob,
  ExportHistoryRecord,
} from '../../types/export';
import {
  generateProjectSrt,
  generateProjectVtt,
  extractProjectCaptions,
} from '../../core/captions/projectCaptions';
import { CaptionStyle } from '../../core/captions/types';
import { renderElementToPngDataUrl } from '../../core/elements/elementDefinitions';
import { BUILTIN_LUT_PRESETS } from '../../core/lut';
import { validateProjectForExport } from '../../core/exportValidation';
import { ExportQueueManager, ExportHistoryManager } from '../../core/exportQueue';

interface ExportModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  assetPathResolver: (assetId: string) => string | null;
  assetBinaryMap?: Map<string, Blob>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  isOpen,
  onClose,
  assetPathResolver,
  assetBinaryMap,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'queue' | 'history'>('settings');
  const [platformCategory, setPlatformCategory] = useState<ExportPlatformCategory>('all');
  const [selectedPreset, setSelectedPreset] = useState<ProfessionalExportPreset>(EXPORT_PRESETS[0]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [useProxiesForExport, setUseProxiesForExport] = useState(false);
  const [fileExists, setFileExists] = useState<{ exists: boolean; size?: number }>({ exists: false });

  // Custom Settings state
  const [customConfig, setCustomConfig] = useState<CustomExportConfig>({
    name: 'Custom Export Profile',
    width: project.settings.width || 1920,
    height: project.settings.height || 1080,
    fps: project.settings.fps || 30,
    aspectRatio: project.settings.aspectRatio || '16:9',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '12M',
    audioBitrate: '192k',
    format: 'mp4',
    rateControl: 'vbr',
    crf: 23,
  });

  // Detected Encoders from native bridge
  const [availableEncoders, setAvailableEncoders] = useState<DetectedEncoder[]>([]);

  // Captions
  const captions = useMemo(() => extractProjectCaptions(project), [project]);
  const [burnCaptions, setBurnCaptions] = useState(captions.length > 0);

  // Queue & History state
  const [queueJobs, setQueueJobs] = useState<ExportQueueJob[]>([]);
  const [historyRecords, setHistoryRecords] = useState<ExportHistoryRecord[]>([]);

  // Subscribe to export queue manager
  useEffect(() => {
    const queueManager = ExportQueueManager.getInstance();
    const unsubscribe = queueManager.subscribe((jobs) => {
      setQueueJobs(jobs);
    });
    return unsubscribe;
  }, []);

  // Load history records
  const refreshHistory = useCallback(() => {
    setHistoryRecords(ExportHistoryManager.getHistory());
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshHistory();
    }
  }, [isOpen, refreshHistory]);

  // Load available encoders
  useEffect(() => {
    let isMounted = true;
    if (window.vnestNative?.getAvailableEncoders) {
      window.vnestNative.getAvailableEncoders().then((res) => {
        if (isMounted && res.success && res.encoders) {
          setAvailableEncoders(res.encoders);
        }
      });
    } else {
      setAvailableEncoders([
        {
          id: 'libx264',
          name: 'H.264 / AVC (CPU Software)',
          codecType: 'h264',
          isHardware: false,
          isAvailable: true,
          fallbackEncoder: 'libx264',
        },
      ]);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Match preset with project aspect ratio initially
  useEffect(() => {
    const matched = EXPORT_PRESETS.find((p) => p.aspectRatio === project.settings.aspectRatio);
    if (matched) setSelectedPreset(matched);
  }, [project.settings.aspectRatio]);

  // Check file overwrite status whenever outputPath changes
  useEffect(() => {
    let isMounted = true;
    if (outputPath && window.vnestNative?.checkFileExists) {
      window.vnestNative.checkFileExists(outputPath).then((res) => {
        if (isMounted) setFileExists(res);
      });
    } else {
      setFileExists({ exists: false });
    }
    return () => {
      isMounted = false;
    };
  }, [outputPath]);

  // Pre-flight validation
  const effectivePreset = useMemo<ProfessionalExportPreset>(() => {
    if (platformCategory === 'custom') {
      return {
        id: 'custom_user_preset',
        name: customConfig.name,
        description: `Custom ${customConfig.width}x${customConfig.height} @ ${customConfig.fps}fps`,
        width: Number(customConfig.width),
        height: Number(customConfig.height),
        fps: Number(customConfig.fps),
        aspectRatio: String(customConfig.aspectRatio),
        videoBitrate: customConfig.videoBitrate,
        audioBitrate: customConfig.audioBitrate,
        format: customConfig.format,
        codec: customConfig.videoCodec,
        audioCodec: customConfig.audioCodec,
        rateControl: customConfig.rateControl,
        crf: customConfig.crf,
        isCustom: true,
      };
    }
    return selectedPreset;
  }, [platformCategory, selectedPreset, customConfig]);

  const validationResult = useMemo(() => {
    return validateProjectForExport(project, effectivePreset, outputPath, assetPathResolver, {
      assetBinaryMap,
    });
  }, [project, effectivePreset, outputPath, assetPathResolver, assetBinaryMap]);

  if (!isOpen) return null;

  const handleSelectDestination = async () => {
    if (window.vnestNative?.selectExportDestination) {
      const ext = effectivePreset.format || 'mp4';
      const defaultFilename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${effectivePreset.name.split(' ')[0]}.${ext}`;
      const chosen = await window.vnestNative.selectExportDestination(defaultFilename);
      if (chosen) setOutputPath(chosen);
    } else {
      setOutputPath(`C:\\Exports\\${project.name}.${effectivePreset.format || 'mp4'}`);
    }
  };

  const handleExportSrtOnly = async () => {
    const srt = generateProjectSrt(project);
    if (!srt.trim()) return;
    if (window.vnestNative?.selectSubtitleDestination && window.vnestNative?.saveTextFile) {
      const path = await window.vnestNative.selectSubtitleDestination(`${project.name}.srt`, 'srt');
      if (path) await window.vnestNative.saveTextFile(path, srt);
    } else {
      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.srt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportVttOnly = async () => {
    const vtt = generateProjectVtt(project);
    if (!vtt.trim()) return;
    if (window.vnestNative?.selectSubtitleDestination && window.vnestNative?.saveTextFile) {
      const path = await window.vnestNative.selectSubtitleDestination(`${project.name}.vtt`, 'vtt');
      if (path) await window.vnestNative.saveTextFile(path, vtt);
    } else {
      const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.vtt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const prepareExportJob = async (): Promise<boolean> => {
    let destination = outputPath;
    if (!destination) {
      if (window.vnestNative?.selectExportDestination) {
        const ext = effectivePreset.format || 'mp4';
        const chosen = await window.vnestNative.selectExportDestination(`${project.name}.${ext}`);
        if (!chosen) return false;
        destination = chosen;
        setOutputPath(chosen);
      } else {
        destination = `C:\\Exports\\${project.name}.${effectivePreset.format || 'mp4'}`;
        setOutputPath(destination);
      }
    }

    let tempSrtPath: string | undefined;
    let captionStyle: CaptionStyle | undefined;

    if (burnCaptions && captions.length > 0) {
      const srt = generateProjectSrt(project);
      if (srt.trim()) {
        const tempName = `hl_burn_${Date.now()}.srt`;
        tempSrtPath = destination.replace(/[\\/][^\\/]+$/, `\\${tempName}`);
        if (window.vnestNative?.saveTextFile) {
          await window.vnestNative.saveTextFile(tempSrtPath, srt);
        }

        const textClips = project.tracks.flatMap((t) => t.clips).filter((c) => c.type === 'text' && c.textProperties);
        const first = textClips[0];
        if (first?.textProperties) {
          captionStyle = {
            fontFamily: first.textProperties.fontFamily || 'Arial',
            fontSize: first.textProperties.fontSize || 28,
            color: first.textProperties.color || '#ffffff',
            strokeColor: first.textProperties.strokeColor || '#000000',
            strokeWidth: first.textProperties.strokeWidth || 2,
            backgroundColor: first.textProperties.backgroundColor || 'transparent',
            backgroundPadding: first.textProperties.backgroundPadding || 8,
            borderRadius: first.textProperties.borderRadius || 6,
            positionY: first.transform.positionY,
            positionX: first.transform.positionX,
            textAlign: first.textProperties.textAlign || 'center',
          };
        }
      }
    }

    // Pre-rasterize element clips to temporary PNGs
    const elementPathMap = new Map<string, string>();
    const elementClips = project.tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.type === 'element' && c.elementProperties);
    if (elementClips.length > 0) {
      for (const elemClip of elementClips) {
        if (!elemClip.elementProperties) continue;
        try {
          const pngDataUrl = await renderElementToPngDataUrl(
            elemClip.elementProperties,
            effectivePreset.width,
            effectivePreset.height
          );
          const res = await fetch(pngDataUrl);
          const buffer = await res.arrayBuffer();
          const tempFilename = `hl_elem_${elemClip.id}_${Date.now()}.png`;
          const tempFilePath = destination.replace(/[\\/][^\\/]+$/, `\\${tempFilename}`);
          if (window.vnestNative?.saveFileBinary) {
            await window.vnestNative.saveFileBinary(tempFilePath, buffer);
            elementPathMap.set(elemClip.id, tempFilePath);
          }
        } catch (err) {
          console.warn('Failed to rasterize element for export:', err);
        }
      }
    }

    // Pre-dump in-memory blobs (voiceover, sound effects, extracted audio)
    const blobPathMap = new Map<string, string>();
    if (assetBinaryMap && window.vnestNative?.saveFileBinary) {
      for (const track of project.tracks) {
        if (track.isMuted) continue;
        for (const clip of track.clips) {
          if (!clip.assetId || blobPathMap.has(clip.assetId)) continue;
          const blob = assetBinaryMap.get(clip.assetId);
          const currentPath = assetPathResolver(clip.assetId);
          const isAbsolute = currentPath && (currentPath.includes(':\\') || currentPath.startsWith('/'));
          if (blob && (!currentPath || !isAbsolute)) {
            try {
              const buffer = await blob.arrayBuffer();
              const ext =
                clip.type === 'audio'
                  ? blob.type.includes('webm')
                    ? 'webm'
                    : 'wav'
                  : blob.type.includes('png') || clip.type === 'overlay' || clip.type === 'image'
                  ? 'png'
                  : 'mp4';
              const tempFilename = `hl_blob_${clip.assetId}_${Date.now()}.${ext}`;
              const tempFilePath = destination.replace(/[\\/][^\\/]+$/, `\\${tempFilename}`);
              await window.vnestNative.saveFileBinary(tempFilePath, buffer);
              blobPathMap.set(clip.assetId, tempFilePath);
            } catch (err) {
              console.warn('Failed to save in-memory asset for export:', err);
            }
          }
        }
      }
    }

    // Pre-dump 3D LUT files
    const lutPathMap = new Map<string, string>();
    for (const track of project.tracks) {
      if (track.isMuted) continue;
      for (const clip of track.clips) {
        const lut = clip.colorAdjustments?.lut;
        if (lut && lut.enabled) {
          if (lut.filePath) {
            lutPathMap.set(clip.id, lut.filePath);
          } else if (window.vnestNative?.saveTextFile) {
            let cubeContent: string | null = null;
            if (lut.preset) {
              const foundPreset = BUILTIN_LUT_PRESETS.find((p) => p.id === lut.preset);
              if (foundPreset) cubeContent = foundPreset.generateCube();
            } else if (lut.cubeData) {
              cubeContent = lut.cubeData;
            }
            if (cubeContent) {
              const tempFilename = `hl_lut_${clip.id}_${Date.now()}.cube`;
              const tempFilePath = destination.replace(/[\\/][^\\/]+$/, `\\${tempFilename}`);
              try {
                await window.vnestNative.saveTextFile(tempFilePath, cubeContent);
                lutPathMap.set(clip.id, tempFilePath);
              } catch (err) {
                console.warn('Failed to save LUT for export:', err);
              }
            }
          }
        }
      }
    }

    // Enqueue job in ExportQueueManager
    ExportQueueManager.getInstance().enqueueJob({
      project,
      preset: effectivePreset,
      destinationPath: destination,
      useProxies: useProxiesForExport,
      burnCaptions,
      tempSrtPath,
      captionStyle,
      elementPathMap,
      blobPathMap,
      lutPathMap,
      assetPathResolver,
    });

    return true;
  };

  const handleStartExportNow = async () => {
    const success = await prepareExportJob();
    if (success) {
      setActiveTab('queue');
    }
  };

  const handleAddToQueue = async () => {
    await prepareExportJob();
  };

  const filteredPresets = useMemo(() => {
    if (platformCategory === 'all') return EXPORT_PRESETS;
    return EXPORT_PRESETS.filter((p) => p.category === platformCategory);
  }, [platformCategory]);

  const activeQueueCount = queueJobs.filter(
    (j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'validating'
  ).length;

  return (
    <div className="vnest-modal-backdrop">
      <div className="vnest-modal-box" style={{ maxWidth: '780px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'var(--accent-sage-subtle)',
              border: '1px solid rgba(155, 175, 155, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-sage)',
            }}>
              <Film size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Export & Professional Workflow
                </h3>
                <span className="vnest-badge vnest-badge-indigo" style={{ fontSize: '10px' }}>
                  Phase 8
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                High-fidelity hardware-accelerated timeline render engine with validation
              </p>
            </div>
          </div>

          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '6px' }} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', padding: '10px 0' }}>
          <button
            onClick={() => setActiveTab('settings')}
            className={`vnest-btn-subtle ${activeTab === 'settings' ? 'active' : ''}`}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              backgroundColor: activeTab === 'settings' ? 'var(--selected-surface)' : 'transparent',
              borderColor: activeTab === 'settings' ? 'var(--accent-sage)' : 'transparent',
              color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Sliders size={13} />
            <span>Export Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`vnest-btn-subtle ${activeTab === 'queue' ? 'active' : ''}`}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              backgroundColor: activeTab === 'queue' ? 'var(--selected-surface)' : 'transparent',
              borderColor: activeTab === 'queue' ? 'var(--accent-sage)' : 'transparent',
              color: activeTab === 'queue' ? 'var(--text-primary)' : 'var(--text-secondary)',
              position: 'relative',
            }}
          >
            <ListOrdered size={13} />
            <span>Export Queue</span>
            {activeQueueCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--accent-sage)',
                  color: '#090a0d',
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  marginLeft: '4px',
                }}
              >
                {activeQueueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              refreshHistory();
            }}
            className={`vnest-btn-subtle ${activeTab === 'history' ? 'active' : ''}`}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              backgroundColor: activeTab === 'history' ? 'var(--selected-surface)' : 'transparent',
              borderColor: activeTab === 'history' ? 'var(--accent-sage)' : 'transparent',
              color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <History size={13} />
            <span>Export History ({historyRecords.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 0' }}>
          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Platform Selector Pills */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Target Platform & Presets
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(['all', 'youtube', 'instagram', 'tiktok', 'cinema', 'custom'] as ExportPlatformCategory[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setPlatformCategory(cat)}
                        className="vnest-btn-subtle"
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '14px',
                          textTransform: 'capitalize',
                          backgroundColor: platformCategory === cat ? 'var(--selected-surface)' : 'var(--bg-surface-2)',
                          borderColor: platformCategory === cat ? 'var(--accent-sage)' : 'var(--border-subtle)',
                          color: platformCategory === cat ? 'var(--accent-sage)' : 'var(--text-secondary)',
                          fontWeight: platformCategory === cat ? 700 : 500,
                        }}
                      >
                        {cat === 'all'
                          ? '🌟 All Presets'
                          : cat === 'youtube'
                          ? '📺 YouTube'
                          : cat === 'instagram'
                          ? '📸 Instagram'
                          : cat === 'tiktok'
                          ? '🎵 TikTok / Reels'
                          : cat === 'cinema'
                          ? '🎬 Cinema & ProRes'
                          : '⚙️ Custom Settings'}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Standard Preset List (when not Custom) */}
              {platformCategory !== 'custom' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredPresets.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset)}
                        className="vnest-card"
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--accent-sage)' : 'var(--border-subtle)',
                          backgroundColor: isSelected ? 'var(--selected-surface)' : 'var(--bg-surface-2)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {preset.name}
                          </span>
                          {preset.tag && (
                            <span className="vnest-badge vnest-badge-indigo" style={{ fontSize: '9px', padding: '1px 5px' }}>
                              {preset.tag}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span className="font-mono-time" style={{ color: 'var(--accent-sage)', fontWeight: 600 }}>
                            {preset.width}x{preset.height}
                          </span>
                          <span>•</span>
                          <span>{preset.fps} fps</span>
                          <span>•</span>
                          <span>{preset.videoBitrate}</span>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Custom Settings Inspector */
                <div className="vnest-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Width (px)
                      </label>
                      <input
                        type="number"
                        min="320"
                        max="7680"
                        step="2"
                        value={customConfig.width}
                        onChange={(e) => setCustomConfig({ ...customConfig, width: parseInt(e.target.value, 10) || 1920 })}
                        style={{ width: '100%', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Height (px)
                      </label>
                      <input
                        type="number"
                        min="240"
                        max="4320"
                        step="2"
                        value={customConfig.height}
                        onChange={(e) => setCustomConfig({ ...customConfig, height: parseInt(e.target.value, 10) || 1080 })}
                        style={{ width: '100%', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Frame Rate (FPS)
                      </label>
                      <select
                        value={customConfig.fps}
                        onChange={(e) => setCustomConfig({ ...customConfig, fps: parseFloat(e.target.value) || 30 })}
                        style={{ width: '100%', fontSize: '11px' }}
                      >
                        <option value="24">24 fps (Cinema)</option>
                        <option value="25">25 fps (PAL)</option>
                        <option value="29.97">29.97 fps (NTSC)</option>
                        <option value="30">30 fps (Standard)</option>
                        <option value="50">50 fps (High PAL)</option>
                        <option value="60">60 fps (Smooth Motion)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Video Codec & Acceleration
                      </label>
                      <select
                        value={customConfig.videoCodec}
                        onChange={(e) => setCustomConfig({ ...customConfig, videoCodec: e.target.value })}
                        style={{ width: '100%', fontSize: '11px' }}
                      >
                        {availableEncoders.map((enc) => (
                          <option key={enc.id} value={enc.id}>
                            {enc.name} {enc.isHardware ? '⚡ [HW]' : '💻 [CPU]'} {!enc.isAvailable ? '(Unavailable - Will fallback)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Audio Codec & Bitrate
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={customConfig.audioCodec}
                          onChange={(e) => setCustomConfig({ ...customConfig, audioCodec: e.target.value as any })}
                          style={{ flex: 1, fontSize: '11px' }}
                        >
                          <option value="aac">AAC (Standard)</option>
                          <option value="libmp3lame">MP3</option>
                          <option value="pcm_s16le">PCM 16-bit (Lossless)</option>
                        </select>
                        <select
                          value={customConfig.audioBitrate}
                          onChange={(e) => setCustomConfig({ ...customConfig, audioBitrate: e.target.value })}
                          style={{ width: '85px', fontSize: '11px' }}
                        >
                          <option value="96k">96 kbps</option>
                          <option value="128k">128 kbps</option>
                          <option value="192k">192 kbps</option>
                          <option value="256k">256 kbps</option>
                          <option value="320k">320 kbps</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Rate Control & Video Bitrate
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={customConfig.rateControl}
                          onChange={(e) => setCustomConfig({ ...customConfig, rateControl: e.target.value as any })}
                          style={{ width: '90px', fontSize: '11px' }}
                        >
                          <option value="vbr">Target VBR</option>
                          <option value="crf">CRF Quality</option>
                        </select>
                        {customConfig.rateControl === 'crf' ? (
                          <input
                            type="number"
                            min="0"
                            max="51"
                            value={customConfig.crf}
                            onChange={(e) => setCustomConfig({ ...customConfig, crf: parseInt(e.target.value, 10) || 23 })}
                            placeholder="CRF (18-28)"
                            style={{ flex: 1, fontSize: '11px' }}
                          />
                        ) : (
                          <select
                            value={customConfig.videoBitrate}
                            onChange={(e) => setCustomConfig({ ...customConfig, videoBitrate: e.target.value })}
                            style={{ flex: 1, fontSize: '11px' }}
                          >
                            <option value="4M">4 Mbps (Draft / Small)</option>
                            <option value="8M">8 Mbps (Standard HD)</option>
                            <option value="12M">12 Mbps (High HD)</option>
                            <option value="16M">16 Mbps (Web 60p)</option>
                            <option value="25M">25 Mbps (4K Standard)</option>
                            <option value="45M">45 Mbps (4K Master)</option>
                            <option value="80M">80 Mbps (Near Lossless)</option>
                          </select>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Container Format
                      </label>
                      <select
                        value={customConfig.format}
                        onChange={(e) => setCustomConfig({ ...customConfig, format: e.target.value as any })}
                        style={{ width: '100%', fontSize: '11px' }}
                      >
                        <option value="mp4">MP4 (.mp4 - Universal Web & Mobile)</option>
                        <option value="mov">MOV (.mov - Apple QuickTime & ProRes)</option>
                        <option value="mkv">MKV (.mkv - Matroska Multi-track)</option>
                        <option value="webm">WebM (.webm - Open Web VP9)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtitles & Captions */}
              {captions.length > 0 && (
                <div className="vnest-card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={14} style={{ color: 'var(--accent-sage)' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        AI Auto Captions ({captions.length} cues)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={handleExportSrtOnly}
                        className="vnest-btn-subtle"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        title="Export separate .srt file"
                      >
                        <Download size={11} /> .SRT
                      </button>
                      <button
                        type="button"
                        onClick={handleExportVttOnly}
                        className="vnest-btn-subtle"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        title="Export separate .vtt file"
                      >
                        <Download size={11} /> .VTT
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <input
                      type="checkbox"
                      id="chk-burn-captions"
                      checked={burnCaptions}
                      onChange={(e) => setBurnCaptions(e.target.checked)}
                    />
                    <label htmlFor="chk-burn-captions" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Burn styled captions directly into the exported video stream
                    </label>
                  </div>
                </div>
              )}

              {/* Quality & Media Policy */}
              <div className="vnest-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={14} style={{ color: 'var(--accent-sage)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Source Media Render Policy
                    </span>
                  </div>
                  <span className="vnest-badge vnest-badge-indigo" style={{ fontSize: '10px' }}>
                    {useProxiesForExport ? '⚡ Fast Proxy Draft' : '💎 Original Master Quality (Default)'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <input
                    type="checkbox"
                    id="chk-use-proxies-export"
                    checked={useProxiesForExport}
                    onChange={(e) => setUseProxiesForExport(e.target.checked)}
                  />
                  <label htmlFor="chk-use-proxies-export" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Draft Render: use lightweight proxy media where available for faster draft encoding (unchecked preserves original high-res media)
                  </label>
                </div>
              </div>

              {/* Destination & Overwrite Warning */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Output Destination File
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={outputPath || 'Click choose to select destination output path...'}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={handleSelectDestination}
                    className="vnest-btn-secondary"
                    style={{ flexShrink: 0 }}
                  >
                    <FolderOpen size={14} />
                    <span>Choose</span>
                  </button>
                </div>

                {/* Overwrite Warning Banner */}
                {fileExists.exists && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                      color: 'var(--accent-yellow)',
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Warning:</strong> A file already exists at this destination (
                      {fileExists.size ? `${(fileExists.size / (1024 * 1024)).toFixed(1)} MB` : 'existing file'}).
                      Export will render to a safe temporary file and overwrite only after FFprobe verification passes.
                    </span>
                  </div>
                )}
              </div>

              {/* Pre-flight Validation Alerts */}
              {!validationResult.isValid && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '12px' }}>
                    <ShieldAlert size={15} />
                    <span>Export Pre-flight Checks Failed</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: 'var(--accent-rose)' }}>
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUEUE */}
          {activeTab === 'queue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Render Queue ({queueJobs.length} {queueJobs.length === 1 ? 'Job' : 'Jobs'})
                </span>
                {queueJobs.length > 0 && (
                  <button
                    onClick={() => ExportQueueManager.getInstance().clearFinishedJobs()}
                    className="vnest-btn-subtle"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    <Trash2 size={12} />
                    <span>Clear Finished</span>
                  </button>
                )}
              </div>

              {queueJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <ListOrdered size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
                    No Jobs in Render Queue
                  </p>
                  <p style={{ fontSize: '11px', margin: 0 }}>
                    Select your desired preset and click "Start Export" or "Add to Queue" to begin rendering.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {queueJobs.map((job) => (
                    <div
                      key={job.id}
                      className="vnest-card"
                      style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {job.projectName}
                            </span>
                            <span className="vnest-badge vnest-badge-indigo" style={{ fontSize: '10px' }}>
                              {job.preset.name}
                            </span>
                            {job.useProxies && (
                              <span className="vnest-badge" style={{ fontSize: '9px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)' }}>
                                Draft Proxy
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            {job.destinationPath}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="vnest-badge"
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              backgroundColor:
                                job.status === 'completed'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : job.status === 'failed'
                                  ? 'rgba(244, 63, 94, 0.2)'
                                  : job.status === 'cancelled'
                                  ? 'rgba(155, 155, 155, 0.2)'
                                  : job.status === 'validating'
                                  ? 'rgba(56, 189, 248, 0.2)'
                                  : 'rgba(155, 175, 155, 0.2)',
                              color:
                                job.status === 'completed'
                                  ? 'var(--accent-emerald)'
                                  : job.status === 'failed'
                                  ? 'var(--accent-rose)'
                                  : job.status === 'cancelled'
                                  ? 'var(--text-muted)'
                                  : job.status === 'validating'
                                  ? 'var(--accent-cyan)'
                                  : 'var(--accent-sage)',
                            }}
                          >
                            {job.status === 'rendering' && <Loader2 size={11} className="spin" style={{ marginRight: 4 }} />}
                            {job.status === 'validating' && <Loader2 size={11} className="spin" style={{ marginRight: 4 }} />}
                            {job.status === 'completed' && <CheckCircle2 size={11} style={{ marginRight: 4 }} />}
                            {job.status === 'failed' && <AlertCircle size={11} style={{ marginRight: 4 }} />}
                            <span style={{ textTransform: 'capitalize' }}>{job.status}</span>
                          </span>

                          {/* Action Buttons */}
                          {job.status === 'rendering' || job.status === 'validating' ? (
                            <button
                              onClick={() => ExportQueueManager.getInstance().cancelJob(job.id)}
                              className="vnest-btn-subtle"
                              style={{ color: 'var(--accent-rose)', padding: '4px 8px', fontSize: '11px' }}
                              title="Cancel Export"
                            >
                              <StopCircle size={13} />
                              <span>Cancel</span>
                            </button>
                          ) : job.status === 'failed' || job.status === 'cancelled' ? (
                            <button
                              onClick={() => ExportQueueManager.getInstance().retryJob(job.id)}
                              className="vnest-btn-subtle"
                              style={{ color: 'var(--accent-sage)', padding: '4px 8px', fontSize: '11px' }}
                              title="Retry Export"
                            >
                              <RotateCcw size={13} />
                              <span>Retry</span>
                            </button>
                          ) : job.status === 'completed' ? (
                            <button
                              onClick={() => window.vnestNative?.revealInFolder && window.vnestNative.revealInFolder(job.destinationPath)}
                              className="vnest-btn-subtle"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              title="Reveal file in Windows Explorer"
                            >
                              <ExternalLink size={13} />
                              <span>Reveal</span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => ExportQueueManager.getInstance().removeJob(job.id)}
                            className="vnest-btn-icon"
                            style={{ padding: '4px', color: 'var(--text-muted)' }}
                            title="Remove from queue"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Status Text */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{job.statusMessage}</span>
                          <span className="font-mono-time" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {job.progress}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${job.progress}%`,
                              transition: 'width 0.2s ease',
                              backgroundColor:
                                job.status === 'completed'
                                  ? 'var(--accent-emerald)'
                                  : job.status === 'failed'
                                  ? 'var(--accent-rose)'
                                  : 'var(--accent-sage)',
                            }}
                          />
                        </div>
                      </div>

                      {job.error && (
                        <p style={{ fontSize: '11px', color: 'var(--accent-rose)', margin: 0 }}>
                          Error: {job.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Export Log & Output Archive
                </span>
                {historyRecords.length > 0 && (
                  <button
                    onClick={() => {
                      ExportHistoryManager.clearHistory();
                      refreshHistory();
                    }}
                    className="vnest-btn-subtle"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    <Trash2 size={12} />
                    <span>Clear History</span>
                  </button>
                )}
              </div>

              {historyRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <History size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
                    No Export History Records
                  </p>
                  <p style={{ fontSize: '11px', margin: 0 }}>
                    Completed video exports will be logged here with output file size and resolution verification.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {historyRecords.map((item) => (
                    <div
                      key={item.id}
                      className="vnest-card"
                      style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.projectName}
                          </span>
                          <span className="vnest-badge vnest-badge-indigo" style={{ fontSize: '9px' }}>
                            {item.presetName}
                          </span>
                          <span
                            className="vnest-badge"
                            style={{
                              fontSize: '9px',
                              backgroundColor:
                                item.status === 'completed'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : item.status === 'failed'
                                  ? 'rgba(244, 63, 94, 0.2)'
                                  : 'rgba(155, 155, 155, 0.2)',
                              color:
                                item.status === 'completed'
                                  ? 'var(--accent-emerald)'
                                  : item.status === 'failed'
                                  ? 'var(--accent-rose)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>{item.width}x{item.height} @ {item.fps}fps</span>
                          <span>•</span>
                          <span>{item.codec}</span>
                          <span>•</span>
                          {item.fileSizeBytes ? (
                            <span>{(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                          ) : null}
                          <span>•</span>
                          <span>{new Date(item.completedAt).toLocaleString()}</span>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px' }}>
                          {item.destinationPath}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.status === 'completed' && (
                          <button
                            onClick={() => window.vnestNative?.revealInFolder && window.vnestNative.revealInFolder(item.destinationPath)}
                            className="vnest-btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            title="Open containing folder and highlight video in Windows Explorer"
                          >
                            <ExternalLink size={12} />
                            <span>Reveal</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            ExportHistoryManager.removeRecord(item.id);
                            refreshHistory();
                          }}
                          className="vnest-btn-icon"
                          style={{ padding: '4px', color: 'var(--text-muted)' }}
                          title="Delete from history"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {activeTab === 'settings' && (
              <span>
                Target: {effectivePreset.width}x{effectivePreset.height} @ {effectivePreset.fps}fps (
                {effectivePreset.codec})
              </span>
            )}
            {activeTab === 'queue' && (
              <span>
                {activeQueueCount > 0 ? `${activeQueueCount} render job(s) pending/active` : 'All queued jobs complete'}
              </span>
            )}
            {activeTab === 'history' && <span>{historyRecords.length} total logged export(s)</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onClose} className="vnest-btn-secondary">
              Close
            </button>

            {activeTab === 'settings' && (
              <>
                <button
                  disabled={!validationResult.isValid}
                  onClick={handleAddToQueue}
                  className="vnest-btn-secondary"
                  title="Add to background export queue"
                >
                  <ListOrdered size={13} />
                  <span>Add to Queue</span>
                </button>

                <button
                  disabled={!validationResult.isValid}
                  onClick={handleStartExportNow}
                  className="vnest-btn-primary"
                  title="Export immediately and monitor in queue"
                >
                  <Download size={14} />
                  <span>Start Export</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
