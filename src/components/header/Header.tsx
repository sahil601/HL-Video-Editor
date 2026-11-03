import React, { useState, useEffect } from 'react';
import {
  Home,
  Undo2,
  Redo2,
  Save,
  Share2,
  Download,
  Check,
  Sparkles,
  Scissors,
  Crop,
  Sun,
  Moon,
  History,
  Gauge,
  AlertCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { AspectRatio, Project } from '../../types/project';
import { ExportQueueManager } from '../../core/exportQueue';
import { ExportQueueJob } from '../../types/export';

interface HeaderProps {
  project: Project;
  onUpdateProjectName: (name: string) => void;
  onUpdateAspectRatio: (ratio: AspectRatio) => void;
  onGoHome: () => void;
  onSave: () => void;
  onShare: () => void;
  onExport: () => void;
  onAutoCaptions: () => void;
  onAutoCut?: () => void;
  onWatermark?: () => void;
  onOpenRecovery?: () => void;
  onOpenCacheManager?: () => void;
  onResetLayout?: () => void;
  autosaveIntervalSec?: number;
  onUpdateAutosaveInterval?: (sec: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'autosaved' | 'error';
  theme?: 'charcoal' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onUpdateProjectName,
  onUpdateAspectRatio,
  onGoHome,
  onSave,
  onShare,
  onExport,
  onAutoCaptions,
  onAutoCut,
  onWatermark,
  onOpenRecovery,
  onOpenCacheManager,
  onResetLayout,
  autosaveIntervalSec = 60,
  onUpdateAutosaveInterval,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  theme = 'charcoal',
  onToggleTheme,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const [activeExportJob, setActiveExportJob] = useState<ExportQueueJob | null>(null);

  useEffect(() => {
    const queueManager = ExportQueueManager.getInstance();
    const unsub = queueManager.subscribe((jobs) => {
      const active = jobs.find((j) => j.status === 'rendering' || j.status === 'validating');
      setActiveExportJob(active || null);
    });
    return unsub;
  }, []);

  const ratios: { id: AspectRatio; label: string }[] = [
    { id: '16:9', label: '16:9 Widescreen' },
    { id: '9:16', label: '9:16 Vertical / Reels' },
    { id: '1:1', label: '1:1 Square' },
    { id: '4:5', label: '4:5 Portrait' },
    { id: '21:9', label: '21:9 Ultrawide' },
  ];

  const handleFinishEditingName = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onUpdateProjectName(tempName.trim());
    } else {
      setTempName(project.name);
    }
  };

  return (
    <header className="vnest-header">
      {/* Left side: Home, Project Name & Aspect Ratio */}
      <div className="vnest-header-group">
        <button
          onClick={onGoHome}
          className="vnest-btn-icon"
          title="Return to Home screen"
        >
          <Home style={{ width: 16, height: 16 }} />
        </button>

        <div className="vnest-divider-v" />

        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleFinishEditingName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishEditingName();
              if (e.key === 'Escape') {
                setTempName(project.name);
                setIsEditingName(false);
              }
            }}
            autoFocus
            style={{ width: 180, fontWeight: 700 }}
          />
        ) : (
          <div
            onClick={() => {
              setTempName(project.name);
              setIsEditingName(true);
            }}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 6,
              maxWidth: 200,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            title="Click to rename project"
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 160,
                display: 'inline-block',
              }}
            >
              {project.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>edit</span>
          </div>
        )}

        <select
          value={project.settings.aspectRatio}
          onChange={(e) => onUpdateAspectRatio(e.target.value as AspectRatio)}
          title="Change project canvas aspect ratio"
        >
          {ratios.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Autosave status & interval control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginLeft: 4 }}>
          {saveStatus === 'saved' && (
            <span style={{ color: 'var(--accent-sage)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }} title="All changes saved to project">
              <Check style={{ width: 12, height: 12 }} /> Saved
            </span>
          )}
          {saveStatus === 'autosaved' && (
            <span style={{ color: 'var(--accent-sage)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }} title="Snapshot automatically recovered and synced">
              <Check style={{ width: 12, height: 12 }} /> Autosaved
            </span>
          )}
          {saveStatus === 'saving' && (
            <span style={{ color: 'var(--accent-yellow)', fontWeight: 500 }}>Saving...</span>
          )}
          {saveStatus === 'unsaved' && (
            <span style={{ color: 'var(--text-muted)' }}>Unsaved</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }} title="Failed to save project to disk/localStorage">
              <AlertCircle style={{ width: 12, height: 12 }} /> Save Failed
            </span>
          )}

          {onUpdateAutosaveInterval && (
            <select
              value={autosaveIntervalSec}
              onChange={(e) => onUpdateAutosaveInterval(parseInt(e.target.value, 10))}
              style={{
                fontSize: 10,
                padding: '2px 4px',
                height: 22,
                borderRadius: 4,
                background: 'var(--bg-surface-3)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
              title="Configurable autosave interval (or turn off)"
            >
              <option value={30}>Auto: 30s</option>
              <option value={60}>Auto: 60s</option>
              <option value={120}>Auto: 2m</option>
              <option value={300}>Auto: 5m</option>
              <option value={0}>Auto: Off</option>
            </select>
          )}
        </div>
      </div>

      {/* Center: Undo & Redo */}
      <div className="vnest-header-group">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="vnest-btn-icon"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 style={{ width: 16, height: 16 }} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="vnest-btn-icon"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Right side: Save, Auto Tools, Share, Theme Toggle, Export */}
      <div className="vnest-header-group">
        <button
          onClick={onSave}
          className="vnest-btn-subtle"
          style={{ flexShrink: 0 }}
          title="Save Project (Ctrl+S)"
        >
          <Save style={{ width: 14, height: 14 }} />
          <span>Save</span>
        </button>

        <button
          id="header-auto-captions-btn"
          onClick={onAutoCaptions}
          className="vnest-btn-subtle"
          style={{
            background: 'var(--bg-surface-2)',
            color: 'var(--accent-sage)',
            borderColor: 'var(--border-medium)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
          title="AI Auto Captions & Speech-to-Text"
        >
          <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
          <span>Auto Captions</span>
        </button>

        {onAutoCut && (
          <button
            id="header-auto-cut-btn"
            onClick={onAutoCut}
            className="vnest-btn-subtle"
            style={{
              background: 'var(--bg-surface-2)',
              color: 'var(--accent-sage)',
              borderColor: 'var(--border-medium)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
            title="Auto Cut: silence removal & scene-based slicing (Ctrl+Shift+X)"
          >
            <Scissors style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
            <span>Auto Cut</span>
          </button>
        )}

        {onWatermark && (
          <button
            onClick={onWatermark}
            className="vnest-btn-subtle"
            style={{
              background: 'var(--bg-surface-2)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-subtle)',
              fontWeight: 600,
              flexShrink: 0,
            }}
            title="Watermark Remover: inpaint, blur, or pixelate watermarks"
          >
            <Crop style={{ width: 14, height: 14 }} />
            <span className="vnest-header-hide-narrow">Watermark</span>
          </button>
        )}

        {onOpenRecovery && (
          <button
            id="header-recovery-btn"
            onClick={onOpenRecovery}
            className="vnest-btn-subtle"
            style={{ flexShrink: 0 }}
            title="Inspect or restore project recovery snapshots"
          >
            <History style={{ width: 14, height: 14 }} />
            <span className="vnest-header-hide-narrow">Recovery</span>
          </button>
        )}

        {onOpenCacheManager && (
          <button
            id="header-cache-btn"
            onClick={onOpenCacheManager}
            className="vnest-btn-subtle"
            style={{ flexShrink: 0 }}
            title="Inspect memory/disk cache and performance profiler"
          >
            <Gauge style={{ width: 14, height: 14 }} />
            <span className="vnest-header-hide-narrow">Cache</span>
          </button>
        )}

        {onResetLayout && (
          <button
            id="header-reset-layout-btn"
            onClick={onResetLayout}
            className="vnest-btn-subtle"
            style={{ flexShrink: 0 }}
            title="Reset workspace panels to default layout"
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            <span className="vnest-header-hide-narrow">Reset Layout</span>
          </button>
        )}

        <button
          onClick={onShare}
          className="vnest-btn-secondary"
          style={{ flexShrink: 0 }}
          title="Package project into portable .vnest archive for sharing"
        >
          <Share2 style={{ width: 14, height: 14 }} />
          <span className="vnest-header-hide-narrow">Share .vnest</span>
        </button>

        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="vnest-btn-icon"
            title={`Switch to ${theme === 'light' ? 'Soft Charcoal' : 'Soft Light'} theme`}
            style={{ padding: '6px', flexShrink: 0 }}
          >
            {theme === 'light' ? <Moon style={{ width: 15, height: 15 }} /> : <Sun style={{ width: 15, height: 15 }} />}
          </button>
        )}

        <button
          onClick={onExport}
          className="vnest-btn-primary"
          style={{
            flexShrink: 0,
            minWidth: 'max-content',
            backgroundColor: activeExportJob ? 'var(--accent-indigo)' : undefined,
          }}
          title={
            activeExportJob
              ? `Exporting: ${activeExportJob.statusMessage} (${activeExportJob.progress}% - click to open queue)`
              : 'Render & Export final video via FFmpeg'
          }
        >
          {activeExportJob ? (
            <>
              <Loader2 className="vnest-spin" style={{ width: 14, height: 14 }} />
              <span>Exporting {activeExportJob.progress}%</span>
            </>
          ) : (
            <>
              <Download style={{ width: 14, height: 14 }} />
              <span>Export</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
