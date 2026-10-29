import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Scissors,
  Trash2,
  Copy,
  Magnet,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Type,
  Film,
  Music,
  Layers,
  Diamond,
  Snowflake,
  Sparkles,
  Mic,
  MousePointer,
  ChevronsLeftRight,
  ArrowLeftRight,
  SlidersHorizontal,
  Sliders,
  Link as LinkIcon,
  Unlink,
  Eye,
  EyeOff,
  Activity,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Maximize2,
} from 'lucide-react';

import { Project, Clip, Track, TimelineTool, Keyframe } from '../../types/project';
import { formatTimecode, msToPx, pxToMs, calculateSnap } from '../../core/time';
import { ClipWaveform } from './ClipWaveform';
import { getSliceWaveformPeaks } from '../../core/waveform';
import { KeyframeGraphEditor } from './KeyframeGraphEditor';
import { MoreClipOperationsMenu } from './MoreClipOperationsMenu';

interface TimelineProps {
  project: Project;
  currentTimeMs: number;
  onSeek: (timeMs: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  selectedClipIds?: string[];
  onSelectMultipleClips?: (clipIds: string[]) => void;
  activeTool?: TimelineTool;
  onSelectTool?: (tool: TimelineTool) => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onDuplicateClip: () => void;
  onFreezeFrame?: () => void;
  onExtractAudio?: () => void;
  onOpenAutoCaptions?: () => void;
  onOpenVoiceOver?: () => void;
  onOpenAutoCut?: () => void;
  onUpdateClipPosition: (clipId: string, newStartMs: number, trackId: string) => void;
  onTrimClip: (clipId: string, side: 'left' | 'right', deltaMs: number) => void;
  onRippleTrim?: (clipId: string, side: 'left' | 'right', deltaMs: number) => void;
  onRollEdit?: (clipIdA: string, clipIdB: string, deltaMs: number) => void;
  onSlipEdit?: (clipId: string, deltaMs: number) => void;
  onSlideEdit?: (clipId: string, deltaMs: number) => void;
  onGroupClips?: () => void;
  onUngroupClips?: () => void;
  onMoveGroup?: (groupId: string, deltaMs: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackLock: (trackId: string) => void;
  onToggleTrackVisibility?: (trackId: string) => void;
  onToggleTrackSolo?: (trackId: string) => void;
  onUpdateKeyframes?: (clipId: string, keyframes: Keyframe[]) => void;
  height?: number;
  onHeightChange?: (newHeight: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTimeMs,
  onSeek,
  selectedClipId,
  onSelectClip,
  selectedClipIds: externalSelectedClipIds,
  onSelectMultipleClips,
  activeTool: externalActiveTool,
  onSelectTool,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onFreezeFrame,
  onExtractAudio,
  onOpenAutoCaptions,
  onOpenVoiceOver,
  onOpenAutoCut,
  onUpdateClipPosition,
  onTrimClip,
  onRippleTrim,
  onRollEdit,
  onSlipEdit,
  onSlideEdit,
  onGroupClips,
  onUngroupClips,
  onMoveGroup,
  onToggleTrackMute,
  onToggleTrackLock,
  onToggleTrackVisibility,
  onToggleTrackSolo,
  onUpdateKeyframes,
  height,
  onHeightChange,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);

  // Active Tool state
  const [internalTool, setInternalTool] = useState<TimelineTool>('select');
  const activeTool = externalActiveTool ?? internalTool;
  const setTool = (tool: TimelineTool) => {
    setInternalTool(tool);
    if (onSelectTool) onSelectTool(tool);
  };

  // Multi-selection state
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedClipIds = externalSelectedClipIds ?? internalSelectedIds;

  // Active Track targeting state
  const [activeTrackId, setActiveTrackId] = useState<string>('track_video_main');

  // Keyframe Graph Editor display state
  const [showKeyframeEditor, setShowKeyframeEditor] = useState(false);

  // Selected clip object
  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const t of project.tracks) {
      const c = t.clips.find((item) => item.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [project.tracks, selectedClipId]);

  // Timeline height state (default 280px)
  const [internalHeight, setInternalHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('vnest_timeline_height');
      return saved ? Math.max(160, parseInt(saved, 10)) : 280;
    } catch {
      return 280;
    }
  });

  const rawHeight = height ?? internalHeight;
  const [windowHeight, setWindowHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900));

  useEffect(() => {
    const handleWinResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  const maxSafeHeight = Math.max(160, windowHeight - 190);
  const timelineHeight = Math.min(Math.max(160, rawHeight), maxSafeHeight);
  const effectiveTimelineHeight = isCollapsed ? 42 : timelineHeight;

  // Resizing state
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(280);

  // Zoom level: pixels per second (e.g. 60px = 1 second)
  const [pxPerSec, setPxPerSec] = useState(60);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleZoomToFit = () => {
    if (!lanesRef.current || project.durationMs <= 0) return;
    const availableWidth = lanesRef.current.clientWidth - 40;
    if (availableWidth <= 0) return;
    const durSec = Math.max(1, project.durationMs / 1000);
    const fitPxPerSec = Math.max(15, Math.min(250, Math.floor(availableWidth / durSec)));
    setPxPerSec(fitPxPerSec);
  };

  // Dragging interaction state
  const [activeDrag, setActiveDrag] = useState<{
    mode: 'move' | 'trim' | 'ripple' | 'roll' | 'slip' | 'slide';
    clipId: string;
    clipIdB?: string;
    side?: 'left' | 'right';
    initialMouseX: number;
    initialStartMs: number;
    initialDurationMs: number;
    trackId: string;
    groupId?: string;
  } | null>(null);

  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);

  // Keyboard Shortcuts for professional timeline editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Tool selection shortcuts
      if (e.key === 'v' || e.key === 'V') {
        setTool('select');
      } else if (e.key === 'b' || e.key === 'B') {
        setTool('ripple');
      } else if (e.key === 'n' || e.key === 'N') {
        setTool('roll');
      } else if (e.key === 'y' || e.key === 'Y') {
        setTool('slip');
      } else if (e.key === 'u' || e.key === 'U') {
        setTool('slide');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G') && !e.shiftKey) {
        e.preventDefault();
        if (onGroupClips) onGroupClips();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G') && e.shiftKey) {
        e.preventDefault();
        if (onUngroupClips) onUngroupClips();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGroupClips, onUngroupClips]);

  // Calculate snap targets across all clips and zero
  const snapTargets: number[] = [0, currentTimeMs];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      snapTargets.push(clip.startMs);
      snapTargets.push(clip.startMs + clip.durationMs);
    }
  }

  // Handle global mouse move and up for resizing, scrubbing, dragging and trimming
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Resizing timeline panel height
      if (isResizingHeight) {
        const deltaY = resizeStartYRef.current - e.clientY;
        const maxAllowed = Math.max(160, window.innerHeight - 190);
        const newH = Math.max(160, Math.min(maxAllowed, resizeStartHeightRef.current + deltaY));
        setInternalHeight(newH);
        if (onHeightChange) onHeightChange(newH);
        try {
          localStorage.setItem('vnest_timeline_height', String(newH));
        } catch {}
      }

      // 2. Scrubbing ruler
      if (isScrubbingRuler && lanesRef.current) {
        const rect = lanesRef.current.getBoundingClientRect();
        const scrollLeft = lanesRef.current.scrollLeft;
        const relativeX = e.clientX - rect.left + scrollLeft;
        const targetMs = Math.max(0, pxToMs(relativeX, pxPerSec));
        onSeek(targetMs);
      }

      // 3. Professional Timeline Dragging Tools
      if (activeDrag) {
        const deltaPx = e.clientX - activeDrag.initialMouseX;
        const deltaMs = pxToMs(deltaPx, pxPerSec);

        if (activeDrag.mode === 'move') {
          if (activeDrag.groupId && onMoveGroup) {
            onMoveGroup(activeDrag.groupId, deltaMs);
          } else {
            let newStartMs = Math.max(0, activeDrag.initialStartMs + deltaMs);
            if (snappingEnabled) {
              const snap = calculateSnap(newStartMs, snapTargets, 200);
              if (snap.snapped) {
                newStartMs = snap.snappedTimeMs;
              }
            }
            onUpdateClipPosition(activeDrag.clipId, newStartMs, activeDrag.trackId);
          }
        } else if (activeDrag.mode === 'trim') {
          if (activeDrag.side) {
            onTrimClip(activeDrag.clipId, activeDrag.side, deltaMs);
          }
        } else if (activeDrag.mode === 'ripple') {
          if (activeDrag.side && onRippleTrim) {
            onRippleTrim(activeDrag.clipId, activeDrag.side, deltaMs);
          }
        } else if (activeDrag.mode === 'roll') {
          if (activeDrag.clipIdB && onRollEdit) {
            onRollEdit(activeDrag.clipId, activeDrag.clipIdB, deltaMs);
          }
        } else if (activeDrag.mode === 'slip') {
          if (onSlipEdit) {
            onSlipEdit(activeDrag.clipId, deltaMs);
          }
        } else if (activeDrag.mode === 'slide') {
          if (onSlideEdit) {
            onSlideEdit(activeDrag.clipId, deltaMs);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      setIsScrubbingRuler(false);
      setActiveDrag(null);
    };

    if (isResizingHeight || isScrubbingRuler || activeDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isResizingHeight,
    isScrubbingRuler,
    activeDrag,
    pxPerSec,
    snappingEnabled,
    snapTargets,
    onSeek,
    onTrimClip,
    onRippleTrim,
    onRollEdit,
    onSlipEdit,
    onSlideEdit,
    onUpdateClipPosition,
    onMoveGroup,
    onHeightChange,
  ]);

  // Synchronize vertical scroll between track lanes and track headers
  const handleLanesScroll = () => {
    if (lanesRef.current && headersRef.current) {
      headersRef.current.scrollTop = lanesRef.current.scrollTop;
    }
  };

  // Total timeline width in pixels
  const timelineContentWidth = Math.max(
    1400,
    msToPx(project.durationMs + 10000, pxPerSec)
  );

  const tickIntervalSec = pxPerSec > 100 ? 1 : pxPerSec > 40 ? 2 : 5;
  const totalTicks = Math.ceil((timelineContentWidth / pxPerSec) / tickIntervalSec);

  // Clip selection helper (handles single, multi, and group selection)
  const handleClipClick = (clip: Clip, e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const exists = selectedClipIds.includes(clip.id);
      const next = exists ? selectedClipIds.filter((id) => id !== clip.id) : [...selectedClipIds, clip.id];
      if (onSelectMultipleClips) onSelectMultipleClips(next);
      setInternalSelectedIds(next);
      onSelectClip(next.length > 0 ? next[next.length - 1] : null);
    } else {
      if (clip.groupId) {
        // Select all clips in this group
        const groupClipIds: string[] = [];
        for (const t of project.tracks) {
          for (const c of t.clips) {
            if (c.groupId === clip.groupId) {
              groupClipIds.push(c.id);
            }
          }
        }
        if (onSelectMultipleClips) onSelectMultipleClips(groupClipIds);
        setInternalSelectedIds(groupClipIds);
        onSelectClip(clip.id);
      } else {
        if (onSelectMultipleClips) onSelectMultipleClips([clip.id]);
        setInternalSelectedIds([clip.id]);
        onSelectClip(clip.id);
      }
    }
  };

  // Find adjacent clip on same track for roll edit
  const findAdjacentClip = (clip: Clip, side: 'left' | 'right'): Clip | null => {
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (!track) return null;
    const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    const idx = sorted.findIndex((c) => c.id === clip.id);
    if (side === 'right' && idx < sorted.length - 1) {
      const next = sorted[idx + 1];
      if (Math.abs((clip.startMs + clip.durationMs) - next.startMs) <= 30) return next;
    }
    if (side === 'left' && idx > 0) {
      const prev = sorted[idx - 1];
      if (Math.abs((prev.startMs + prev.durationMs) - clip.startMs) <= 30) return prev;
    }
    return null;
  };

  const isCurrentClipGrouped = !!selectedClip?.groupId;
  const canGroupSelected = selectedClipIds.length >= 2;

  return (
    <div
      className="vnest-timeline-container"
      style={{
        height: `${effectiveTimelineHeight}px`,
        userSelect: isResizingHeight ? 'none' : 'auto',
      }}
    >
      {/* 0. Top Resize Handle */}
      <div
        className={`vnest-timeline-resizer ${isResizingHeight ? 'active' : ''}`}
        onMouseDown={(e) => {
          if (isCollapsed) return;
          e.preventDefault();
          setIsResizingHeight(true);
          resizeStartYRef.current = e.clientY;
          resizeStartHeightRef.current = timelineHeight;
        }}
        title={isCollapsed ? 'Timeline is minimized (click expand button to open)' : 'Drag up or down to resize timeline panel height'}
      >
        <div className="vnest-timeline-resizer-grip" />
      </div>

      {/* 1. Timeline Toolbar (Organized & Grouped) */}
      <div className="vnest-timeline-toolbar">
        {/* Group 1: Edit Tool Mode Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-1)',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            gap: '2px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setTool('select')}
            className={`vnest-btn-subtle ${activeTool === 'select' ? 'active' : ''}`}
            style={{
              padding: '4px 7px',
              fontSize: '11px',
              fontWeight: activeTool === 'select' ? 700 : 500,
              backgroundColor: activeTool === 'select' ? 'var(--selected-surface)' : 'transparent',
              color: activeTool === 'select' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: activeTool === 'select' ? '1px solid var(--accent-sage)' : '1px solid transparent',
              borderRadius: '4px',
            }}
            title="Selection Tool (V) — Move and standard trim"
          >
            <MousePointer size={12} />
            <span style={{ marginLeft: 3 }}>Select (V)</span>
          </button>

          <button
            onClick={() => setTool('ripple')}
            className={`vnest-btn-subtle ${activeTool === 'ripple' ? 'active' : ''}`}
            style={{
              padding: '4px 7px',
              fontSize: '11px',
              fontWeight: activeTool === 'ripple' ? 700 : 500,
              backgroundColor: activeTool === 'ripple' ? 'var(--selected-surface)' : 'transparent',
              color: activeTool === 'ripple' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: activeTool === 'ripple' ? '1px solid var(--accent-sage)' : '1px solid transparent',
              borderRadius: '4px',
            }}
            title="Ripple Edit Tool (B) — Trim and close/open gaps"
          >
            <ChevronsLeftRight size={12} />
            <span style={{ marginLeft: 3 }}>Ripple (B)</span>
          </button>

          <button
            onClick={() => setTool('roll')}
            className={`vnest-btn-subtle ${activeTool === 'roll' ? 'active' : ''}`}
            style={{
              padding: '4px 7px',
              fontSize: '11px',
              fontWeight: activeTool === 'roll' ? 700 : 500,
              backgroundColor: activeTool === 'roll' ? 'var(--selected-surface)' : 'transparent',
              color: activeTool === 'roll' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: activeTool === 'roll' ? '1px solid var(--accent-sage)' : '1px solid transparent',
              borderRadius: '4px',
            }}
            title="Roll Edit Tool (N) — Adjust cut between adjacent clips"
          >
            <ArrowLeftRight size={12} />
            <span style={{ marginLeft: 3 }}>Roll (N)</span>
          </button>

          <button
            onClick={() => setTool('slip')}
            className={`vnest-btn-subtle ${activeTool === 'slip' ? 'active' : ''}`}
            style={{
              padding: '4px 7px',
              fontSize: '11px',
              fontWeight: activeTool === 'slip' ? 700 : 500,
              backgroundColor: activeTool === 'slip' ? 'var(--selected-surface)' : 'transparent',
              color: activeTool === 'slip' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: activeTool === 'slip' ? '1px solid var(--accent-sage)' : '1px solid transparent',
              borderRadius: '4px',
            }}
            title="Slip Tool (Y) — Change source in/out points"
          >
            <SlidersHorizontal size={12} />
            <span style={{ marginLeft: 3 }}>Slip (Y)</span>
          </button>

          <button
            onClick={() => setTool('slide')}
            className={`vnest-btn-subtle ${activeTool === 'slide' ? 'active' : ''}`}
            style={{
              padding: '4px 7px',
              fontSize: '11px',
              fontWeight: activeTool === 'slide' ? 700 : 500,
              backgroundColor: activeTool === 'slide' ? 'var(--selected-surface)' : 'transparent',
              color: activeTool === 'slide' ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: activeTool === 'slide' ? '1px solid var(--accent-sage)' : '1px solid transparent',
              borderRadius: '4px',
            }}
            title="Slide Tool (U) — Move clip along timeline adjusting neighbor clips"
          >
            <Sliders size={12} />
            <span style={{ marginLeft: 3 }}>Slide (U)</span>
          </button>
        </div>

        <div className="vnest-divider-v" />

        {/* Group 2: Primary Edit Actions (Split, Delete, Duplicate, Snap) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={onSplitClip}
            className="vnest-btn-subtle"
            style={{
              padding: '4px 9px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: selectedClipId ? 'var(--selected-surface)' : 'var(--bg-surface-2)',
              color: selectedClipId ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: selectedClipId ? '1px solid var(--accent-sage)' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
            title="Split selected clip at playhead position (S)"
          >
            <Scissors size={12} style={{ color: selectedClipId ? 'var(--accent-sage)' : 'var(--text-secondary)' }} />
            <span>Split (S)</span>
          </button>

          <button
            onClick={onDeleteClip}
            disabled={!selectedClipId && selectedClipIds.length === 0}
            className="vnest-btn-icon"
            style={{
              color: selectedClipId || selectedClipIds.length > 0 ? 'var(--accent-rose)' : 'var(--text-muted)',
              padding: '4px',
            }}
            title="Delete selected clip(s) (Delete / Backspace)"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={onDuplicateClip}
            disabled={!selectedClipId}
            className="vnest-btn-icon"
            style={{
              color: selectedClipId ? 'var(--accent-sage)' : 'var(--text-muted)',
              padding: '4px',
            }}
            title="Duplicate selected clip (Ctrl+D)"
          >
            <Copy size={13} />
          </button>

          {/* Snapping Toggle */}
          <button
            onClick={() => setSnappingEnabled(!snappingEnabled)}
            className="vnest-btn-subtle"
            style={{
              padding: '4px 6px',
              fontSize: '11px',
              backgroundColor: snappingEnabled ? 'var(--selected-surface)' : 'transparent',
              borderColor: snappingEnabled ? 'var(--accent-sage)' : 'transparent',
              color: snappingEnabled ? 'var(--accent-sage)' : 'var(--text-muted)',
            }}
            title="Toggle Snapping to Edges & Playhead"
          >
            <Magnet size={13} />
          </button>
        </div>

        <div className="vnest-divider-v" />

        {/* Group 3: Advanced Tools (Keyframes, Captions, Auto Cut, Overflow) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {/* Keyframe Curve Editor Toggle */}
          <button
            onClick={() => setShowKeyframeEditor(!showKeyframeEditor)}
            disabled={!selectedClipId}
            className="vnest-btn-subtle"
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: showKeyframeEditor ? 'var(--accent-sage)' : selectedClipId ? 'var(--text-primary)' : 'var(--text-muted)',
              borderColor: showKeyframeEditor ? 'var(--accent-sage)' : 'var(--border-subtle)',
              backgroundColor: showKeyframeEditor ? 'var(--selected-surface)' : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Open Keyframe Graph Editor for selected clip"
          >
            <Activity size={12} style={{ color: showKeyframeEditor ? 'var(--accent-sage)' : 'inherit' }} />
            <span>Keyframes</span>
          </button>

          {onOpenAutoCaptions && (
            <button
              id="timeline-auto-captions-btn"
              onClick={onOpenAutoCaptions}
              className="vnest-btn-subtle"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent-sage)',
                borderColor: 'var(--border-medium)',
                background: 'var(--bg-surface-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="AI Auto Captions & Subtitles (Whisper AI)"
            >
              <Sparkles size={12} style={{ color: 'var(--accent-sage)' }} />
              <span>Captions</span>
            </button>
          )}

          {onOpenAutoCut && (
            <button
              id="timeline-auto-cut-btn"
              onClick={onOpenAutoCut}
              className="vnest-btn-subtle"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent-sage)',
                borderColor: 'var(--border-medium)',
                background: 'var(--bg-surface-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Auto Cut: silence removal & scene slicing"
            >
              <Scissors size={12} style={{ color: 'var(--accent-sage)' }} />
              <span>Auto Cut</span>
            </button>
          )}

          {/* Overflow Menu Popover Button for Secondary Tools */}
          <div>
            <button
              ref={overflowButtonRef}
              id="timeline-more-clip-ops-btn"
              data-testid="timeline-more-clip-ops-btn"
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              className="vnest-btn-icon"
              style={{
                padding: '4px 6px',
                backgroundColor: showOverflowMenu ? 'var(--selected-surface)' : 'transparent',
                color: showOverflowMenu ? 'var(--accent-sage)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
              }}
              title="More Clip Operations (Grouping, Freeze Frame, Extract Audio, Voiceover)"
              aria-haspopup="true"
              aria-expanded={showOverflowMenu}
            >
              <MoreHorizontal size={13} />
            </button>

            <MoreClipOperationsMenu
              isOpen={showOverflowMenu}
              onClose={() => setShowOverflowMenu(false)}
              anchorRef={overflowButtonRef}
              canGroupSelected={canGroupSelected}
              isCurrentClipGrouped={isCurrentClipGrouped}
              selectedClipId={selectedClipId}
              onGroupClips={onGroupClips}
              onUngroupClips={onUngroupClips}
              onFreezeFrame={onFreezeFrame}
              onExtractAudio={onExtractAudio}
              onOpenVoiceOver={onOpenVoiceOver}
            />
          </div>
        </div>

        {/* Group 4: Right operations (Zoom to Fit, Zoom In/Out, Timecode, Collapse Toggle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
          {/* Zoom to Fit Button */}
          <button
            onClick={handleZoomToFit}
            className="vnest-btn-icon"
            style={{ padding: '4px' }}
            title="Zoom to Fit entire project into view"
          >
            <Maximize2 size={13} />
          </button>

          <button
            onClick={() => setPxPerSec((prev) => Math.max(15, prev - 15))}
            className="vnest-btn-icon"
            style={{ padding: '4px' }}
            title="Zoom Out Timeline"
          >
            <ZoomOut size={13} />
          </button>

          <span
            className="font-mono-time"
            style={{
              fontSize: '10px',
              color: 'var(--text-secondary)',
              minWidth: '40px',
              textAlign: 'center',
            }}
          >
            {Math.round(pxPerSec)} px/s
          </span>

          <button
            onClick={() => setPxPerSec((prev) => Math.min(300, prev + 15))}
            className="vnest-btn-icon"
            style={{ padding: '4px' }}
            title="Zoom In Timeline"
          >
            <ZoomIn size={13} />
          </button>

          <div className="vnest-divider-v" />

          {/* Timecode display */}
          <div
            className="font-mono-time"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-surface-1)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {formatTimecode(currentTimeMs, project.settings.fps)}
          </div>

          {/* Timeline Collapse/Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="vnest-btn-icon"
              style={{
                padding: '4px',
                color: isCollapsed ? 'var(--accent-sage)' : 'var(--text-secondary)',
              }}
              title={isCollapsed ? 'Expand Timeline' : 'Collapse Timeline'}
            >
              {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Docked Keyframe Graph Editor (if active) */}
          {showKeyframeEditor && selectedClip && (
            <div style={{ padding: '0 8px' }}>
              <KeyframeGraphEditor
                clip={selectedClip}
                currentTimeMs={currentTimeMs}
                onSeek={onSeek}
                onUpdateKeyframes={(kfs) => {
                  if (onUpdateKeyframes) onUpdateKeyframes(selectedClip.id, kfs);
                }}
                onClose={() => setShowKeyframeEditor(false)}
              />
            </div>
          )}

      {/* 2. Timeline Tracks Body */}
      <div className="vnest-timeline-body" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Left Track Headers (Width 200px) */}
        <div className="vnest-timeline-headers" style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}>
          <div className="vnest-timeline-ruler-spacer" style={{ width: '100%', height: '24px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
              TRACKS ({project.tracks.length})
            </span>
          </div>

          <div
            ref={headersRef}
            className="vnest-timeline-headers-scroll"
            style={{ flex: 1, overflowY: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {project.tracks.map((track) => {
                const isTargeted = activeTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className="vnest-timeline-track-header"
                    onClick={() => setActiveTrackId(track.id)}
                    style={{
                      height: '52px',
                      backgroundColor: track.isLocked
                        ? 'var(--bg-surface-1)'
                        : isTargeted
                        ? 'var(--selected-surface)'
                        : 'var(--bg-surface-2)',
                      borderLeft: isTargeted
                        ? '3px solid var(--accent-sage)'
                        : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                      {track.type === 'video' && <Film size={13} style={{ color: '#8EA88F', flexShrink: 0 }} />}
                      {track.type === 'overlay' && <Layers size={13} style={{ color: '#95ACA4', flexShrink: 0 }} />}
                      {track.type === 'text' && <Type size={13} style={{ color: '#B4BFA8', flexShrink: 0 }} />}
                      {track.type === 'audio' && <Music size={13} style={{ color: 'var(--accent-sage)', flexShrink: 0 }} />}

                      <span
                        style={{
                          color: track.isLocked ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '11px',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                        title={track.name}
                      >
                        {track.name}
                      </span>

                      {isTargeted && (
                        <span
                          style={{
                            fontSize: '8px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '1px 3px',
                            borderRadius: '2px',
                            backgroundColor: 'rgba(142, 168, 143, 0.22)',
                            color: 'var(--accent-sage)',
                            border: '1px solid rgba(142, 168, 143, 0.4)',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                          title="Targeted track for pasting/inserting"
                        >
                          TARGET
                        </span>
                      )}
                    </div>

                    {/* Track Controls: Visibility, Solo, Mute, Lock */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      {/* Visibility Toggle for visual tracks */}
                      {track.type !== 'audio' && onToggleTrackVisibility && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTrackVisibility(track.id);
                          }}
                          className="vnest-btn-icon"
                          style={{
                            padding: '3px',
                            color: track.isHidden ? 'var(--accent-rose)' : 'var(--text-secondary)',
                          }}
                          title={track.isHidden ? 'Show Track in Video' : 'Hide Track from Video'}
                        >
                          {track.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}

                      {/* Solo Toggle */}
                      {onToggleTrackSolo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTrackSolo(track.id);
                          }}
                          className="vnest-btn-icon"
                          style={{
                            padding: '2px 4px',
                            fontSize: '9px',
                            fontWeight: 800,
                            borderRadius: '3px',
                            backgroundColor: track.isSolo ? 'var(--accent-sage)' : 'transparent',
                            color: track.isSolo ? '#161D18' : 'var(--text-muted)',
                            border: track.isSolo ? '1px solid var(--accent-sage)' : '1px solid transparent',
                          }}
                          title={track.isSolo ? 'Un-solo Track' : 'Solo Track'}
                        >
                          S
                        </button>
                      )}

                      {/* Audio Mute Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackMute(track.id);
                        }}
                        className="vnest-btn-icon"
                        style={{
                          padding: '3px',
                          color: track.isMuted ? 'var(--accent-rose)' : 'var(--text-secondary)',
                        }}
                        title={track.isMuted ? 'Unmute Track Audio' : 'Mute Track Audio'}
                      >
                        {track.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>

                      {/* Track Lock Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackLock(track.id);
                        }}
                        className="vnest-btn-icon"
                        style={{
                          padding: '3px',
                          color: track.isLocked ? 'var(--accent-yellow)' : 'var(--text-secondary)',
                        }}
                        title={track.isLocked ? 'Unlock Track' : 'Lock Track'}
                      >
                        {track.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Scrollable Timeline Lanes & Ruler */}
        <div
          ref={lanesRef}
          onScroll={handleLanesScroll}
          className="vnest-timeline-lanes-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: `${timelineContentWidth}px`,
              minHeight: '100%',
              height: 'max-content',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Time Ruler */}
            <div
              onMouseDown={(e) => {
                setIsScrubbingRuler(true);
                const rect = lanesRef.current!.getBoundingClientRect();
                const scrollLeft = lanesRef.current!.scrollLeft;
                const relativeX = e.clientX - rect.left + scrollLeft;
                onSeek(Math.max(0, pxToMs(relativeX, pxPerSec)));
              }}
              className="vnest-timeline-ruler"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 30,
              }}
            >
              {Array.from({ length: totalTicks }).map((_, idx) => {
                const tickSec = idx * tickIntervalSec;
                const tickX = tickSec * pxPerSec;
                return (
                  <div key={idx} className="vnest-timeline-tick" style={{ left: `${tickX}px` }}>
                    <span>{formatTimecode(tickSec * 1000, project.settings.fps)}</span>
                  </div>
                );
              })}
            </div>

            {/* Track Lanes with subtle vertical time grid lines */}
            <div
              style={{
                flex: 1,
                minHeight: 'max-content',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                backgroundImage: 'linear-gradient(to right, var(--border-subtle) 1px, transparent 1px)',
                backgroundSize: `${tickIntervalSec * pxPerSec}px 100%`,
              }}
              onClick={() => {
                onSelectClip(null);
                if (onSelectMultipleClips) onSelectMultipleClips([]);
                setInternalSelectedIds([]);
              }}
            >
              {project.tracks.map((track) => (
                <div
                  key={track.id}
                  className="vnest-timeline-track-row"
                  style={{
                    height: '52px',
                    position: 'relative',
                    backgroundColor: track.isLocked
                      ? 'rgba(0, 0, 0, 0.45)'
                      : 'transparent',
                    backgroundImage: track.isLocked
                      ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 10px, rgba(0,0,0,0.3) 10px, rgba(0,0,0,0.3) 20px)'
                      : undefined,
                    cursor: track.isLocked ? 'not-allowed' : 'default',
                  }}
                  onClick={() => setActiveTrackId(track.id)}
                >
                  {/* Clips on this track */}
                  {track.clips.map((clip) => {
                    const isSelected = selectedClipId === clip.id || selectedClipIds.includes(clip.id);
                    const clipLeft = msToPx(clip.startMs, pxPerSec);
                    const rawWidth = msToPx(clip.durationMs, pxPerSec);
                    const clipWidth = Math.max(20, rawWidth - 2);

                    let badgeClass = 'vnest-clip-video';
                    if (clip.type === 'text') badgeClass = 'vnest-clip-text';
                    if (clip.type === 'overlay') badgeClass = 'vnest-clip-overlay';
                    if (clip.type === 'audio') badgeClass = 'vnest-clip-audio';
                    if (clip.type === 'element') badgeClass = 'vnest-clip-element';

                    const asset = clip.assetId ? project.assets.find((a) => a.id === clip.assetId) : undefined;
                    const slicePeaks =
                      clip.type === 'audio' && asset?.waveformPeaks && asset.waveformPeaks.length > 0
                        ? getSliceWaveformPeaks(
                            asset.waveformPeaks,
                            asset.durationMs || clip.durationMs,
                            clip.sourceStartMs,
                            clip.durationMs,
                            Math.max(20, Math.floor(clipWidth / 3.5))
                          )
                        : undefined;

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => handleClipClick(clip, e)}
                        onMouseDown={(e) => {
                          if (track.isLocked) return;
                          handleClipClick(clip, e);

                          if (activeTool === 'select') {
                            setActiveDrag({
                              mode: 'move',
                              clipId: clip.id,
                              initialMouseX: e.clientX,
                              initialStartMs: clip.startMs,
                              initialDurationMs: clip.durationMs,
                              trackId: track.id,
                              groupId: clip.groupId,
                            });
                          } else if (activeTool === 'slip') {
                            setActiveDrag({
                              mode: 'slip',
                              clipId: clip.id,
                              initialMouseX: e.clientX,
                              initialStartMs: clip.startMs,
                              initialDurationMs: clip.durationMs,
                              trackId: track.id,
                            });
                          } else if (activeTool === 'slide') {
                            setActiveDrag({
                              mode: 'slide',
                              clipId: clip.id,
                              initialMouseX: e.clientX,
                              initialStartMs: clip.startMs,
                              initialDurationMs: clip.durationMs,
                              trackId: track.id,
                            });
                          }
                        }}
                        className={`vnest-clip-block ${badgeClass} ${isSelected ? 'selected' : ''}`}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`,
                          opacity: track.isLocked ? 0.65 : 1.0,
                          cursor: track.isLocked
                            ? 'not-allowed'
                            : activeTool === 'slip'
                            ? 'ew-resize'
                            : activeTool === 'slide'
                            ? 'move'
                            : 'grab',
                        }}
                        title={`${clip.name} (${formatTimecode(clip.durationMs, project.settings.fps)}) [${activeTool.toUpperCase()}]`}
                      >
                        {/* Audio Waveform Canvas */}
                        {clip.type === 'audio' && slicePeaks && slicePeaks.length > 0 && (
                          <ClipWaveform
                            peaks={slicePeaks}
                            width={clipWidth}
                            height={44}
                            color={isSelected ? '#B0C1AE' : '#9BAF9B'}
                          />
                        )}

                        {/* Left Trim / Ripple Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (track.isLocked) return;
                            if (activeTool === 'roll') {
                              const prev = findAdjacentClip(clip, 'left');
                              if (prev) {
                                setActiveDrag({
                                  mode: 'roll',
                                  clipId: prev.id,
                                  clipIdB: clip.id,
                                  initialMouseX: e.clientX,
                                  initialStartMs: clip.startMs,
                                  initialDurationMs: clip.durationMs,
                                  trackId: track.id,
                                });
                              }
                            } else if (activeTool === 'ripple') {
                              setActiveDrag({
                                mode: 'ripple',
                                clipId: clip.id,
                                side: 'left',
                                initialMouseX: e.clientX,
                                initialStartMs: clip.startMs,
                                initialDurationMs: clip.durationMs,
                                trackId: track.id,
                              });
                            } else {
                              setActiveDrag({
                                mode: 'trim',
                                clipId: clip.id,
                                side: 'left',
                                initialMouseX: e.clientX,
                                initialStartMs: clip.startMs,
                                initialDurationMs: clip.durationMs,
                                trackId: track.id,
                              });
                            }
                          }}
                          className="vnest-trim-handle vnest-trim-handle-left"
                          style={{
                            cursor: activeTool === 'ripple' ? 'col-resize' : activeTool === 'roll' ? 'ew-resize' : 'ew-resize',
                          }}
                          title={`Drag to ${activeTool === 'ripple' ? 'ripple trim start' : activeTool === 'roll' ? 'roll edit boundary' : 'trim start'}`}
                        />

                        {/* Clip Label & Group Indicator */}
                        <div
                          style={{
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            width: '100%',
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            position: 'relative',
                            zIndex: 2,
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {clip.name}
                          </span>

                          <span
                            className="font-mono-time"
                            style={{
                              fontSize: '9px',
                              color: 'var(--text-secondary)',
                              flexShrink: 0,
                            }}
                          >
                            {formatTimecode(clip.durationMs, project.settings.fps)}
                          </span>

                          {/* Group Badge */}
                          {clip.groupId && (
                            <span
                              style={{
                                fontSize: '8px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: 'var(--selected-surface)',
                                border: '1px solid var(--accent-sage)',
                                color: 'var(--accent-sage)',
                                fontWeight: 800,
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <LinkIcon size={8} />
                              GRP
                            </span>
                          )}

                          {clip.speed !== 1.0 && (
                            <span
                              className="font-mono-time"
                              style={{
                                fontSize: '9px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                color: 'var(--accent-yellow)',
                                flexShrink: 0,
                              }}
                            >
                              {clip.speed.toFixed(1)}x
                            </span>
                          )}

                          {clip.isFrozen && (
                            <span
                              style={{
                                fontSize: '8px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(6, 182, 212, 0.4)',
                                color: '#67e8f9',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              FREEZE
                            </span>
                          )}

                          {clip.transition && clip.transition.durationMs > 0 && (
                            <span
                              style={{
                                fontSize: '8px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(6, 182, 212, 0.45)',
                                color: '#67e8f9',
                                fontWeight: 800,
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <Sparkles size={8} />
                              {clip.transition.type.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Keyframe Markers */}
                        {clip.keyframes.map((kf) => (
                          <div
                            key={kf.id}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              left: `${msToPx(kf.offsetMs, pxPerSec)}px`,
                              transform: 'translateX(-50%)',
                              pointerEvents: 'none',
                            }}
                          >
                            <Diamond size={11} style={{ color: 'var(--accent-rose)', fill: 'var(--accent-rose)' }} />
                          </div>
                        ))}

                        {/* Right Trim / Ripple Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (track.isLocked) return;
                            if (activeTool === 'roll') {
                              const next = findAdjacentClip(clip, 'right');
                              if (next) {
                                setActiveDrag({
                                  mode: 'roll',
                                  clipId: clip.id,
                                  clipIdB: next.id,
                                  initialMouseX: e.clientX,
                                  initialStartMs: clip.startMs,
                                  initialDurationMs: clip.durationMs,
                                  trackId: track.id,
                                });
                              }
                            } else if (activeTool === 'ripple') {
                              setActiveDrag({
                                mode: 'ripple',
                                clipId: clip.id,
                                side: 'right',
                                initialMouseX: e.clientX,
                                initialStartMs: clip.startMs,
                                initialDurationMs: clip.durationMs,
                                trackId: track.id,
                              });
                            } else {
                              setActiveDrag({
                                mode: 'trim',
                                clipId: clip.id,
                                side: 'right',
                                initialMouseX: e.clientX,
                                initialStartMs: clip.startMs,
                                initialDurationMs: clip.durationMs,
                                trackId: track.id,
                              });
                            }
                          }}
                          className="vnest-trim-handle vnest-trim-handle-right"
                          style={{
                            cursor: activeTool === 'ripple' ? 'col-resize' : activeTool === 'roll' ? 'ew-resize' : 'ew-resize',
                          }}
                          title={`Drag to ${activeTool === 'ripple' ? 'ripple trim end' : activeTool === 'roll' ? 'roll edit boundary' : 'trim end'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Playhead Needle & Scrubber Head */}
            <div className="vnest-playhead-line" style={{ left: `${msToPx(currentTimeMs, pxPerSec)}px` }}>
              <div
                className="vnest-playhead-head"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsScrubbingRuler(true);
                }}
                title="Drag playhead"
              />
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
