import React, { useState, useEffect } from 'react';
import {
  X,
  Gauge,
  HardDrive,
  Cpu,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { profiler } from '../../core/profiler';
import { waveformCache, thumbnailCache, previewFrameCache, clearAllMemoryCaches } from '../../core/cache';
import { formatBytes } from '../../core/mediaRelinking';

interface CacheManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CacheManagerModal: React.FC<CacheManagerModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [diskStats, setDiskStats] = useState<{
    totalSizeBytes: number;
    proxyCount: number;
    proxyDir?: string;
  }>({ totalSizeBytes: 0, proxyCount: 0 });
  const [isClearing, setIsClearing] = useState(false);
  const [snapshot, setSnapshot] = useState(profiler.getSnapshot());

  const refreshStats = async () => {
    setSnapshot(profiler.getSnapshot());
    if (window.vnestNative?.getCacheStats) {
      try {
        const res = await window.vnestNative.getCacheStats();
        if (res.success) {
          setDiskStats({
            totalSizeBytes: res.totalSizeBytes,
            proxyCount: res.proxyCount,
            proxyDir: res.proxyDir,
          });
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const wfStats = waveformCache.getStats();
  const thumbStats = thumbnailCache.getStats();
  const prevStats = previewFrameCache.getStats();

  const handleClearMemoryCaches = () => {
    clearAllMemoryCaches();
    refreshStats();
    onToast('In-memory waveform & thumbnail caches cleared', 'info');
  };

  const handleClearDiskCache = async () => {
    if (!window.vnestNative?.clearDiskCache) {
      handleClearMemoryCaches();
      return;
    }

    try {
      setIsClearing(true);
      const res = await window.vnestNative.clearDiskCache({ clearProxies: true });
      if (res.success) {
        clearAllMemoryCaches();
        await refreshStats();
        onToast(`Disk cache cleared (${formatBytes(res.clearedBytes)} freed, ${res.deletedFiles} files)`, 'success');
      } else {
        onToast(res.error || 'Failed to clear cache', 'error');
      }
    } catch (e: any) {
      onToast(`Error clearing cache: ${e?.message || String(e)}`, 'error');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="vnest-modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="vnest-modal-box" style={{ maxWidth: 580, width: '100%', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gauge size={20} style={{ color: 'var(--accent-sage)' }} />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Performance & Cache Manager
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Inspect bounded memory caches, latency profiler, and proxy storage
              </span>
            </div>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Latency & Profiler Metrics */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Zap size={13} style={{ color: 'var(--accent-yellow)' }} />
            <span>PLAYBACK & RENDER PROFILING</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Seek Latency</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {snapshot.metrics['seek'] ? `${snapshot.metrics['seek'].avgDurationMs} ms` : '< 16 ms'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Canvas Render</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {snapshot.metrics['render_frame'] ? `${snapshot.metrics['render_frame'].avgDurationMs} ms` : '~ 2 ms'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Waveform Extraction</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {snapshot.metrics['extract_waveform'] ? `${snapshot.metrics['extract_waveform'].avgDurationMs} ms` : 'Cached'}
              </span>
            </div>
          </div>
        </div>

        {/* Memory Caches */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              <Cpu size={13} style={{ color: 'var(--accent-blue)' }} />
              <span>BOUNDED MEMORY LRU CACHES</span>
            </div>
            <button
              onClick={handleClearMemoryCaches}
              className="vnest-btn-subtle"
              style={{ fontSize: '10px', padding: '2px 8px', height: 'auto' }}
            >
              Purge Memory
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Waveforms</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {wfStats.entries} / {wfStats.maxEntries} ({formatBytes(wfStats.estimatedSizeBytes)})
              </span>
              <span style={{ fontSize: '9px', color: 'var(--accent-sage)', display: 'block' }}>
                Hit ratio: {(wfStats.hitRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Thumbnails</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {thumbStats.entries} / {thumbStats.maxEntries} ({formatBytes(thumbStats.estimatedSizeBytes)})
              </span>
              <span style={{ fontSize: '9px', color: 'var(--accent-sage)', display: 'block' }}>
                Hit ratio: {(thumbStats.hitRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Preview Frames</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {prevStats.entries} / {prevStats.maxEntries} ({formatBytes(prevStats.estimatedSizeBytes)})
              </span>
            </div>
          </div>
        </div>

        {/* Disk Proxy Storage */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              <HardDrive size={13} style={{ color: 'var(--accent-purple)' }} />
              <span>PROXY MEDIA DISK STORAGE</span>
            </div>
            <button
              onClick={handleClearDiskCache}
              disabled={isClearing || diskStats.totalSizeBytes === 0}
              className="vnest-btn-subtle"
              style={{ fontSize: '10px', padding: '2px 8px', height: 'auto', color: 'var(--accent-red)' }}
            >
              {isClearing ? 'Clearing...' : 'Clear Proxy Storage'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                {formatBytes(diskStats.totalSizeBytes)}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                ({diskStats.proxyCount} proxy video{diskStats.proxyCount !== 1 ? 's' : ''})
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--accent-sage)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> Safe Cleanup (Originals Untouched)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="vnest-btn-primary" style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
