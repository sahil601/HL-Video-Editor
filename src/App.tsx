import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, AspectRatio, Clip, ProjectAsset, TransitionType, ProjectSummary, TimelineTool, Keyframe } from './types/project';
import {
  createDefaultProject,
  splitClipAtTime,
  splitClipWithFeedback,
  trimClipBoundary,
  moveClip,
  deleteClip,
  duplicateClip,
  calculateProjectDuration,
  freezeFrameClip,
  extractAudioFromClip,
} from './core/project';
import {
  rippleTrimClip,
  rollEditAdjacentClips,
  slipClip,
  slideClip,
} from './core/trimTools';
import {
  groupClips,
  ungroupClips,
  moveGroupClips,
  duplicateGroupClips,
  deleteGroupClips,
} from './core/clipGrouping';
import {
  toggleTrackLock,
  toggleTrackMute,
  toggleTrackVisibility,
  toggleTrackSolo,
} from './core/trackControls';
import { HistoryManager } from './core/commands';
import { stepFrame } from './core/time';
import { extractWaveformPeaksFromBlob } from './core/waveform';
import { SfxPreset, generateSfxAudioBlob } from './core/audioLibrary';
import { CheckCircle2, AlertTriangle, Info, X, Film, Sliders } from 'lucide-react';
import {
  WorkspaceLayout,
  loadSavedWorkspaceLayout,
  saveWorkspaceLayout,
  clampWorkspaceLayout,
  resetWorkspaceLayout,
} from './core/workspaceLayout';
import { HomeScreen } from './components/home/HomeScreen';
import { Header } from './components/header/Header';
import { MediaLibrary } from './components/library/MediaLibrary';
import { PreviewPlayer } from './components/preview/PreviewPlayer';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { Timeline } from './components/timeline/Timeline';
import { ExportModal } from './components/modals/ExportModal';
import { ShareModal } from './components/modals/ShareModal';
import { OpenSharedModal } from './components/modals/OpenSharedModal';
import { extractVnestPackage } from './core/package';
import { AutoCaptionsModal } from './components/modals/AutoCaptionsModal';
import { AutoCutModal } from './components/modals/AutoCutModal';
import { WatermarkModal } from './components/modals/WatermarkModal';
import { MediaInspectorModal } from './components/modals/MediaInspectorModal';
import { RelinkMediaModal } from './components/modals/RelinkMediaModal';
import { RecoveryModal } from './components/modals/RecoveryModal';
import { CacheManagerModal } from './components/modals/CacheManagerModal';
import { RecoveryManager } from './core/recovery';
import { isProxyEligible, DEFAULT_PROXY_SETTINGS } from './core/proxy';
import { invalidateAssetCaches } from './core/cache';
import { applyAutoCutsToTimeline } from './core/autoCut';
import { applyCaptionsToProject } from './core/captions/projectCaptions';
import { CaptionSegment, CaptionStyle } from './core/captions/types';
import { VoiceOverModal } from './components/modals/VoiceOverModal';
import { ElementPresetDefinition } from './core/elements/elementDefinitions';
import { OverlayPresetDefinition, generateOverlaySvg, rasterizeOverlayToPngBlob } from './core/overlays/overlayDefinitions';
import { VideoEffectType, ProposedCut, WatermarkRemoverSettings, ProxyQuality, ProxySettings } from './types/project';
import { createEffect } from './core/effects/effectDefinitions';
import { createTransition } from './core/transitions/transitionDefinitions';


export const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [project, setProject] = useState<Project>(() => createDefaultProject());
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<TimelineTool>('select');

  // Playback state
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastPlayTimeRef = useRef<number>(0);

  // Asset in-memory maps & proxies
  const [assetBinaryMap, setAssetBinaryMap] = useState<Map<string, Blob>>(new Map());
  const [assetUrlMap, setAssetUrlMap] = useState<Map<string, string>>(new Map());
  const [proxyUrlMap, setProxyUrlMap] = useState<Map<string, string>>(new Map());

  // Undo / Redo History
  const historyRef = useRef<HistoryManager>(new HistoryManager(50));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'autosaved' | 'error'>('saved');

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isOpenSharedOpen, setIsOpenSharedOpen] = useState(false);
  const [isAutoCaptionsOpen, setIsAutoCaptionsOpen] = useState(false);
  const [isVoiceOverOpen, setIsVoiceOverOpen] = useState(false);
  const [isAutoCutOpen, setIsAutoCutOpen] = useState(false);
  const [isWatermarkOpen, setIsWatermarkOpen] = useState(false);
  const [isMediaInspectorOpen, setIsMediaInspectorOpen] = useState(false);
  const [inspectedAsset, setInspectedAsset] = useState<ProjectAsset | null>(null);
  const [isRelinkOpen, setIsRelinkOpen] = useState(false);
  const [relinkInitialAssetId, setRelinkInitialAssetId] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [isAbnormalShutdown, setIsAbnormalShutdown] = useState(false);
  const [isCacheManagerOpen, setIsCacheManagerOpen] = useState(false);
  const [initialSharedBuffer, setInitialSharedBuffer] = useState<ArrayBuffer | null>(null);
  const [pendingSharedFilePath, setPendingSharedFilePath] = useState<string | null>(null);

  // Workspace Layout (Resizable sidebars, timeline, collapse states, fullscreen)
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadSavedWorkspaceLayout());
  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);
  const resizeStartPosRef = useRef({ mouseX: 0, initialWidth: 0 });

  // Visual Theme ('charcoal' | 'light')
  const [theme, setTheme] = useState<'charcoal' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('hl_theme');
      return saved === 'light' ? 'light' : 'charcoal';
    } catch {
      return 'charcoal';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('hl_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'charcoal' ? 'light' : 'charcoal'));
  }, []);

  // User feedback toast notifications (for split operations, errors, actions)
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 4500);
  }, []);

  // Workspace layout persistence and event listeners
  useEffect(() => {
    saveWorkspaceLayout(layout);
    try {
      localStorage.setItem('vnest_timeline_height', String(layout.timelineHeight));
    } catch {}
  }, [layout]);

  useEffect(() => {
    const handleWinResize = () => {
      setLayout((prev) => clampWorkspaceLayout(prev, window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && layout.isFullscreenPreview) {
        setLayout((prev) => ({ ...prev, isFullscreenPreview: false }));
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [layout.isFullscreenPreview]);

  const handleStartResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setResizingSide(side);
    resizeStartPosRef.current = {
      mouseX: e.clientX,
      initialWidth: side === 'left' ? layout.leftWidth : layout.rightWidth,
    };
  };

  useEffect(() => {
    if (!resizingSide) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartPosRef.current.mouseX;
      setLayout((prev) => {
        if (resizingSide === 'left') {
          const newW = resizeStartPosRef.current.initialWidth + deltaX;
          return clampWorkspaceLayout({ ...prev, leftWidth: newW }, window.innerWidth, window.innerHeight);
        } else {
          const newW = resizeStartPosRef.current.initialWidth - deltaX;
          return clampWorkspaceLayout({ ...prev, rightWidth: newW }, window.innerWidth, window.innerHeight);
        }
      });
    };

    const handleMouseUp = () => {
      setResizingSide(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingSide]);

  const handleResetLayout = useCallback(() => {
    const fresh = resetWorkspaceLayout(window.innerWidth, window.innerHeight);
    setLayout(fresh);
    showToast('Workspace layout reset to default', 'info');
  }, [showToast]);

  const toggleLeftCollapse = useCallback(() => {
    setLayout((prev) => ({ ...prev, isLeftCollapsed: !prev.isLeftCollapsed }));
  }, []);

  const toggleRightCollapse = useCallback(() => {
    setLayout((prev) => ({ ...prev, isRightCollapsed: !prev.isRightCollapsed }));
  }, []);

  const toggleTimelineCollapse = useCallback(() => {
    setLayout((prev) => ({ ...prev, isTimelineCollapsed: !prev.isTimelineCollapsed }));
  }, []);

  const toggleFullscreenPreview = useCallback(() => {
    setLayout((prev) => ({ ...prev, isFullscreenPreview: !prev.isFullscreenPreview }));
  }, []);

  // Recent Projects from localStorage
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>(() => {
    try {
      const saved = localStorage.getItem('vnest_recent_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Centralized helper to add or update recent project record
  const addToRecentProjects = useCallback((proj: Project, filePath?: string) => {
    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== proj.id);
      const totalClips = proj.tracks.reduce((sum, t) => sum + t.clips.length, 0);
      const summary: ProjectSummary = {
        id: proj.id,
        name: proj.name,
        updatedAt: new Date().toISOString(),
        durationMs: proj.durationMs,
        clipCount: totalClips,
        assetCount: proj.assets.length,
        filePath: filePath || proj.filePath,
      };
      const updatedList = [summary, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('vnest_recent_projects', JSON.stringify(updatedList));
      } catch {}
      return updatedList;
    });
  }, []);

  const [hasUnsavedRecovery, setHasUnsavedRecovery] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('vnest_autosave');
    } catch {
      return false;
    }
  });

  // Update undo/redo availability
  const updateHistoryAvailability = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  // Mutate project with history snapshot
  const mutateProject = useCallback(
    (updater: (prev: Project) => Project, actionName: string) => {
      setProject((prev) => {
        historyRef.current.push(prev, actionName);
        const next = updater(prev);
        setSaveStatus('unsaved');
        return next;
      });
      setCanUndo(true);
      setCanRedo(false);
    },
    []
  );

  // Undo action
  const handleUndo = useCallback(() => {
    const res = historyRef.current.undo(project);
    if (res) {
      setProject(res.project);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
      setSaveStatus('unsaved');
      showToast(`Undo: ${res.description}`, 'info');
    }
  }, [project, showToast]);

  // Redo action
  const handleRedo = useCallback(() => {
    const res = historyRef.current.redo(project);
    if (res) {
      setProject(res.project);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
      setSaveStatus('unsaved');
      showToast(`Redo: ${res.description}`, 'info');
    }
  }, [project, showToast]);

  // Startup check: detect abnormal shutdown
  useEffect(() => {
    const abnormal = RecoveryManager.detectAbnormalShutdown();
    if (abnormal) {
      setIsAbnormalShutdown(true);
      setIsRecoveryOpen(true);
      showToast(`Recoverable project snapshot found for "${abnormal.lock.projectName}" from prior session`, 'warning');
    }
  }, [showToast]);

  // Listen to native FFmpeg proxy generation progress events
  useEffect(() => {
    if (window.vnestNative?.onProxyProgress) {
      const cleanup = window.vnestNative.onProxyProgress(({ jobId, percent }) => {
        setProject((prev) => ({
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === jobId
              ? { ...a, proxyProgress: percent, proxyStatus: 'generating' }
              : a
          ),
        }));
      });
      return cleanup;
    }
  }, []);

  // Configurable Autosave Engine (30s, 60s, 120s, 300s, or 0=Off)
  useEffect(() => {
    const intervalSec = project.autosaveIntervalSec ?? 60;
    if (intervalSec <= 0 || saveStatus !== 'unsaved') return;

    const timer = setTimeout(() => {
      try {
        setSaveStatus('saving');
        const res = RecoveryManager.saveSnapshot(project, 'autosave');
        if (!res.success) {
          setSaveStatus('error');
          showToast(`Autosave warning: ${res.error || 'Failed to save snapshot'}`, 'warning');
          return;
        }

        // Persist to vnest_project_${project.id} so this project is permanently openable from recents
        try {
          localStorage.setItem(`vnest_project_${project.id}`, JSON.stringify(project));
        } catch {}

        // Also update recent projects index
        addToRecentProjects(project);

        localStorage.setItem('vnest_autosave', JSON.stringify(project));
        setSaveStatus('autosaved');
        setHasUnsavedRecovery(true);
      } catch (e: any) {
        console.warn('Autosave failed:', e);
        setSaveStatus('error');
      }
    }, intervalSec * 1000);

    return () => clearTimeout(timer);
  }, [project, saveStatus, showToast, addToRecentProjects]);

  // Playback requestAnimationFrame loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastPlayTimeRef.current = performance.now();

    const loop = (now: number) => {
      const delta = now - lastPlayTimeRef.current;
      lastPlayTimeRef.current = now;

      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= project.durationMs && project.durationMs > 0) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, project.durationMs]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSplitClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteClip();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateClip();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        handleNativeImport();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        setIsAutoCutOpen(true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTimeMs((t) => stepFrame(t, project.settings.fps, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTimeMs((t) => stepFrame(t, project.settings.fps, 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, project.settings.fps]);

  // Selected Clip object
  let selectedClip: Clip | null = null;
  if (selectedClipId) {
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === selectedClipId);
      if (found) {
        selectedClip = found;
        break;
      }
    }
  }

  // 1. New Project
  const handleNewProject = (aspectRatio: AspectRatio, name: string) => {
    const newProj = createDefaultProject(name, aspectRatio);
    setProject(newProj);
    historyRef.current.clear();
    updateHistoryAvailability();
    setSelectedClipId(null);
    setCurrentTimeMs(0);
    setIsPlaying(false);
    setView('editor');
  };

  // 2. Open Project File
  const handleOpenProjectFile = async () => {
    if (window.vnestNative?.selectOpenProject) {
      const result = await window.vnestNative.selectOpenProject();
      if (result && result.buffer) {
        setInitialSharedBuffer(result.buffer);
        setPendingSharedFilePath(result.filePath);
        setIsOpenSharedOpen(true);
      }
    } else {
      setInitialSharedBuffer(null);
      setPendingSharedFilePath(null);
      setIsOpenSharedOpen(true);
    }
  };

  // 3. Save Project
  const handleSaveProject = () => {
    try {
      localStorage.setItem(`vnest_project_${project.id}`, JSON.stringify(project));
      RecoveryManager.saveSnapshot(project, 'manual');
      RecoveryManager.markSessionClean();
      setSaveStatus('saved');
      addToRecentProjects(project);
      showToast('Project saved successfully', 'success');
    } catch (e: any) {
      console.warn('Local save error', e);
      setSaveStatus('error');
      showToast(`Save failed: ${e?.message || 'Storage write error'}`, 'warning');
    }
  };

  // 3b. Open Recent Project
  const handleSelectRecent = useCallback(
    async (id: string, explicitFilePath?: string) => {
      const summary = recentProjects.find((p) => p.id === id);
      const targetFilePath = explicitFilePath || summary?.filePath;

      // Case A: Recent entry has an associated .vnest file path on disk
      if (targetFilePath) {
        if (window.vnestNative?.readFileBinary) {
          try {
            const fileRes = await window.vnestNative.readFileBinary(targetFilePath);
            if (!fileRes.success || !fileRes.buffer) {
              showToast(`Project file not found at: ${targetFilePath}`, 'warning');
              return;
            }
            const { project: loadedProj, extractedAssets } = await extractVnestPackage(fileRes.buffer);
            const finalProj: Project = { ...loadedProj, filePath: targetFilePath };
            setProject(finalProj);
            const urls = new Map<string, string>();
            const blobs = new Map<string, Blob>();
            extractedAssets.forEach((val, assetId) => {
              urls.set(assetId, val.url);
              blobs.set(assetId, val.blob);
            });
            setAssetUrlMap(urls);
            setAssetBinaryMap(blobs);
            setSelectedClipId(null);
            setCurrentTimeMs(0);
            setIsPlaying(false);
            historyRef.current.clear();
            updateHistoryAvailability();
            addToRecentProjects(finalProj, targetFilePath);
            setView('editor');
            showToast(`Opened project "${finalProj.name}"`, 'success');
            return;
          } catch (err: any) {
            showToast(`Failed to open project file: ${err?.message || 'Invalid or corrupted file'}`, 'warning');
            return;
          }
        } else {
          showToast('Native file system not available to open .vnest package', 'warning');
          return;
        }
      }

      // Case B: Load from localStorage under vnest_project_${id}
      const saved = localStorage.getItem(`vnest_project_${id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setProject(parsed);
          setSelectedClipId(null);
          setCurrentTimeMs(0);
          setIsPlaying(false);
          historyRef.current.clear();
          updateHistoryAvailability();
          addToRecentProjects(parsed);
          setView('editor');
          showToast(`Opened project "${parsed.name}"`, 'success');
          return;
        } catch (err: any) {
          showToast(`Failed to parse saved project: ${err?.message || 'Corrupted data'}`, 'warning');
          return;
        }
      }

      // Case C: Fallback to vnest_autosave if ID matches
      const autosaveRaw = localStorage.getItem('vnest_autosave');
      if (autosaveRaw) {
        try {
          const autosave = JSON.parse(autosaveRaw);
          if (autosave.id === id) {
            setProject(autosave);
            try {
              localStorage.setItem(`vnest_project_${id}`, autosaveRaw);
            } catch {}
            setSelectedClipId(null);
            setCurrentTimeMs(0);
            setIsPlaying(false);
            historyRef.current.clear();
            updateHistoryAvailability();
            addToRecentProjects(autosave);
            setView('editor');
            showToast(`Opened project "${autosave.name}" from autosave`, 'success');
            return;
          }
        } catch {}
      }

      // Case D: Fallback to RecoveryManager snapshots if snapshot matches
      const snapshots = RecoveryManager.getSnapshots();
      const snap = snapshots.find((s) => s.projectId === id);
      if (snap) {
        const snapProj = RecoveryManager.getSnapshotProject(snap.id);
        if (snapProj) {
          setProject(snapProj);
          try {
            localStorage.setItem(`vnest_project_${id}`, JSON.stringify(snapProj));
          } catch {}
          setSelectedClipId(null);
          setCurrentTimeMs(0);
          setIsPlaying(false);
          historyRef.current.clear();
          updateHistoryAvailability();
          addToRecentProjects(snapProj);
          setView('editor');
          showToast(`Opened project "${snapProj.name}" from recovery snapshot`, 'success');
          return;
        }
      }

      // Case E: Project file / saved payload was not found anywhere
      const projName = summary?.name || 'Project';
      showToast(`Project data or file not found for "${projName}"`, 'warning');
    },
    [recentProjects, addToRecentProjects, showToast]
  );

  // 3b. Generate Proxy Media (Phase 7)
  const handleGenerateProxy = async (asset: ProjectAsset, qualityOverride?: ProxyQuality) => {
    const quality = qualityOverride || project.proxySettings?.quality || '540p';
    if (!asset.originalPath) {
      showToast('Cannot generate proxy: source file path is missing', 'warning');
      return;
    }

    setProject((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.id === asset.id
          ? { ...a, proxyStatus: 'generating', proxyProgress: 0, proxyQuality: quality, proxyError: undefined }
          : a
      ),
    }));

    if (window.vnestNative?.generateProxy) {
      const durationSec = Math.max(1, Math.round(asset.durationMs / 1000));
      const res = await window.vnestNative.generateProxy(asset.id, asset.originalPath, quality, durationSec);
      if (res.success && res.proxyPath) {
        if (window.vnestNative.readFileBinary) {
          try {
            const fileRes = await window.vnestNative.readFileBinary(res.proxyPath);
            if (fileRes.success && fileRes.buffer) {
              const blob = new Blob([fileRes.buffer], { type: 'video/mp4' });
              const blobUrl = URL.createObjectURL(blob);
              setProxyUrlMap((prev) => new Map(prev).set(asset.id, blobUrl));
            }
          } catch (e) {}
        }

        setProject((prev) => ({
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === asset.id
              ? {
                  ...a,
                  proxyStatus: 'ready',
                  proxyPath: res.proxyPath,
                  proxyFileSize: res.fileSize,
                  proxyProgress: 100,
                  proxyQuality: quality,
                }
              : a
          ),
        }));
        invalidateAssetCaches(asset.id);
        showToast(`Proxy generated (${quality}) for ${asset.name}`, 'success');
      } else {
        setProject((prev) => ({
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === asset.id
              ? { ...a, proxyStatus: 'error', proxyError: res.error || 'Generation failed' }
              : a
          ),
        }));
        showToast(`Proxy generation failed: ${res.error || 'FFmpeg error'}`, 'warning');
      }
    } else {
      // Browser simulation mode
      showToast(`Generating simulated proxy (${quality})...`, 'info');
      for (let p = 20; p <= 100; p += 20) {
        await new Promise((r) => setTimeout(r, 80));
        setProject((prev) => ({
          ...prev,
          assets: prev.assets.map((a) => (a.id === asset.id ? { ...a, proxyProgress: p } : a)),
        }));
      }
      setProject((prev) => ({
        ...prev,
        assets: prev.assets.map((a) =>
          a.id === asset.id
            ? { ...a, proxyStatus: 'ready', proxyPath: `C:\\Proxies\\${asset.id}_${quality}.mp4`, proxyProgress: 100, proxyQuality: quality }
            : a
        ),
      }));
      showToast(`Proxy generated (${quality}) for ${asset.name}`, 'success');
    }
  };

  // 3c. Cancel Active Proxy Generation
  const handleCancelProxy = async (assetId: string) => {
    if (window.vnestNative?.cancelProxyJob) {
      await window.vnestNative.cancelProxyJob(assetId);
    }
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.id === assetId
          ? { ...a, proxyStatus: 'none', proxyProgress: 0, proxyError: undefined }
          : a
      ),
    }));
    showToast('Proxy generation cancelled', 'info');
  };

  // 3d. Delete Existing Proxy File
  const handleDeleteProxy = async (asset: ProjectAsset) => {
    if (asset.proxyPath && window.vnestNative?.deleteProxyFile) {
      await window.vnestNative.deleteProxyFile(asset.proxyPath);
    }
    setProxyUrlMap((prev) => {
      const next = new Map(prev);
      next.delete(asset.id);
      return next;
    });
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.id === asset.id
          ? { ...a, proxyStatus: 'none', proxyPath: undefined, proxyFileSize: undefined, proxyProgress: undefined }
          : a
      ),
    }));
    invalidateAssetCaches(asset.id);
    showToast(`Proxy deleted for ${asset.name}`, 'info');
  };

  // 3e. Restore Project from Recovery Snapshot
  const handleRestoreProject = (restoredProject: Project) => {
    setProject(restoredProject);
    historyRef.current.clear();
    updateHistoryAvailability();
    setSelectedClipId(null);
    setCurrentTimeMs(0);
    setIsPlaying(false);
    setSaveStatus('saved');
    setView('editor');
    showToast(`Restored snapshot: "${restoredProject.name}"`, 'success');
  };

  // 3f. Update Relinked Project State
  const handleRelinkProject = (updatedProject: Project, message: string) => {
    mutateProject(() => updatedProject, 'Relink Media');
    showToast(message, 'success');
  };

  // 4. Recover Unsaved Project
  const handleRecoverUnsaved = () => {
    try {
      const saved = localStorage.getItem('vnest_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        setProject(parsed);
        historyRef.current.clear();
        updateHistoryAvailability();
        setView('editor');
      }
    } catch (e) {
      console.error('Failed to recover project', e);
    }
  };

  // 5. Load Demo Template
  const handleLoadTemplate = () => {
    const demo = createDefaultProject('Vlog Demo Project', '16:9');
    demo.tracks[0].clips = [
      {
        id: 'clip_txt_intro',
        trackId: 'track_text_1',
        name: 'Welcome to VNest',
        type: 'text',
        startMs: 500,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: -10, scale: 1.2, rotation: 0, opacity: 1.0 },
        keyframes: [
          { id: 'kf_1', offsetMs: 0, properties: { opacity: 0, scale: 0.8 }, easing: 'easeOut' },
          { id: 'kf_2', offsetMs: 800, properties: { opacity: 1, scale: 1.2 }, easing: 'linear' },
        ],
        textProperties: {
          text: 'VNEST VIDEO EDITOR',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 44,
          color: '#facc15',
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
        },
      },
      {
        id: 'clip_txt_sub',
        trackId: 'track_text_1',
        name: 'Subtitle',
        type: 'text',
        startMs: 5000,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 35, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
        textProperties: {
          text: 'Multi-Track Magnetic Timeline',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 28,
          color: '#ffffff',
          textAlign: 'center',
          backgroundColor: 'rgba(99,102,241,0.85)',
        },
      },
    ];

    demo.tracks[2].clips = [
      {
        id: 'clip_v1',
        trackId: 'track_video_main',
        name: 'Scenic Flight (Sample)',
        type: 'video',
        startMs: 0,
        durationMs: 6000,
        sourceStartMs: 0,
        sourceEndMs: 6000,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 500,
        fadeOutMs: 500,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      },
      {
        id: 'clip_v2',
        trackId: 'track_video_main',
        name: 'Coastal Beach Cut (Sample)',
        type: 'video',
        startMs: 6000,
        durationMs: 5000,
        sourceStartMs: 0,
        sourceEndMs: 5000,
        speed: 1.5,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      },
    ];

    demo.durationMs = calculateProjectDuration(demo.tracks);
    setProject(demo);
    historyRef.current.clear();
    updateHistoryAvailability();
    setView('editor');
  };

  // 6. Split Clip with Visual & Actionable Feedback
  const handleSplitClip = () => {
    const res = splitClipWithFeedback(project, selectedClipId, currentTimeMs, project.settings.fps);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }

    mutateProject(() => res.project, 'Split Clip');
    if (res.newClipId) {
      setSelectedClipId(res.newClipId);
    }
    showToast(res.message, 'success');
  };


  // 7. Delete Clip(s)
  const handleDeleteClip = () => {
    if (selectedClip?.groupId) {
      const gId = selectedClip.groupId;
      setSelectedClipId(null);
      setSelectedClipIds([]);
      mutateProject((prev) => {
        const res = deleteGroupClips(prev, gId);
        return res.success ? res.project : prev;
      }, 'Delete Clip Group');
      showToast('Deleted grouped clips', 'info');
      return;
    }
    if (selectedClipIds.length > 1) {
      const ids = [...selectedClipIds];
      setSelectedClipId(null);
      setSelectedClipIds([]);
      mutateProject((prev) => {
        let p = prev;
        for (const id of ids) {
          p = deleteClip(p, id);
        }
        return p;
      }, 'Delete Selected Clips');
      showToast(`Deleted ${ids.length} clips`, 'info');
      return;
    }
    if (!selectedClipId) return;
    const clipId = selectedClipId;
    setSelectedClipId(null);
    setSelectedClipIds([]);
    mutateProject((prev) => deleteClip(prev, clipId), 'Delete Clip');
  };

  // 8. Duplicate Clip(s)
  const handleDuplicateClip = () => {
    if (selectedClip?.groupId) {
      mutateProject((prev) => {
        const res = duplicateGroupClips(prev, selectedClip!.groupId!);
        if (res.success && res.newClipIds) {
          setSelectedClipIds(res.newClipIds);
          if (res.newClipIds.length > 0) setSelectedClipId(res.newClipIds[0]);
          return res.project;
        }
        return prev;
      }, 'Duplicate Clip Group');
      showToast('Duplicated grouped clips', 'success');
      return;
    }
    if (!selectedClipId) return;
    mutateProject((prev) => duplicateClip(prev, selectedClipId), 'Duplicate Clip');
  };

  // Professional Trim Tools (Phase 5)
  const handleRippleTrim = (clipId: string, side: 'left' | 'right', deltaMs: number) => {
    const res = rippleTrimClip(project, clipId, side, deltaMs);
    if (!res.success) {
      showToast(res.message || 'Cannot ripple trim clip', 'warning');
      return;
    }
    mutateProject(() => res.project, `Ripple Trim ${side === 'left' ? 'Head' : 'Tail'}`);
    showToast(res.message || 'Ripple trim applied', 'success');
  };

  const handleRollEdit = (clipIdA: string, clipIdB: string, deltaMs: number) => {
    const res = rollEditAdjacentClips(project, clipIdA, clipIdB, deltaMs);
    if (!res.success) {
      showToast(res.message || 'Cannot roll edit clips', 'warning');
      return;
    }
    mutateProject(() => res.project, 'Roll Edit');
    showToast(res.message || 'Roll edit applied', 'success');
  };

  const handleSlipEdit = (clipId: string, deltaMs: number) => {
    const res = slipClip(project, clipId, deltaMs);
    if (!res.success) {
      showToast(res.message || 'Cannot slip clip', 'warning');
      return;
    }
    mutateProject(() => res.project, 'Slip Edit');
    showToast(res.message || 'Slip edit applied', 'success');
  };

  const handleSlideEdit = (clipId: string, deltaMs: number) => {
    const res = slideClip(project, clipId, deltaMs);
    if (!res.success) {
      showToast(res.message || 'Cannot slide clip', 'warning');
      return;
    }
    mutateProject(() => res.project, 'Slide Edit');
    showToast(res.message || 'Slide edit applied', 'success');
  };

  // Clip Grouping (Phase 5)
  const handleGroupClips = () => {
    const idsToGroup = selectedClipIds.length > 1 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    if (idsToGroup.length < 2) {
      showToast('Select 2 or more clips to group (Ctrl+Click)', 'warning');
      return;
    }
    const res = groupClips(project, idsToGroup);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }
    mutateProject(() => res.project, 'Group Clips');
    showToast(res.message, 'success');
  };

  const handleUngroupClips = () => {
    const idsToUngroup = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    if (idsToUngroup.length === 0) {
      showToast('Select a grouped clip to ungroup', 'warning');
      return;
    }
    const res = ungroupClips(project, idsToUngroup);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }
    mutateProject(() => res.project, 'Ungroup Clips');
    showToast(res.message, 'success');
  };

  const handleMoveGroup = (groupId: string, deltaMs: number) => {
    const res = moveGroupClips(project, groupId, deltaMs);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }
    mutateProject(() => res.project, 'Move Group');
  };

  // Track Controls (Phase 5)
  const handleToggleTrackLock = (trackId: string) => {
    mutateProject((prev) => toggleTrackLock(prev, trackId), 'Toggle Track Lock');
  };

  const handleToggleTrackMute = (trackId: string) => {
    mutateProject((prev) => toggleTrackMute(prev, trackId), 'Toggle Track Mute');
  };

  const handleToggleTrackVisibility = (trackId: string) => {
    mutateProject((prev) => toggleTrackVisibility(prev, trackId), 'Toggle Track Visibility');
  };

  const handleToggleTrackSolo = (trackId: string) => {
    mutateProject((prev) => toggleTrackSolo(prev, trackId), 'Toggle Track Solo');
  };

  // Keyframe Graph Editor (Phase 5)
  const handleUpdateKeyframes = (clipId: string, keyframes: Keyframe[]) => {
    mutateProject((prev) => {
      const tracks = prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === clipId ? { ...c, keyframes } : c)),
      }));
      return { ...prev, tracks };
    }, 'Update Keyframes');
  };

  // 8b. Freeze Frame
  const handleFreezeFrame = () => {
    if (!selectedClipId) {
      showToast('Select a clip to freeze frame', 'warning');
      return;
    }
    const res = freezeFrameClip(project, selectedClipId, currentTimeMs);
    if (!res) {
      showToast('Playhead must be over the selected clip to freeze frame', 'warning');
      return;
    }
    mutateProject(() => res.project, 'Freeze Frame');
    setSelectedClipId(res.freezeClipId);
    showToast('Created 3s freeze frame clip', 'success');
  };

  // 8c. Extract Audio
  const handleExtractAudio = (clipIdToExtract?: string) => {
    const targetClipId = clipIdToExtract || selectedClipId;
    if (!targetClipId) {
      showToast('Select a video clip to extract audio', 'warning');
      return;
    }
    const res = extractAudioFromClip(project, targetClipId);
    if (!res) {
      showToast('Selected clip has no audio or is already an audio clip', 'warning');
      return;
    }
    mutateProject(() => res.project, 'Extract Audio');
    setSelectedClipId(res.audioClipId);
    showToast('Extracted audio to audio track', 'success');
  };

  // 9. Move Clip
  const handleUpdateClipPosition = (clipId: string, newStartMs: number, trackId: string) => {
    setProject((prev) => moveClip(prev, clipId, trackId, newStartMs));
    setSaveStatus('unsaved');
  };

  // 10. Trim Clip
  const handleTrimClip = (clipId: string, side: 'left' | 'right', deltaMs: number) => {
    setProject((prev) => trimClipBoundary(prev, clipId, side, deltaMs));
    setSaveStatus('unsaved');
  };

  // 11. Import Media
  const handleImportFiles = async (files: FileList | File[]) => {
    try {
      const newAssets: ProjectAsset[] = [];
      const newBinaryMap = new Map(assetBinaryMap);
      const newUrlMap = new Map(assetUrlMap);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const assetId = 'asset_' + Math.random().toString(36).substring(2, 9);
        const isVideo = file.type.startsWith('video');
        const isAudio = file.type.startsWith('audio');
        const isImage = file.type.startsWith('image');

        const url = URL.createObjectURL(file);
        newBinaryMap.set(assetId, file);
        newUrlMap.set(assetId, url);

        let durationMs = 5000;
        let width: number | undefined;
        let height: number | undefined;

        if (isVideo) {
          const probeVid = document.createElement('video');
          probeVid.src = url;
          await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 1200);
            probeVid.onloadedmetadata = () => {
              clearTimeout(timer);
              if (probeVid.duration && !isNaN(probeVid.duration)) {
                durationMs = Math.round(probeVid.duration * 1000);
              }
              width = probeVid.videoWidth;
              height = probeVid.videoHeight;
              resolve(null);
            };
            probeVid.onerror = () => {
              clearTimeout(timer);
              resolve(null);
            };
          });
        } else if (isAudio) {
          const probeAudio = document.createElement('audio');
          probeAudio.src = url;
          await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 1200);
            probeAudio.onloadedmetadata = () => {
              clearTimeout(timer);
              if (probeAudio.duration && !isNaN(probeAudio.duration)) {
                durationMs = Math.round(probeAudio.duration * 1000);
              }
              resolve(null);
            };
            probeAudio.onerror = () => {
              clearTimeout(timer);
              resolve(null);
            };
          });
        } else if (isImage) {
          durationMs = 5000;
          const probeImg = new Image();
          probeImg.src = url;
          await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 1200);
            probeImg.onload = () => {
              clearTimeout(timer);
              width = probeImg.naturalWidth;
              height = probeImg.naturalHeight;
              resolve(null);
            };
            probeImg.onerror = () => {
              clearTimeout(timer);
              resolve(null);
            };
          });
        }

        let waveformPeaks: number[] | undefined;
        if (isAudio || isVideo) {
          try {
            waveformPeaks = await extractWaveformPeaksFromBlob(file, 200);
          } catch (err) {
            console.warn('Failed to extract waveform peaks for imported file:', err);
            waveformPeaks = undefined;
          }
        }

        newAssets.push({
          id: assetId,
          name: file.name,
          type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
          relativePath: `assets/${assetId}_${file.name}`,
          originalPath: (file as any).path || file.name,
          fileSize: file.size,
          durationMs,
          width,
          height,
          fps: 30,
          isBundled: true,
          blobUrl: url,
          waveformPeaks,
        });
      }

      setAssetBinaryMap(newBinaryMap);
      setAssetUrlMap(newUrlMap);

      mutateProject(
        (prev) => ({
          ...prev,
          assets: [...prev.assets, ...newAssets],
        }),
        'Import Media'
      );
    } catch (err: any) {
      console.error('Import processing error:', err);
      showToast(`Failed to process imported files: ${err?.message || 'Unknown error'}`, 'warning');
    }
  };

  // 11b. Native Desktop Media Import via Electron Open Dialog
  const handleNativeImport = async () => {
    try {
      if (window.vnestNative?.selectMediaFiles) {
        const filePaths = await window.vnestNative.selectMediaFiles();
        if (!filePaths || filePaths.length === 0) {
          return; // User canceled dialog
        }

        const filesToImport: File[] = [];
        for (const filePath of filePaths) {
          try {
            const res = await window.vnestNative.readFileBinary(filePath);
            if (!res.success || !res.buffer) {
              console.error(`Failed to read file binary for ${filePath}:`, res.error);
              showToast(`Could not read file: ${filePath} (${res.error || 'Read error'})`, 'warning');
              continue;
            }

            const fileName = filePath.split(/[/\\]/).pop() || 'media_file';
            const ext = fileName.split('.').pop()?.toLowerCase() || '';

            let mimeType = 'application/octet-stream';
            if (['mp4', 'm4v', 'ts'].includes(ext)) mimeType = 'video/mp4';
            else if (['mov', 'quicktime'].includes(ext)) mimeType = 'video/quicktime';
            else if (['mkv'].includes(ext)) mimeType = 'video/x-matroska';
            else if (['webm'].includes(ext)) mimeType = 'video/webm';
            else if (['avi'].includes(ext)) mimeType = 'video/x-msvideo';
            else if (['mp3'].includes(ext)) mimeType = 'audio/mpeg';
            else if (['wav'].includes(ext)) mimeType = 'audio/wav';
            else if (['aac'].includes(ext)) mimeType = 'audio/aac';
            else if (['m4a'].includes(ext)) mimeType = 'audio/mp4';
            else if (['ogg', 'oga'].includes(ext)) mimeType = 'audio/ogg';
            else if (['flac'].includes(ext)) mimeType = 'audio/flac';
            else if (['png'].includes(ext)) mimeType = 'image/png';
            else if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
            else if (['webp'].includes(ext)) mimeType = 'image/webp';
            else if (['gif'].includes(ext)) mimeType = 'image/gif';
            else if (['svg'].includes(ext)) mimeType = 'image/svg+xml';
            else if (['bmp'].includes(ext)) mimeType = 'image/bmp';

            const file = new File([res.buffer], fileName, { type: mimeType });
            Object.defineProperty(file, 'path', {
              value: filePath,
              writable: false,
            });
            filesToImport.push(file);
          } catch (fileErr: any) {
            console.error(`Error reading ${filePath}:`, fileErr);
            showToast(`Error importing ${filePath}: ${fileErr.message}`, 'warning');
          }
        }

        if (filesToImport.length > 0) {
          await handleImportFiles(filesToImport);
          showToast(`Imported ${filesToImport.length} media file${filesToImport.length > 1 ? 's' : ''}!`, 'success');
        }
      } else {
        // Fallback for browser mode
        const inputEl = document.getElementById('media-file-input') as HTMLInputElement | null;
        if (inputEl) {
          inputEl.click();
        } else {
          showToast('Native file dialog is not supported in this environment', 'warning');
        }
      }
    } catch (err: any) {
      console.error('Native import failed:', err);
      showToast(`Import failed: ${err.message || 'Unknown error'}`, 'warning');
    }
  };

  // Add Asset to Timeline
  const handleAddAssetToTimeline = (asset: ProjectAsset) => {
    let targetTrack = project.tracks.find((t) =>
      asset.type === 'audio' ? t.type === 'audio' : t.type === 'video'
    );
    if (!targetTrack) targetTrack = project.tracks[2];

    const clipId = 'clip_' + Math.random().toString(36).substring(2, 9);
    const nextStartMs = currentTimeMs;

    const newClip: Clip = {
      id: clipId,
      trackId: targetTrack.id,
      assetId: asset.id,
      name: asset.name,
      type: asset.type,
      startMs: nextStartMs,
      durationMs: asset.durationMs || 5000,
      sourceStartMs: 0,
      sourceEndMs: asset.durationMs || 5000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      keyframes: [],
    };

    mutateProject((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.id === targetTrack!.id) {
          return {
            ...t,
            clips: [...t.clips, newClip].sort((a, b) => a.startMs - b.startMs),
          };
        }
        return t;
      });
      return {
        ...prev,
        tracks: updatedTracks,
        durationMs: calculateProjectDuration(updatedTracks),
      };
    }, 'Add Clip to Timeline');

    setSelectedClipId(clipId);
  };

  // Add Text Preset
  const handleAddTextToTimeline = (type: 'title' | 'subtitle' | 'lowerThird' | 'caption' | 'neon') => {
    const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0];
    const clipId = 'clip_txt_' + Math.random().toString(36).substring(2, 8);

    const newClip: Clip = {
      id: clipId,
      trackId: textTrack.id,
      name:
        type === 'title'
          ? 'Title'
          : type === 'subtitle'
          ? 'Subtitle'
          : type === 'lowerThird'
          ? 'Lower Third'
          : type === 'caption'
          ? 'Callout Bubble'
          : 'Cyber Neon',
      type: 'text',
      startMs: currentTimeMs,
      durationMs: 4000,
      sourceStartMs: 0,
      sourceEndMs: 4000,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: {
        positionX: 0,
        positionY:
          type === 'subtitle'
            ? 35
            : type === 'lowerThird'
            ? 30
            : type === 'caption'
            ? -20
            : 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
      },
      keyframes: [],
      textProperties: {
        text:
          type === 'title'
            ? 'NEW TITLE'
            : type === 'subtitle'
            ? 'Subtitle dialogue text'
            : type === 'lowerThird'
            ? 'Speaker Name'
            : type === 'caption'
            ? '💬 Dialogue Callout'
            : 'CYBER NEON 2026',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: type === 'title' ? 44 : type === 'neon' ? 48 : 28,
        color: type === 'neon' ? '#38bdf8' : type === 'caption' ? '#facc15' : '#ffffff',
        textAlign: 'center',
        backgroundColor:
          type === 'lowerThird'
            ? 'rgba(0,0,0,0.7)'
            : type === 'caption'
            ? 'rgba(15,23,42,0.85)'
            : undefined,
      },
    };

    mutateProject((prev) => {
      const updated = prev.tracks.map((t) => (t.id === textTrack.id ? { ...t, clips: [...t.clips, newClip] } : t));
      return {
        ...prev,
        tracks: updated,
        durationMs: calculateProjectDuration(updated),
      };
    }, 'Add Text');

    setSelectedClipId(clipId);
  };

  // Add SFX to Timeline
  const handleAddSfxToTimeline = async (preset: SfxPreset) => {
    try {
      const blob = await generateSfxAudioBlob(preset.id);
      const assetId = 'asset_sfx_' + Math.random().toString(36).substring(2, 9);
      const url = URL.createObjectURL(blob);
      const newBinaryMap = new Map(assetBinaryMap);
      const newUrlMap = new Map(assetUrlMap);
      newBinaryMap.set(assetId, blob);
      newUrlMap.set(assetId, url);
      setAssetBinaryMap(newBinaryMap);
      setAssetUrlMap(newUrlMap);

      let waveformPeaks: number[] | undefined;
      try {
        waveformPeaks = await extractWaveformPeaksFromBlob(blob, 100);
      } catch {
        waveformPeaks = undefined;
      }

      const durationMs = Math.round(preset.durationSec * 1000);
      const sfxAsset: ProjectAsset = {
        id: assetId,
        name: `${preset.name}.wav`,
        type: 'audio',
        relativePath: `assets/${assetId}_${preset.id}.wav`,
        originalPath: `${preset.name}.wav`,
        fileSize: blob.size,
        durationMs,
        isBundled: true,
        blobUrl: url,
        waveformPeaks,
      };

      let audioTrack = project.tracks.find((t) => t.type === 'audio');
      if (!audioTrack) audioTrack = project.tracks[project.tracks.length - 1];

      const clipId = 'clip_sfx_' + Math.random().toString(36).substring(2, 8);
      const newClip: Clip = {
        id: clipId,
        trackId: audioTrack.id,
        assetId: sfxAsset.id,
        name: preset.name,
        type: 'audio',
        startMs: currentTimeMs,
        durationMs,
        sourceStartMs: 0,
        sourceEndMs: durationMs,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      };

      mutateProject((prev) => {
        const updatedAssets = [...prev.assets, sfxAsset];
        const updatedTracks = prev.tracks.map((t) =>
          t.id === audioTrack!.id ? { ...t, clips: [...t.clips, newClip] } : t
        );
        return {
          ...prev,
          assets: updatedAssets,
          tracks: updatedTracks,
          durationMs: calculateProjectDuration(updatedTracks),
        };
      }, `Add SFX: ${preset.name}`);

      setSelectedClipId(clipId);
      showToast(`Added sound effect: ${preset.name}`, 'success');
    } catch (e) {
      console.error('Failed to add SFX', e);
      showToast('Failed to generate sound effect', 'warning');
    }
  };

  // Add Element to Timeline
  const handleAddElementToTimeline = (preset: ElementPresetDefinition) => {
    let overlayTrack = project.tracks.find((t) => t.type === 'overlay');
    if (!overlayTrack) overlayTrack = project.tracks.find((t) => t.type === 'video') || project.tracks[1];

    const clipId = 'clip_elem_' + Math.random().toString(36).substring(2, 8);
    const durationMs = 5000;

    const newClip: Clip = {
      id: clipId,
      trackId: overlayTrack.id,
      name: preset.name,
      type: 'element',
      startMs: currentTimeMs,
      durationMs,
      sourceStartMs: 0,
      sourceEndMs: durationMs,
      speed: 1.0,
      volume: 1.0,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
      elementProperties: { ...preset.defaultProperties },
      keyframes: [],
    };

    mutateProject((prev) => {
      const updated = prev.tracks.map((t) =>
        t.id === overlayTrack!.id ? { ...t, clips: [...t.clips, newClip].sort((a, b) => a.startMs - b.startMs) } : t
      );
      return {
        ...prev,
        tracks: updated,
        durationMs: calculateProjectDuration(updated),
      };
    }, 'Add Element');

    setSelectedClipId(clipId);
    showToast(`Element "${preset.name}" added to timeline`, 'success');
  };

  // Save Voiceover Recording
  const handleSaveVoiceOver = async (blob: Blob, filename: string, durationMs: number, peaks: number[]) => {
    try {
      const assetId = 'asset_vo_' + Math.random().toString(36).substring(2, 9);
      const url = URL.createObjectURL(blob);

      let originalPath = filename;
      // In Electron, save inside project managed media folder
      if (window.vnestNative?.saveFileBinary) {
        try {
          const buffer = await blob.arrayBuffer();
          const managedPath = `assets/${assetId}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await window.vnestNative.saveFileBinary(managedPath, buffer);
          originalPath = managedPath;
        } catch (err) {
          console.warn('Failed to write voiceover to disk:', err);
        }
      }

      const newAsset: ProjectAsset = {
        id: assetId,
        name: filename,
        type: 'audio',
        relativePath: `assets/${assetId}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        originalPath,
        fileSize: blob.size,
        durationMs,
        waveformPeaks: peaks,
        isBundled: true,
        blobUrl: url,
      };

      setAssetBinaryMap((prev) => new Map(prev).set(assetId, blob));
      setAssetUrlMap((prev) => new Map(prev).set(assetId, url));

      let audioTrack = project.tracks.find((t) => t.type === 'audio');
      if (!audioTrack) audioTrack = project.tracks[project.tracks.length - 1];

      const clipId = 'clip_vo_' + Math.random().toString(36).substring(2, 9);
      const newClip: Clip = {
        id: clipId,
        trackId: audioTrack.id,
        assetId,
        name: filename,
        type: 'audio',
        startMs: currentTimeMs,
        durationMs,
        sourceStartMs: 0,
        sourceEndMs: durationMs,
        speed: 1.0,
        volume: 1.0,
        fadeInMs: 50,
        fadeOutMs: 50,
        transform: { positionX: 0, positionY: 0, scale: 1.0, rotation: 0, opacity: 1.0 },
        keyframes: [],
      };

      mutateProject((prev) => {
        const updatedTracks = prev.tracks.map((t) => {
          if (t.id === audioTrack!.id) {
            return {
              ...t,
              clips: [...t.clips, newClip].sort((a, b) => a.startMs - b.startMs),
            };
          }
          return t;
        });
        return {
          ...prev,
          assets: [...prev.assets, newAsset],
          tracks: updatedTracks,
          durationMs: calculateProjectDuration(updatedTracks),
        };
      }, 'Add Voiceover Recording');

      setSelectedClipId(clipId);
      setIsVoiceOverOpen(false);
      showToast(`Voiceover "${filename}" added to timeline!`, 'success');
    } catch (err: any) {
      showToast(`Failed to add voiceover: ${err.message}`, 'warning');
    }
  };

  // Add Overlay Preset to Timeline
  const handleAddOverlayToTimeline = async (preset: OverlayPresetDefinition) => {
    try {
      let overlayTrack = project.tracks.find((t) => t.type === 'overlay');
      let tracks = [...project.tracks];

      if (!overlayTrack) {
        overlayTrack = {
          id: 'track_overlay_1',
          type: 'overlay',
          name: 'Overlays',
          order: 1,
          isMuted: false,
          isLocked: false,
          clips: [],
        };
        tracks.splice(1, 0, overlayTrack);
      }

      const clipId = 'clip_ov_' + Math.random().toString(36).substring(2, 8);
      const assetId = 'asset_ov_' + Math.random().toString(36).substring(2, 8);
      const durationMs = 4000;

      // Rasterize vector overlay SVG to PNG blob for FFmpeg export parity
      const svg = generateOverlaySvg(preset.id, 1920, 1080, { opacity: preset.defaultOpacity });
      let pngBlob: Blob;
      try {
        pngBlob = await rasterizeOverlayToPngBlob(svg, 1920, 1080);
      } catch (e) {
        pngBlob = new Blob([svg], { type: 'image/svg+xml' });
      }

      const blobUrl = URL.createObjectURL(pngBlob);
      setAssetBinaryMap((prev) => new Map(prev).set(assetId, pngBlob));
      setAssetUrlMap((prev) => new Map(prev).set(assetId, blobUrl));

      const newAsset: ProjectAsset = {
        id: assetId,
        name: preset.name,
        type: 'image',
        relativePath: `assets/overlays/${preset.id}.png`,
        originalPath: `assets/overlays/${preset.id}.png`,
        fileSize: pngBlob.size || 1024,
        durationMs,
        isBundled: true,
        blobUrl,
      };

      const newClip: Clip = {
        id: clipId,
        trackId: overlayTrack.id,
        assetId: assetId,
        name: preset.name,
        type: 'overlay',
        startMs: currentTimeMs,
        durationMs,
        sourceStartMs: 0,
        sourceEndMs: durationMs,
        speed: 1.0,
        volume: 0,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: {
          positionX: 0,
          positionY: 0,
          scale: 1.0,
          rotation: 0,
          opacity: preset.defaultOpacity,
          blendMode: preset.recommendedBlendMode,
        },
        keyframes: [],
        overlayProperties: {
          overlayType: preset.id,
          category: preset.category,
          blendMode: preset.recommendedBlendMode,
          opacity: preset.defaultOpacity,
        },
      };

      mutateProject((prev) => {
        const updatedTracks = tracks.map((t) => {
          if (t.id === overlayTrack!.id) {
            return {
              ...t,
              clips: [...t.clips, newClip].sort((a, b) => a.startMs - b.startMs),
            };
          }
          return t;
        });
        return {
          ...prev,
          assets: [...prev.assets, newAsset],
          tracks: updatedTracks,
          durationMs: calculateProjectDuration(updatedTracks),
        };
      }, `Add Overlay: ${preset.name}`);

      setSelectedClipId(clipId);
      showToast(`Added overlay "${preset.name}" to timeline!`, 'success');
    } catch (err: any) {
      showToast(`Failed to add overlay: ${err.message}`, 'warning');
    }
  };

  // Add Effect to Selected Clip
  const handleAddEffectToSelectedClip = (effectType: VideoEffectType) => {
    if (!selectedClipId) {
      showToast('Select a clip to apply effect', 'warning');
      return;
    }
    const eff = createEffect(effectType);
    mutateProject((prev) => {
      const tracks = prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === selectedClipId
            ? {
                ...c,
                effects: [...(c.effects || []), eff],
              }
            : c
        ),
      }));
      return { ...prev, tracks };
    }, `Add Effect: ${eff.name}`);
    showToast(`Added effect "${eff.name}" to selected clip!`, 'success');
  };

  // Add Transition to Selected Clip
  const handleAddTransitionToTimeline = (transitionType: TransitionType) => {
    if (!selectedClipId) {
      showToast('Select a clip to attach transition', 'warning');
      return;
    }
    const newTrans = createTransition(transitionType);
    mutateProject((prev) => {
      const tracks = prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === selectedClipId
            ? {
                ...c,
                transition: newTrans,
              }
            : c
        ),
      }));
      return { ...prev, tracks };
    }, `Add Transition: ${transitionType}`);
    showToast(`Added ${transitionType} transition to selected clip`, 'success');
  };

  // Keyframes
  const handleAddKeyframe = (clipId: string, offsetMs: number) => {
    mutateProject((prev) => {
      const tracks = prev.tracks.map((track) => {
        const clips = track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const newKf = {
            id: 'kf_' + Math.random().toString(36).substring(2, 8),
            offsetMs: Math.round(offsetMs),
            properties: { ...clip.transform, volume: clip.volume },
            easing: 'easeOut' as const,
          };
          return {
            ...clip,
            keyframes: [...clip.keyframes, newKf].sort((a, b) => a.offsetMs - b.offsetMs),
          };
        });
        return { ...track, clips };
      });
      return { ...prev, tracks };
    }, 'Add Keyframe');
  };

  const handleDeleteKeyframe = (clipId: string, kfId: string) => {
    mutateProject((prev) => {
      const tracks = prev.tracks.map((track) => {
        const clips = track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          return {
            ...clip,
            keyframes: clip.keyframes.filter((kf) => kf.id !== kfId),
          };
        });
        return { ...track, clips };
      });
      return { ...prev, tracks };
    }, 'Delete Keyframe');
  };

  const handleApplyCaptions = useCallback(
    (segments: CaptionSegment[], style: CaptionStyle) => {
      mutateProject(
        (prev) => applyCaptionsToProject(prev, segments, style),
        'Apply Auto Captions'
      );
      showToast(`Added ${segments.length} captions to timeline!`, 'success');
    },
    [mutateProject, showToast]
  );

  const handleApplyAutoCuts = useCallback(
    (targetClipId: string, approvedCuts: ProposedCut[], aspectRatioPreset?: AspectRatio) => {
      mutateProject(
        (prev) => applyAutoCutsToTimeline(prev, targetClipId, approvedCuts, aspectRatioPreset),
        `Auto Cut (${approvedCuts.length} segments)`
      );
      const totalKeptSec = (approvedCuts.reduce((acc, c) => acc + c.durationMs, 0) / 1000).toFixed(1);
      showToast(`Auto Cut applied: generated ${approvedCuts.length} active segments (${totalKeptSec}s)!`, 'success');
    },
    [mutateProject, showToast]
  );

  const handleUpdateClipWatermark = useCallback(
    (clipId: string, settings: WatermarkRemoverSettings | undefined) => {
      mutateProject(
        (prev) => ({
          ...prev,
          tracks: prev.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, watermarkRemover: settings } : c)),
          })),
        }),
        settings ? 'Apply Watermark Remover' : 'Remove Watermark Filter'
      );
      showToast(settings ? 'Watermark remover applied to clip' : 'Watermark filter removed', 'info');
    },
    [mutateProject, showToast]
  );

  const handleUpdateProjectWatermark = useCallback(
    (settings: WatermarkRemoverSettings | undefined) => {
      mutateProject(
        (prev) => ({
          ...prev,
          watermarkRemover: settings,
        }),
        settings ? 'Apply Project Watermark Remover' : 'Remove Project Watermark Filter'
      );
      showToast(settings ? 'Watermark remover applied to project canvas' : 'Project watermark filter removed', 'info');
    },
    [mutateProject, showToast]
  );

  return (
    <div className="vnest-app-container">
      {view === 'home' ? (
        <HomeScreen
          onNewProject={handleNewProject}
          onOpenProjectFile={handleOpenProjectFile}
          onOpenSharedPackage={() => setIsOpenSharedOpen(true)}
          onSelectRecent={handleSelectRecent}
          onRecoverUnsaved={handleRecoverUnsaved}
          onLoadTemplate={handleLoadTemplate}
          hasUnsavedRecovery={hasUnsavedRecovery}
          recentProjects={recentProjects}
          onDeleteRecent={(id) => {
            const filtered = recentProjects.filter((p) => p.id !== id);
            setRecentProjects(filtered);
            localStorage.setItem('vnest_recent_projects', JSON.stringify(filtered));
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top Header */}
          <Header
            project={project}
            onUpdateProjectName={(name) => mutateProject((p) => ({ ...p, name }), 'Rename Project')}
            onUpdateAspectRatio={(ratio) =>
              mutateProject((p) => ({ ...p, settings: { ...p.settings, aspectRatio: ratio } }), 'Change Aspect Ratio')
            }
            onGoHome={() => {
              RecoveryManager.markSessionClean();
              setView('home');
            }}
            onSave={handleSaveProject}
            onShare={() => setIsShareOpen(true)}
            onExport={() => setIsExportOpen(true)}
            onAutoCaptions={() => setIsAutoCaptionsOpen(true)}
            onAutoCut={() => setIsAutoCutOpen(true)}
            onWatermark={() => setIsWatermarkOpen(true)}
            onOpenRecovery={() => setIsRecoveryOpen(true)}
            onOpenCacheManager={() => setIsCacheManagerOpen(true)}
            autosaveIntervalSec={project.autosaveIntervalSec ?? 60}
            onUpdateAutosaveInterval={(sec) =>
              mutateProject((p) => ({ ...p, autosaveIntervalSec: sec }), 'Update Autosave Interval')
            }
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            saveStatus={saveStatus}
            theme={theme}
            onToggleTheme={toggleTheme}
            onResetLayout={handleResetLayout}
          />

          {/* Middle Row (Left Library | Center Preview | Right Properties) */}
          <div
            className="vnest-workspace"
            style={{
              userSelect: resizingSide ? 'none' : 'auto',
            }}
          >
            {/* Left Sidebar (Media Library) or Collapsed Tab */}
            {!layout.isFullscreenPreview && (
              layout.isLeftCollapsed ? (
                <div
                  id="library-collapsed-tab"
                  className="vnest-collapsed-panel-tab"
                  onClick={toggleLeftCollapse}
                  title="Expand Media Library (Click to open)"
                >
                  <Film size={14} style={{ color: 'var(--accent-sage)' }} />
                  <span className="vnest-collapsed-panel-title">Media Library</span>
                </div>
              ) : (
                <>
                  <MediaLibrary
                    style={{ width: `${layout.leftWidth}px` }}
                    onCollapse={toggleLeftCollapse}
                    assets={project.assets}
                    onImportFiles={handleImportFiles}
                    onNativeImport={handleNativeImport}
                    onOpenAutoCut={() => setIsAutoCutOpen(true)}
                    onAddAssetToTimeline={handleAddAssetToTimeline}
                    onAddTextToTimeline={handleAddTextToTimeline}
                    onAddElementToTimeline={handleAddElementToTimeline}
                    onAddOverlayToTimeline={handleAddOverlayToTimeline}
                    onAddEffectToSelectedClip={handleAddEffectToSelectedClip}
                    onAddSfxToTimeline={handleAddSfxToTimeline}
                    onAddTransitionToTimeline={handleAddTransitionToTimeline}
                    onRelinkAsset={(id) => {
                      setRelinkInitialAssetId(id || null);
                      setIsRelinkOpen(true);
                    }}
                    onOpenInspector={(asset) => {
                      setInspectedAsset(asset);
                      setIsMediaInspectorOpen(true);
                    }}
                    onGenerateProxy={handleGenerateProxy}
                    onCancelProxy={handleCancelProxy}
                    proxySettings={project.proxySettings || DEFAULT_PROXY_SETTINGS}
                    onUpdateProxySettings={(s) =>
                      mutateProject(
                        (p) => ({
                          ...p,
                          proxySettings: { ...(p.proxySettings || DEFAULT_PROXY_SETTINGS), ...s },
                        }),
                        'Update Proxy Settings'
                      )
                    }
                    onOpenCacheManager={() => setIsCacheManagerOpen(true)}
                    onOpenAutoCaptions={() => setIsAutoCaptionsOpen(true)}
                    onOpenVoiceOver={() => setIsVoiceOverOpen(true)}
                    selectedClipId={selectedClipId}
                  />
                  <div
                    id="workspace-resizer-left"
                    className={`vnest-resizer-v ${resizingSide === 'left' ? 'active' : ''}`}
                    onMouseDown={(e) => handleStartResize(e, 'left')}
                    title="Drag to resize Media Library width"
                  />
                </>
              )
            )}

            {/* Center Preview */}
            <div className="vnest-preview-center" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
              <PreviewPlayer
                project={project}
                currentTimeMs={currentTimeMs}
                isPlaying={isPlaying}
                onSeek={setCurrentTimeMs}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                assetUrlMap={assetUrlMap}
                proxyUrlMap={proxyUrlMap}
                isFullscreen={layout.isFullscreenPreview}
                onToggleFullscreen={toggleFullscreenPreview}
              />
            </div>

            {/* Right Sidebar (Properties Inspector) or Collapsed Tab */}
            {!layout.isFullscreenPreview && (
              layout.isRightCollapsed ? (
                <div
                  id="properties-collapsed-tab"
                  className="vnest-collapsed-panel-tab right"
                  onClick={toggleRightCollapse}
                  title="Expand Properties Inspector (Click to open)"
                >
                  <Sliders size={14} style={{ color: 'var(--accent-sage)' }} />
                  <span className="vnest-collapsed-panel-title">Inspector</span>
                </div>
              ) : (
                <>
                  <div
                    id="workspace-resizer-right"
                    className={`vnest-resizer-v ${resizingSide === 'right' ? 'active' : ''}`}
                    onMouseDown={(e) => handleStartResize(e, 'right')}
                    title="Drag to resize Inspector width"
                  />
                  <PropertiesPanel
                    style={{ width: `${layout.rightWidth}px` }}
                    onCollapse={toggleRightCollapse}
                    project={project}
                    selectedClip={selectedClip}
                    currentTimeMs={currentTimeMs}
                    onUpdateClip={(clipId, updates) => {
                      setProject((prev) => {
                        const tracks = prev.tracks.map((t) => ({
                          ...t,
                          clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
                        }));
                        return { ...prev, tracks };
                      });
                      setSaveStatus('unsaved');
                    }}
                    onAddKeyframe={handleAddKeyframe}
                    onDeleteKeyframe={handleDeleteKeyframe}
                    onExtractAudio={handleExtractAudio}
                  />
                </>
              )
            )}
          </div>

          {/* Bottom Row (Multi-Track Timeline) */}
          {!layout.isFullscreenPreview && (
            <Timeline
              height={layout.timelineHeight}
              onHeightChange={(newH) => setLayout((prev) => ({ ...prev, timelineHeight: newH }))}
              isCollapsed={layout.isTimelineCollapsed}
              onToggleCollapse={toggleTimelineCollapse}
              project={project}
              currentTimeMs={currentTimeMs}
              onSeek={setCurrentTimeMs}
              selectedClipId={selectedClipId}
              onSelectClip={(id) => {
                setSelectedClipId(id);
                setSelectedClipIds(id ? [id] : []);
              }}
              selectedClipIds={selectedClipIds}
              onSelectMultipleClips={(ids) => {
                setSelectedClipIds(ids);
                setSelectedClipId(ids.length > 0 ? ids[0] : null);
              }}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
              onDuplicateClip={handleDuplicateClip}
              onFreezeFrame={handleFreezeFrame}
              onExtractAudio={handleExtractAudio}
              onOpenAutoCaptions={() => setIsAutoCaptionsOpen(true)}
              onOpenVoiceOver={() => setIsVoiceOverOpen(true)}
              onOpenAutoCut={() => setIsAutoCutOpen(true)}
              onUpdateClipPosition={handleUpdateClipPosition}
              onTrimClip={handleTrimClip}
              onRippleTrim={handleRippleTrim}
              onRollEdit={handleRollEdit}
              onSlipEdit={handleSlipEdit}
              onSlideEdit={handleSlideEdit}
              onGroupClips={handleGroupClips}
              onUngroupClips={handleUngroupClips}
              onMoveGroup={handleMoveGroup}
              onToggleTrackMute={handleToggleTrackMute}
              onToggleTrackLock={handleToggleTrackLock}
              onToggleTrackVisibility={handleToggleTrackVisibility}
              onToggleTrackSolo={handleToggleTrackSolo}
              onUpdateKeyframes={handleUpdateKeyframes}
            />
          )}
        </div>
      )}

      {/* Floating Action/Error Toast Notification */}
      {toast && (
        <div
          className="vnest-toast"
          style={{
            position: 'fixed',
            bottom: `${view === 'editor' ? (layout.isTimelineCollapsed || layout.isFullscreenPreview ? 58 : layout.timelineHeight + 16) : 24}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px var(--border-medium)',
            backgroundColor:
              toast.type === 'success'
                ? '#26362C'
                : toast.type === 'warning'
                ? '#3B3426'
                : toast.type === 'error'
                ? '#3F2222'
                : 'var(--bg-surface-3)',
            border:
              toast.type === 'success'
                ? '1px solid #527A59'
                : toast.type === 'warning'
                ? '1px solid #7D6B47'
                : toast.type === 'error'
                ? '1px solid #993333'
                : '1px solid var(--accent-sage)',
            color:
              toast.type === 'success'
                ? '#D4E5D6'
                : toast.type === 'warning'
                ? '#EFE3C7'
                : toast.type === 'error'
                ? '#FAD2D2'
                : 'var(--text-primary)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {toast.type === 'success' && <CheckCircle2 size={16} color="#8FB894" />}
          {toast.type === 'warning' && <AlertTriangle size={16} color="#D4B46F" />}
          {toast.type === 'error' && <AlertTriangle size={16} color="#FF6B6B" />}
          {toast.type === 'info' && <Info size={16} color="var(--accent-sage)" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="vnest-btn-icon"
            style={{ marginLeft: '6px', padding: '2px', color: 'inherit', opacity: 0.8 }}
          >
            <X size={14} />
          </button>
        </div>
      )}


      {/* Modals */}
      <ExportModal
        project={project}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        assetBinaryMap={assetBinaryMap}
        assetPathResolver={(id) => {
          const a = project.assets.find((item) => item.id === id);
          return a?.originalPath || null;
        }}
      />

      <ShareModal
        project={project}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        assetBinaryMap={assetBinaryMap}
      />

      <OpenSharedModal
        isOpen={isOpenSharedOpen}
        initialBuffer={initialSharedBuffer}
        onClose={() => {
          setIsOpenSharedOpen(false);
          setInitialSharedBuffer(null);
          setPendingSharedFilePath(null);
        }}
        onProjectLoaded={(openedProject, extractedMap) => {
          const finalProj: Project = pendingSharedFilePath
            ? { ...openedProject, filePath: pendingSharedFilePath }
            : openedProject;
          setProject(finalProj);
          const urls = new Map<string, string>();
          const blobs = new Map<string, Blob>();
          extractedMap.forEach((val, id) => {
            urls.set(id, val.url);
            blobs.set(id, val.blob);
          });
          setAssetUrlMap(urls);
          setAssetBinaryMap(blobs);
          setSelectedClipId(null);
          setCurrentTimeMs(0);
          setIsPlaying(false);
          historyRef.current.clear();
          updateHistoryAvailability();
          addToRecentProjects(finalProj, pendingSharedFilePath || undefined);
          setPendingSharedFilePath(null);
          setView('editor');
        }}
      />

      <AutoCaptionsModal
        isOpen={isAutoCaptionsOpen}
        onClose={() => setIsAutoCaptionsOpen(false)}
        project={project}
        assetPathResolver={(id) => {
          const a = project.assets.find((item) => item.id === id);
          return a?.originalPath || null;
        }}
        onApplyCaptions={handleApplyCaptions}
      />

      <VoiceOverModal
        isOpen={isVoiceOverOpen}
        onClose={() => setIsVoiceOverOpen(false)}
        currentTimeMs={currentTimeMs}
        fps={project.settings.fps}
        onSaveVoiceOver={handleSaveVoiceOver}
      />

      <AutoCutModal
        isOpen={isAutoCutOpen}
        onClose={() => setIsAutoCutOpen(false)}
        project={project}
        selectedClipId={selectedClipId}
        assetPathResolver={(id) => {
          const a = project.assets.find((item) => item.id === id);
          return a?.originalPath || null;
        }}
        onApplyAutoCuts={handleApplyAutoCuts}
      />

      <WatermarkModal
        isOpen={isWatermarkOpen}
        onClose={() => setIsWatermarkOpen(false)}
        project={project}
        selectedClip={selectedClip}
        onUpdateClipWatermark={handleUpdateClipWatermark}
        onUpdateProjectWatermark={handleUpdateProjectWatermark}
      />

      {/* Phase 7 Modals */}
      <MediaInspectorModal
        asset={inspectedAsset}
        isOpen={isMediaInspectorOpen}
        onClose={() => {
          setIsMediaInspectorOpen(false);
          setInspectedAsset(null);
        }}
        onRelink={(assetId) => {
          setIsMediaInspectorOpen(false);
          setRelinkInitialAssetId(assetId);
          setIsRelinkOpen(true);
        }}
        onGenerateProxy={handleGenerateProxy}
        onDeleteProxy={handleDeleteProxy}
      />

      <RelinkMediaModal
        isOpen={isRelinkOpen}
        onClose={() => {
          setIsRelinkOpen(false);
          setRelinkInitialAssetId(null);
        }}
        project={project}
        initialAssetId={relinkInitialAssetId}
        onUpdateProject={handleRelinkProject}
        onToast={showToast}
      />

      <RecoveryModal
        isOpen={isRecoveryOpen}
        onClose={() => {
          setIsRecoveryOpen(false);
          setIsAbnormalShutdown(false);
        }}
        onRestoreProject={handleRestoreProject}
        isAbnormalShutdown={isAbnormalShutdown}
      />

      <CacheManagerModal
        isOpen={isCacheManagerOpen}
        onClose={() => setIsCacheManagerOpen(false)}
        onToast={showToast}
      />
    </div>
  );
};
