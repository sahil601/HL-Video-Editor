import React, { useState, useRef } from 'react';
import {
  Upload,
  Film,
  Music,
  Image as ImageIcon,
  Type,
  Sliders,
  Plus,
  Search,
  AlertTriangle,
  Play,
  Square,
  Volume2,
  Sparkles,
  Scissors,
  Shapes,
  Mic,
  Layers,
  Wand2,
  Star,
  Check,
  ArrowRight,
  Info,
  Link2,
  RotateCw,
  X,
  Gauge,
  Zap,
  LayoutGrid,
  List,
  ArrowUpDown,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import {
  ProjectAsset,
  TransitionType,
  ElementCategory,
  VideoEffectType,
  OverlayCategory,
  EffectCategory,
  TransitionCategory,
  ProxySettings,
  ProxyQuality,
} from '../../types/project';
import { formatDurationSimple } from '../../core/time';
import { SFX_PRESETS, SFX_CATEGORIES, SfxPreset, SfxCategory, generateSfxAudioBlob, filterSfxPresets } from '../../core/audioLibrary';
import { ELEMENT_PRESETS, ElementPresetDefinition, generateElementSvg } from '../../core/elements/elementDefinitions';
import { OVERLAY_PRESETS, OVERLAY_CATEGORIES, OverlayPresetDefinition, generateOverlaySvg, filterOverlayPresets } from '../../core/overlays/overlayDefinitions';
import { EFFECT_PRESETS, EFFECT_CATEGORIES, EffectPresetDefinition, filterEffectPresets } from '../../core/effects/effectDefinitions';
import { TRANSITION_PRESETS, TRANSITION_CATEGORIES, TransitionPresetDefinition, filterTransitionPresets } from '../../core/transitions/transitionDefinitions';

export type LibraryTab =
  | 'media'
  | 'audio'
  | 'sfx'
  | 'text'
  | 'elements'
  | 'overlays'
  | 'effects'
  | 'transitions';

interface MediaLibraryProps {
  assets: ProjectAsset[];
  onImportFiles: (files: FileList | File[]) => void;
  onNativeImport?: () => void;
  onAddAssetToTimeline: (asset: ProjectAsset) => void;
  onAddTextToTimeline: (presetType: 'title' | 'subtitle' | 'lowerThird' | 'caption' | 'neon') => void;
  onAddTransitionToTimeline: (transitionType: TransitionType) => void;
  onAddSfxToTimeline?: (preset: SfxPreset) => void;
  onAddElementToTimeline?: (preset: ElementPresetDefinition) => void;
  onAddOverlayToTimeline?: (preset: OverlayPresetDefinition) => void;
  onAddEffectToSelectedClip?: (effectType: VideoEffectType) => void;
  onRelinkAsset: (assetId: string) => void;
  onOpenInspector?: (asset: ProjectAsset) => void;
  onGenerateProxy?: (asset: ProjectAsset) => void;
  onCancelProxy?: (assetId: string) => void;
  onToggleAssetFavorite?: (assetId: string) => void;
  proxySettings?: ProxySettings;
  onUpdateProxySettings?: (settings: Partial<ProxySettings>) => void;
  onOpenCacheManager?: () => void;
  onOpenAutoCaptions?: () => void;
  onOpenAutoCut?: () => void;
  onOpenVoiceOver?: () => void;
  selectedClipId?: string | null;
  style?: React.CSSProperties;
  onCollapse?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  assets,
  onImportFiles,
  onNativeImport,
  onAddAssetToTimeline,
  onAddTextToTimeline,
  onAddTransitionToTimeline,
  onAddSfxToTimeline,
  onAddElementToTimeline,
  onAddOverlayToTimeline,
  onAddEffectToSelectedClip,
  onRelinkAsset,
  onOpenInspector,
  onGenerateProxy,
  onCancelProxy,
  onToggleAssetFavorite,
  proxySettings,
  onUpdateProxySettings,
  onOpenCacheManager,
  onOpenAutoCaptions,
  onOpenAutoCut,
  onOpenVoiceOver,
  selectedClipId,
  style,
  onCollapse,
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<LibraryTab>('media');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // View Mode: 'grid' (thumbnails) or 'list' (detailed table)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('hl_media_view_mode') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('hl_media_view_mode', mode);
    } catch {}
  };

  // Search, Filter & Sort state per tab
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'audio' | 'image' | 'favorites' | 'recent'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'name-asc' | 'name-desc' | 'duration-desc' | 'duration-asc' | 'size-desc'>('date-desc');
  const [sfxCategoryFilter, setSfxCategoryFilter] = useState<'all' | SfxCategory>('all');
  const [elementCategoryFilter, setElementCategoryFilter] = useState<'all' | ElementCategory>('all');
  const [overlayCategoryFilter, setOverlayCategoryFilter] = useState<'all' | OverlayCategory>('all');
  const [effectCategoryFilter, setEffectCategoryFilter] = useState<'all' | EffectCategory>('all');
  const [transitionCategoryFilter, setTransitionCategoryFilter] = useState<'all' | TransitionCategory>('all');

  // Favorites tracking for SFX presets
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('hl_sfx_favorites');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('hl_sfx_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sound FX Audition Player
  const [previewingSfxId, setPreviewingSfxId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const handleAuditionSfx = async (preset: SfxPreset) => {
    try {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
        if (previewingSfxId === preset.id) {
          setPreviewingSfxId(null);
          return;
        }
      }
      setPreviewingSfxId(preset.id);
      const blob = await generateSfxAudioBlob(preset.id);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      audio.onended = () => {
        setPreviewingSfxId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      console.warn('Audition failed:', e);
      setPreviewingSfxId(null);
    }
  };

  // Filtered & Sorted Media Assets
  const filteredAssets = assets
    .filter((asset) => {
      if (mediaFilter === 'video' || mediaFilter === 'audio' || mediaFilter === 'image') {
        if (asset.type !== mediaFilter) return false;
      } else if (mediaFilter === 'favorites') {
        if (!asset.isFavorite) return false;
      } else if (mediaFilter === 'recent') {
        // Shown and sorted by recency below
      }
      if (searchQuery.trim() && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (mediaFilter === 'recent') {
        return (b.importedAt || 0) - (a.importedAt || 0);
      }
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'duration-desc':
          return (b.durationMs || 0) - (a.durationMs || 0);
        case 'duration-asc':
          return (a.durationMs || 0) - (b.durationMs || 0);
        case 'size-desc':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'date-desc':
        default:
          return (b.importedAt || 0) - (a.importedAt || 0);
      }
    });

  const filteredSfx = filterSfxPresets(SFX_PRESETS, sfxCategoryFilter, searchQuery);
  const filteredOverlays = filterOverlayPresets(OVERLAY_PRESETS, overlayCategoryFilter, searchQuery);
  const filteredEffects = filterEffectPresets(EFFECT_PRESETS, effectCategoryFilter, searchQuery);
  const filteredTransitions = filterTransitionPresets(TRANSITION_PRESETS, transitionCategoryFilter, searchQuery);

  const tabButton = (id: LibraryTab, label: string, icon: React.ReactNode) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          setSearchQuery('');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '6px 2px',
          fontSize: 10,
          fontWeight: 600,
          borderRadius: 5,
          cursor: 'pointer',
          background: isActive ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
          color: isActive ? '#161D18' : 'var(--text-secondary)',
          border: isActive ? '1px solid var(--accent-sage)' : '1px solid var(--border-subtle)',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="vnest-sidebar-left" style={style}>
      {/* Panel Header & Collapse Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-surface-1)',
          borderBottom: '1px solid var(--border-subtle)',
          minHeight: '28px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
          }}
        >
          Media & Assets
        </span>
        {onCollapse && (
          <button
            id="library-collapse-btn"
            onClick={onCollapse}
            className="vnest-btn-icon"
            style={{ padding: '3px', color: 'var(--text-secondary)' }}
            title="Collapse Media Library"
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {/* 8-Tab Organized Navigation Bar (4x2 Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 3,
          padding: 6,
          background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {tabButton('media', 'Media', <Film size={11} />)}
        {tabButton('audio', 'Audio', <Music size={11} />)}
        {tabButton('sfx', 'Sound FX', <Volume2 size={11} />)}
        {tabButton('text', 'Text', <Type size={11} />)}
        {tabButton('elements', 'Elements', <Shapes size={11} />)}
        {tabButton('overlays', 'Overlays', <Layers size={11} />)}
        {tabButton('effects', 'Effects', <Wand2 size={11} />)}
        {tabButton('transitions', 'Trans', <Sparkles size={11} />)}
      </div>

      {/* ----------------- TAB 1: MEDIA ----------------- */}
      {activeTab === 'media' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onImportFiles(e.dataTransfer.files);
            }
          }}
          style={{
            flex: 1,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
            border: isDraggingOver ? '2px dashed var(--accent-sage)' : '2px dashed transparent',
            borderRadius: 8,
            transition: 'border 0.15s ease',
          }}
        >
          {/* Native Import & Dropzone */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              id="btn-import-files"
              onClick={onNativeImport || (() => document.getElementById('media-file-input')?.click())}
              className="vnest-btn-primary"
              style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '7px 10px', fontWeight: 600 }}
              title="Import video, audio, or images from your computer"
            >
              <Upload size={13} /> Import Files
            </button>
            <input
              type="file"
              multiple
              id="media-file-input"
              style={{ display: 'none' }}
              accept="video/*,audio/*,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Quick AI & Smart Tools Row */}
          <div style={{ display: 'flex', gap: 6 }}>
            {onOpenAutoCut && (
              <button
                id="library-auto-cut-btn"
                onClick={onOpenAutoCut}
                className="vnest-btn-subtle"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  fontSize: 10,
                  padding: '5px 8px',
                  color: 'var(--accent-sage)',
                  borderColor: 'var(--border-medium)',
                  background: 'var(--bg-surface-2)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Auto Cut: silence removal & scene-based slicing"
              >
                <Scissors size={12} style={{ color: 'var(--accent-sage)' }} /> Auto Cut
              </button>
            )}
            {onOpenAutoCaptions && (
              <button
                id="library-auto-captions-btn"
                onClick={onOpenAutoCaptions}
                className="vnest-btn-subtle"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  fontSize: 10,
                  padding: '5px 8px',
                  color: 'var(--accent-sage)',
                  borderColor: 'var(--border-medium)',
                  background: 'var(--bg-surface-2)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="AI Auto Captions & Subtitles"
              >
                <Sparkles size={12} style={{ color: 'var(--accent-sage)' }} /> Auto Captions
              </button>
            )}
          </div>

          {/* Missing Media Alert Banner */}
          {assets.some((a) => a.isMissing) && (
            <div
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                background: 'rgba(212, 180, 111, 0.15)',
                border: '1px solid #7D6B47',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#EFE3C7',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={13} style={{ color: 'var(--accent-yellow)' }} />
                <span>{assets.filter((a) => a.isMissing).length} media file(s) missing</span>
              </span>
              <button
                onClick={() => onRelinkAsset('')}
                className="vnest-btn-subtle"
                style={{ padding: '2px 8px', fontSize: 10, color: 'var(--accent-yellow)', borderColor: '#7D6B47' }}
                title="Open batch relinking modal to scan directory and restore links"
              >
                Relink All
              </button>
            </div>
          )}

          {/* Proxy Playback & Cache Control Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              background: 'var(--bg-surface-2)',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              fontSize: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Proxy:</span>
              <button
                id="proxy-playback-toggle"
                onClick={() => onUpdateProxySettings?.({ enabled: !proxySettings?.enabled })}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 10,
                  background: proxySettings?.enabled !== false ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
                  color: proxySettings?.enabled !== false ? '#161D18' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Toggle proxy video playback for smoother editing"
              >
                {proxySettings?.enabled !== false ? 'ON' : 'OFF'}
              </button>
              <select
                id="proxy-quality-select"
                value={proxySettings?.quality || '540p'}
                onChange={(e) => onUpdateProxySettings?.({ quality: e.target.value as ProxyQuality })}
                style={{
                  padding: '1px 4px',
                  fontSize: 10,
                  height: 20,
                  borderRadius: 4,
                  background: 'var(--bg-surface-3)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Select proxy generation resolution profile"
              >
                <option value="360p">360p (Fast)</option>
                <option value="540p">540p (Balanced)</option>
                <option value="720p">720p (HD)</option>
              </select>
            </div>

            {onOpenCacheManager && (
              <button
                onClick={onOpenCacheManager}
                className="vnest-btn-subtle"
                style={{ padding: '2px 6px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
                title="Inspect caches, memory limits, and profiler"
              >
                <Gauge size={11} /> Cache
              </button>
            )}
          </div>

          {/* Filter Pills: All, Video, Audio, Image, Favorites, Recent */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'video', label: 'Video' },
                { id: 'audio', label: 'Audio' },
                { id: 'image', label: 'Image' },
                { id: 'favorites', label: '★ Favs' },
                { id: 'recent', label: 'Recent' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setMediaFilter(t.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: mediaFilter === t.id ? 'var(--selected-surface)' : 'var(--bg-surface-3)',
                  color: mediaFilter === t.id ? 'var(--accent-sage)' : 'var(--text-secondary)',
                  border: mediaFilter === t.id ? '1px solid var(--accent-sage)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search, Sort & View Mode Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 26, fontSize: 11, height: 26 }}
              />
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                fontSize: 10,
                height: 26,
                padding: '0 4px',
                borderRadius: 4,
                background: 'var(--bg-surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                maxWidth: 95,
              }}
              title="Sort imported media"
            >
              <option value="date-desc">Newest</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="duration-desc">Duration (Long)</option>
              <option value="duration-asc">Duration (Short)</option>
              <option value="size-desc">File Size</option>
            </select>

            {/* View Mode Toggle: Grid vs List */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-surface-2)',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                padding: 1,
              }}
            >
              <button
                onClick={() => handleSetViewMode('grid')}
                className="vnest-btn-icon"
                style={{
                  padding: '3px 5px',
                  borderRadius: 3,
                  backgroundColor: viewMode === 'grid' ? 'var(--selected-surface)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--accent-sage)' : 'var(--text-muted)',
                }}
                title="Thumbnail Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => handleSetViewMode('list')}
                className="vnest-btn-icon"
                style={{
                  padding: '3px 5px',
                  borderRadius: 3,
                  backgroundColor: viewMode === 'list' ? 'var(--selected-surface)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--accent-sage)' : 'var(--text-muted)',
                }}
                title="Detailed List View"
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Asset Rendering: Empty State, Grid View, or List View */}
          {assets.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: 'var(--bg-surface-2)',
                borderRadius: 8,
                border: '1px dashed var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Upload size={28} style={{ color: 'var(--accent-sage)', opacity: 0.7 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Your Media Library is Empty
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 220, lineHeight: 1.4 }}>
                Import video, audio, or images from your device, or drag files directly here.
              </div>
              <button
                onClick={onNativeImport || (() => document.getElementById('media-file-input')?.click())}
                className="vnest-btn-primary"
                style={{ fontSize: 11, padding: '6px 14px', marginTop: 4 }}
              >
                <Upload size={12} /> Import Media
              </button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 12px',
                color: 'var(--text-muted)',
                fontSize: 11,
                background: 'var(--bg-surface-2)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>No media matches your filter or search.</div>
              <button
                onClick={() => {
                  setMediaFilter('all');
                  setSearchQuery('');
                }}
                className="vnest-btn-subtle"
                style={{ marginTop: 8, fontSize: 10, padding: '3px 10px' }}
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* =================== THUMBNAIL GRID VIEW =================== */
            <div className="vnest-media-grid">
              {filteredAssets.map((asset) => {
                const isVideo = asset.type === 'video';
                const isAudio = asset.type === 'audio';
                const isImage = asset.type === 'image';
                const formattedDuration = formatDurationSimple(asset.durationMs);
                const resolutionStr = asset.width && asset.height ? `${asset.width}x${asset.height}` : null;
                const sizeStr = asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : '';

                return (
                  <div
                    key={asset.id}
                    className={`vnest-card vnest-media-grid-card ${asset.isMissing ? 'missing' : ''}`}
                    onDoubleClick={() => onAddAssetToTimeline(asset)}
                    title={`${asset.name}\n${formattedDuration}${resolutionStr ? ' • ' + resolutionStr : ''}${sizeStr ? ' • ' + sizeStr : ''}\nDouble-click to add to timeline`}
                  >
                    {/* Thumbnail box */}
                    <div className="vnest-media-grid-thumb">
                      {isImage && asset.blobUrl ? (
                        <img src={asset.blobUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : isVideo && asset.thumbnailUrl ? (
                        <img src={asset.thumbnailUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {isVideo && <Film size={22} style={{ color: 'var(--accent-sage)' }} />}
                          {isAudio && <Music size={22} style={{ color: 'var(--accent-emerald)' }} />}
                          {isImage && <ImageIcon size={22} style={{ color: 'var(--accent-cyan)' }} />}
                        </div>
                      )}

                      {/* Favorite Star Button */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleAssetFavorite) {
                            onToggleAssetFavorite(asset.id);
                          } else {
                            asset.isFavorite = !asset.isFavorite;
                          }
                        }}
                        className={`vnest-media-star-btn ${asset.isFavorite ? 'active' : ''}`}
                        title={asset.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                      >
                        <Star size={11} fill={asset.isFavorite ? '#E5C07B' : 'none'} color={asset.isFavorite ? '#E5C07B' : '#ffffff'} />
                      </span>

                      {/* Duration Pill */}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          right: 4,
                          background: 'rgba(0, 0, 0, 0.75)',
                          padding: '1px 4px',
                          borderRadius: 3,
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          color: '#ffffff',
                          fontWeight: 600,
                        }}
                      >
                        {formattedDuration}
                      </span>

                      {/* Resolution / FPS Pill */}
                      {resolutionStr && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 3,
                            left: 4,
                            background: 'rgba(0, 0, 0, 0.65)',
                            padding: '1px 3px',
                            borderRadius: 3,
                            fontSize: 8,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {asset.height}p
                        </span>
                      )}
                    </div>

                    {/* Metadata & Actions Box */}
                    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: asset.isMissing ? 'var(--accent-yellow)' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.name}
                      </div>

                      {/* Badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {asset.isMissing && (
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: 'var(--accent-yellow)',
                              background: 'rgba(212, 180, 111, 0.2)',
                              padding: '0 3px',
                              borderRadius: 2,
                            }}
                          >
                            MISSING
                          </span>
                        )}
                        {isVideo && asset.proxyStatus === 'ready' && (
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: 'var(--accent-sage)',
                              background: 'rgba(143, 184, 148, 0.2)',
                              padding: '0 3px',
                              borderRadius: 2,
                            }}
                          >
                            PROXY
                          </span>
                        )}
                        {sizeStr && (
                          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                            {sizeStr}
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                        <button
                          onClick={() => onAddAssetToTimeline(asset)}
                          className="vnest-btn-subtle"
                          style={{ padding: '2px 6px', fontSize: 9, color: 'var(--accent-sage)' }}
                          title="Add to timeline"
                        >
                          <Plus size={10} /> Add
                        </button>

                        <div style={{ display: 'flex', gap: 2 }}>
                          {onOpenInspector && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInspector(asset);
                              }}
                              className="vnest-btn-icon"
                              style={{ padding: '2px' }}
                              title="Inspect technical media metadata"
                            >
                              <Info size={11} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRelinkAsset(asset.id);
                            }}
                            className="vnest-btn-icon"
                            style={{ padding: '2px', color: asset.isMissing ? 'var(--accent-yellow)' : undefined }}
                            title="Relink or replace source file"
                          >
                            <Link2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* =================== DETAILED LIST VIEW =================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filteredAssets.map((asset) => {
                const isVideo = asset.type === 'video';
                const isAudio = asset.type === 'audio';
                const isImage = asset.type === 'image';
                const formattedDuration = formatDurationSimple(asset.durationMs);
                const resolutionStr = asset.width && asset.height ? `${asset.width}x${asset.height}` : '—';
                const fpsStr = asset.fps ? `${asset.fps}fps` : '';
                const sizeStr = asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—';

                return (
                  <div
                    key={asset.id}
                    className="vnest-card"
                    onDoubleClick={() => onAddAssetToTimeline(asset)}
                    style={{
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                      borderColor: asset.isMissing ? '#7D6B47' : undefined,
                    }}
                    title="Double-click to add to timeline"
                  >
                    {/* Favorite Star */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleAssetFavorite) {
                          onToggleAssetFavorite(asset.id);
                        } else {
                          asset.isFavorite = !asset.isFavorite;
                        }
                      }}
                      className="vnest-btn-icon"
                      style={{ padding: '2px', flexShrink: 0, display: 'inline-flex', cursor: 'pointer' }}
                      title={asset.isFavorite ? 'Remove favorite' : 'Add favorite'}
                    >
                      <Star size={12} fill={asset.isFavorite ? '#E5C07B' : 'none'} color={asset.isFavorite ? '#E5C07B' : 'var(--text-muted)'} />
                    </span>

                    {/* Type icon */}
                    <div style={{ flexShrink: 0 }}>
                      {isVideo && <Film size={13} color="var(--accent-sage)" />}
                      {isAudio && <Music size={13} color="var(--accent-emerald)" />}
                      {isImage && <ImageIcon size={13} color="var(--accent-cyan)" />}
                    </div>

                    {/* Name & Details Column */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 11,
                          color: asset.isMissing ? 'var(--accent-yellow)' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-muted)' }}>
                        <span className="font-mono-time">{formattedDuration}</span>
                        {resolutionStr !== '—' && <span>{resolutionStr} {fpsStr}</span>}
                        <span>{sizeStr}</span>
                        {asset.isMissing && (
                          <span style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>MISSING</span>
                        )}
                        {isVideo && asset.proxyStatus === 'ready' && (
                          <span style={{ color: 'var(--accent-sage)', fontWeight: 700 }}>PROXY</span>
                        )}
                      </div>
                    </div>

                    {/* Row Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => onAddAssetToTimeline(asset)}
                        className="vnest-btn-subtle"
                        style={{ padding: '3px 8px', fontSize: 10, color: 'var(--accent-sage)', fontWeight: 600 }}
                        title="Add to timeline"
                      >
                        <Plus size={11} /> Add
                      </button>
                      {onOpenInspector && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInspector(asset);
                          }}
                          className="vnest-btn-icon"
                          style={{ padding: '3px' }}
                          title="Technical Media Inspector"
                        >
                          <Info size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRelinkAsset(asset.id);
                        }}
                        className="vnest-btn-icon"
                        style={{ padding: '3px', color: asset.isMissing ? 'var(--accent-yellow)' : undefined }}
                        title="Relink or replace source path"
                      >
                        <Link2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- TAB 2: AUDIO ----------------- */}
      {activeTab === 'audio' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Audio & Voice-Over
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Record microphone voice-overs or manage background music tracks.
            </p>
          </div>

          {onOpenVoiceOver && (
            <button
              onClick={onOpenVoiceOver}
              className="vnest-btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                padding: '8px 12px',
                fontSize: 11,
              }}
            >
              <Mic size={14} /> Record Voice-Over
            </button>
          )}

          <div
            onClick={() => setActiveTab('sfx')}
            className="vnest-card"
            style={{
              padding: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
              border: '1px solid rgba(168,85,247,0.3)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>Browse Built-in Sound FX</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>24+ synthesized whooshes, impacts & UI sounds</div>
            </div>
            <ArrowRight size={14} color="var(--accent-sage)" />
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            Imported Audio Files ({assets.filter((a) => a.type === 'audio').length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assets.filter((a) => a.type === 'audio').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 10, color: 'var(--text-muted)' }}>
                No audio tracks imported. Use "Import Files" or Record Voice-Over.
              </div>
            ) : (
              assets.filter((a) => a.type === 'audio').map((asset) => (
                <div
                  key={asset.id}
                  className="vnest-card"
                  style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <Music size={13} color="var(--accent-emerald)" />
                    <span style={{ fontSize: 11, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.name}
                    </span>
                  </div>
                  <button
                    onClick={() => onAddAssetToTimeline(asset)}
                    className="vnest-btn-subtle"
                    style={{ padding: '2px 6px', fontSize: 10, color: 'var(--accent-emerald)' }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: SOUND FX ----------------- */}
      {activeTab === 'sfx' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Free Built-in Sound FX ({SFX_PRESETS.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              100% original, royalty-free synthesized audio effects for cuts, impacts, and transitions.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search whooshes, impacts, beeps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 26, fontSize: 11, height: 28 }}
            />
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSfxCategoryFilter('all')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 12,
                fontWeight: 600,
                backgroundColor: sfxCategoryFilter === 'all' ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
                color: sfxCategoryFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All ({SFX_PRESETS.length})
            </button>
            {SFX_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSfxCategoryFilter(cat.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: sfxCategoryFilter === cat.id ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
                  color: sfxCategoryFilter === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* SFX List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredSfx.map((preset) => {
              const isPlaying = previewingSfxId === preset.id;
              const isFav = !!favorites[preset.id];

              return (
                <div
                  key={preset.id}
                  className="vnest-card"
                  style={{
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    background: isPlaying ? 'var(--selected-surface)' : 'var(--bg-surface-2)',
                    borderColor: isPlaying ? 'var(--accent-sage)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => handleAuditionSfx(preset)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        background: isPlaying ? 'var(--accent-rose)' : 'var(--bg-surface-3)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title={isPlaying ? 'Stop preview' : 'Audition sound'}
                    >
                      {isPlaying ? <Square size={10} fill="#ffffff" /> : <Play size={11} fill="#ffffff" />}
                    </button>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preset.name}
                        </span>
                        <span className="vnest-badge" style={{ fontSize: 8, padding: '1px 4px' }}>
                          {preset.category.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {preset.durationSec}s • {preset.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => toggleFavorite(preset.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: isFav ? '#fbbf24' : 'var(--text-muted)',
                        padding: 2,
                      }}
                      title="Favorite"
                    >
                      <Star size={13} fill={isFav ? '#fbbf24' : 'none'} />
                    </button>

                    {onAddSfxToTimeline && (
                      <button
                        onClick={() => onAddSfxToTimeline(preset)}
                        className="vnest-btn-subtle"
                        style={{ padding: '2px 6px', fontSize: 10, color: 'var(--accent-sage)' }}
                        title="Add sound to timeline"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------- TAB 4: TEXT ----------------- */}
      {activeTab === 'text' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Typography & Captions
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Add text layers, title cards, lower thirds, or generate AI captions.
            </p>
          </div>

          {onOpenAutoCaptions && (
            <button
              onClick={onOpenAutoCaptions}
              className="vnest-btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '8px 12px',
                fontSize: 11,
              }}
            >
              <Sparkles size={14} /> AI Auto-Captions (Whisper)
            </button>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            Text Style Presets
          </div>

          {[
            { id: 'title' as const, name: 'Bold Headline Title', desc: 'Large cinematic impact title' },
            { id: 'subtitle' as const, name: 'Subtitle / Description', desc: 'Clean centered body text' },
            { id: 'lowerThird' as const, name: 'Lower Third Banner', desc: 'Name & title overlay graphic' },
            { id: 'neon' as const, name: 'Cyber Neon Title', desc: 'Glowing electric text style' },
            { id: 'caption' as const, name: 'Social Speech Caption', desc: 'Boxed high contrast social subtitle' },
          ].map((t) => (
            <div
              key={t.id}
              onClick={() => onAddTextToTimeline(t.id)}
              className="vnest-card"
              style={{ padding: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.desc}</div>
              </div>
              <Plus size={14} color="var(--accent-sage)" />
            </div>
          ))}
        </div>
      )}

      {/* ----------------- TAB 5: ELEMENTS ----------------- */}
      {activeTab === 'elements' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Elements & Graphics Library ({ELEMENT_PRESETS.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Original vector graphics, shapes, arrows, frames, and speech bubbles for video overlays.
            </p>
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['all', 'shape', 'arrow', 'frame', 'bubble'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setElementCategoryFilter(cat)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: elementCategoryFilter === cat ? 'var(--accent-purple)' : 'var(--bg-surface-3)',
                  color: elementCategoryFilter === cat ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {cat === 'all' ? 'All' : cat === 'bubble' ? 'Bubbles' : `${cat}s`}
              </button>
            ))}
          </div>

          {/* Grid of Elements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ELEMENT_PRESETS.filter((p) => elementCategoryFilter === 'all' || p.category === elementCategoryFilter).map((preset) => {
              const svgData = generateElementSvg(preset.defaultProperties, 140, 90);

              return (
                <div
                  key={preset.id}
                  className="vnest-card"
                  style={{
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => onAddElementToTimeline && onAddElementToTimeline(preset)}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 65,
                      background: 'rgba(0, 0, 0, 0.45)',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                    }}
                    dangerouslySetInnerHTML={{ __html: svgData }}
                  />

                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preset.name}
                    </div>
                    {onAddElementToTimeline && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddElementToTimeline(preset);
                        }}
                        className="vnest-btn-subtle"
                        style={{ padding: '2px 5px', fontSize: 10, color: 'var(--accent-purple)' }}
                        title="Add to timeline"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------- TAB 6: OVERLAYS ----------------- */}
      {activeTab === 'overlays' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Built-in Overlays ({OVERLAY_PRESETS.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Light leaks, film grain, dust, rain, VHS tracking, letterbox bars & social frames.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search overlays by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 26, fontSize: 11, height: 28 }}
            />
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => setOverlayCategoryFilter('all')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 12,
                fontWeight: 600,
                backgroundColor: overlayCategoryFilter === 'all' ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
                color: overlayCategoryFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All ({OVERLAY_PRESETS.length})
            </button>
            {OVERLAY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setOverlayCategoryFilter(cat.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: overlayCategoryFilter === cat.id ? 'var(--accent-sage)' : 'var(--bg-surface-3)',
                  color: overlayCategoryFilter === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Overlays Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {filteredOverlays.map((preset) => {
              const svgThumb = generateOverlaySvg(preset.id, 160, 90, { opacity: 0.95 });

              return (
                <div
                  key={preset.id}
                  className="vnest-card"
                  style={{
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => onAddOverlayToTimeline && onAddOverlayToTimeline(preset)}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 70,
                      background: '#09090b',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    dangerouslySetInnerHTML={{ __html: svgThumb }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preset.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="vnest-badge" style={{ fontSize: 8, padding: '1px 4px' }}>
                        {preset.recommendedBlendMode.toUpperCase()}
                      </span>
                      {onAddOverlayToTimeline && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddOverlayToTimeline(preset);
                          }}
                          className="vnest-btn-subtle"
                          style={{ padding: '2px 5px', fontSize: 10, color: 'var(--accent-sage)' }}
                          title="Add overlay to timeline"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------- TAB 7: EFFECTS & VFX ----------------- */}
      {activeTab === 'effects' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Visual Effects & VFX ({EFFECT_PRESETS.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Cinematic looks, RGB split, motion blur, camera shake, glow, and film grain.
            </p>
          </div>

          {!selectedClipId && (
            <div
              style={{
                padding: '6px 10px',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: 6,
                fontSize: 10,
                color: '#facc15',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertTriangle size={12} />
              <span>Select a clip on the timeline to apply effects directly.</span>
            </div>
          )}

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search effects by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 26, fontSize: 11, height: 28 }}
            />
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => setEffectCategoryFilter('all')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 12,
                fontWeight: 600,
                backgroundColor: effectCategoryFilter === 'all' ? 'var(--accent-amber)' : 'var(--bg-surface-3)',
                color: effectCategoryFilter === 'all' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All ({EFFECT_PRESETS.length})
            </button>
            {EFFECT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setEffectCategoryFilter(cat.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: effectCategoryFilter === cat.id ? 'var(--accent-amber)' : 'var(--bg-surface-3)',
                  color: effectCategoryFilter === cat.id ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Effects List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredEffects.map((preset) => (
              <div
                key={preset.type}
                className="vnest-card"
                style={{
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  cursor: selectedClipId ? 'pointer' : 'default',
                }}
                onClick={() => onAddEffectToSelectedClip && onAddEffectToSelectedClip(preset.type)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000000',
                      flexShrink: 0,
                    }}
                  >
                    <Wand2 size={13} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {preset.description}
                    </div>
                  </div>
                </div>

                <button
                  disabled={!selectedClipId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAddEffectToSelectedClip) onAddEffectToSelectedClip(preset.type);
                  }}
                  className="vnest-btn-subtle"
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    color: selectedClipId ? 'var(--accent-amber)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                  title={selectedClipId ? 'Apply to selected clip' : 'Select a clip first'}
                >
                  <Plus size={11} /> Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- TAB 8: TRANSITIONS ----------------- */}
      {activeTab === 'transitions' && (
        <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Working Transitions ({TRANSITION_PRESETS.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Cross dissolves, directional wipes, push slides, zoom warps, flash & glitch cuts.
            </p>
          </div>

          {!selectedClipId && (
            <div
              style={{
                padding: '6px 10px',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: 6,
                fontSize: 10,
                color: '#22d3ee',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={12} />
              <span>Select a clip on the timeline to attach transition entrance.</span>
            </div>
          )}

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search dissolves, slides, wipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 26, fontSize: 11, height: 28 }}
            />
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => setTransitionCategoryFilter('all')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 12,
                fontWeight: 600,
                backgroundColor: transitionCategoryFilter === 'all' ? 'var(--accent-cyan)' : 'var(--bg-surface-3)',
                color: transitionCategoryFilter === 'all' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All ({TRANSITION_PRESETS.length})
            </button>
            {TRANSITION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setTransitionCategoryFilter(cat.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  borderRadius: 12,
                  fontWeight: 600,
                  backgroundColor: transitionCategoryFilter === cat.id ? 'var(--accent-cyan)' : 'var(--bg-surface-3)',
                  color: transitionCategoryFilter === cat.id ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Transition Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {filteredTransitions.map((preset) => (
              <div
                key={preset.type}
                className="vnest-card"
                style={{
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  cursor: selectedClipId ? 'pointer' : 'default',
                }}
                onClick={() => onAddTransitionToTimeline(preset.type)}
              >
                <div
                  style={{
                    width: '100%',
                    height: 55,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Sparkles size={16} color="var(--accent-cyan)" />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 6,
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {preset.category}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preset.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>{(preset.defaultDurationMs / 1000).toFixed(2)}s</span>
                    <button
                      disabled={!selectedClipId}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTransitionToTimeline(preset.type);
                      }}
                      className="vnest-btn-subtle"
                      style={{ padding: '1px 5px', fontSize: 9, color: 'var(--accent-cyan)' }}
                      title="Apply transition"
                    >
                      <Plus size={10} /> Apply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
