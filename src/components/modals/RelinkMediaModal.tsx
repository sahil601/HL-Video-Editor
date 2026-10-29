import React, { useState } from 'react';
import {
  X,
  Link2,
  FolderOpen,
  FileVideo,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Project, ProjectAsset } from '../../types/project';
import { relinkSingleAsset, relinkDirectoryByMatchingFiles, RelinkMatch, formatBytes } from '../../core/mediaRelinking';

interface RelinkMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  initialAssetId?: string | null;
  onUpdateProject: (updatedProject: Project, message: string) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const RelinkMediaModal: React.FC<RelinkMediaModalProps> = ({
  isOpen,
  onClose,
  project,
  initialAssetId,
  onUpdateProject,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'directory'>('single');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    initialAssetId || (project.assets.find((a) => a.isMissing)?.id ?? project.assets[0]?.id ?? '')
  );

  // Directory scan state
  const [scannedDir, setScannedDir] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [matchedResults, setMatchedResults] = useState<{
    matches: RelinkMatch[];
    relinkedCount: number;
    remainingMissingCount: number;
  } | null>(null);

  React.useEffect(() => {
    if (initialAssetId) {
      setSelectedAssetId(initialAssetId);
    }
  }, [initialAssetId]);

  if (!isOpen) return null;

  const missingAssets = project.assets.filter((a) => a.isMissing);
  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId) || project.assets[0];

  // 1. Relink single file via native file picker
  const handlePickSingleFile = async () => {
    if (!selectedAsset) return;

    if (window.vnestNative?.selectMediaFiles) {
      const files = await window.vnestNative.selectMediaFiles();
      if (files && files.length > 0) {
        const newPath = files[0];
        let fileSize: number | undefined;
        let durationMs: number | undefined;

        if (window.vnestNative.probeMedia) {
          const probe = await window.vnestNative.probeMedia(newPath);
          if (probe.success && probe.data) {
            fileSize = probe.data.fileSize;
            durationMs = probe.data.durationMs;
          }
        }

        const updated = relinkSingleAsset(project, selectedAsset.id, newPath, fileSize, durationMs);
        onUpdateProject(updated, `Relinked ${selectedAsset.name}`);
        onToast(`Successfully relinked "${selectedAsset.name}"`, 'success');
        onClose();
      }
    } else {
      // Fallback file input for browser test
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          const updated = relinkSingleAsset(project, selectedAsset.id, file.name, file.size);
          onUpdateProject(updated, `Relinked ${selectedAsset.name}`);
          onToast(`Relinked ${selectedAsset.name}`, 'success');
          onClose();
        }
      };
      input.click();
    }
  };

  // 2. Select folder to scan for batch relinking
  const handleSelectFolder = async () => {
    if (!window.vnestNative?.selectDirectory || !window.vnestNative?.scanDirectoryMedia) {
      onToast('Directory scanning requires the HL desktop application', 'warning');
      return;
    }

    try {
      setIsScanning(true);
      const dirPath = await window.vnestNative.selectDirectory();
      if (!dirPath) {
        setIsScanning(false);
        return;
      }

      setScannedDir(dirPath);
      const res = await window.vnestNative.scanDirectoryMedia(dirPath);
      if (res.success && res.files) {
        const dryRunResult = relinkDirectoryByMatchingFiles(project, res.files);
        setMatchedResults({
          matches: dryRunResult.matches,
          relinkedCount: dryRunResult.relinkedCount,
          remainingMissingCount: dryRunResult.remainingMissingCount,
        });
      } else {
        onToast(res.error || 'Failed to scan directory', 'error');
      }
    } catch (err: any) {
      onToast(`Scan error: ${err?.message || String(err)}`, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Apply batch relink matches
  const handleApplyBatchRelink = () => {
    if (!matchedResults || matchedResults.matches.length === 0) return;

    // Apply matches
    let updated = { ...project };
    for (const m of matchedResults.matches) {
      updated = relinkSingleAsset(updated, m.assetId, m.newPath, m.fileSize);
    }

    onUpdateProject(updated, `Batch relinked ${matchedResults.relinkedCount} media assets`);
    onToast(`Successfully relinked ${matchedResults.relinkedCount} files!`, 'success');
    onClose();
  };

  return (
    <div className="vnest-modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="vnest-modal-box" style={{ maxWidth: 620, width: '100%', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link2 size={20} style={{ color: 'var(--accent-sage)' }} />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Relink Media Assets
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {missingAssets.length > 0
                  ? `${missingAssets.length} missing asset${missingAssets.length > 1 ? 's' : ''} detected`
                  : 'All project assets currently linked'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '18px' }}>
          <button
            onClick={() => setActiveTab('single')}
            className={activeTab === 'single' ? 'vnest-btn-primary' : 'vnest-btn-subtle'}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Relink Single File
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={activeTab === 'directory' ? 'vnest-btn-primary' : 'vnest-btn-subtle'}
            style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderOpen size={14} />
            <span>Relink from Directory</span>
          </button>
        </div>

        {/* Tab 1: Single File Relinking */}
        {activeTab === 'single' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                SELECT ASSET TO RELINK
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                style={{ width: '100%', fontSize: '12px', padding: '8px' }}
              >
                {project.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type.toUpperCase()}) {a.isMissing ? '— [MISSING]' : '— [LINKED]'}
                  </option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileVideo size={16} style={{ color: selectedAsset.isMissing ? '#ef4444' : 'var(--accent-sage)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedAsset.name}
                  </span>
                  {selectedAsset.isMissing && (
                    <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                      MISSING
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Last known path:
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '14px' }}>
                  {selectedAsset.originalPath || selectedAsset.relativePath || 'Unknown'}
                </div>

                <button
                  onClick={handlePickSingleFile}
                  className="vnest-btn-primary"
                  style={{ width: '100%', fontSize: '12px', padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <FolderOpen size={14} />
                  <span>Choose Replacement File on Disk...</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Directory Scanning & Batch Relinking */}
        {activeTab === 'directory' && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '14px', lineHeight: 1.5 }}>
              Select a folder containing your project media. HL will scan for files matching missing asset names and reconnect them automatically without altering your edit timeline.
            </p>

            <button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="vnest-btn-subtle"
              style={{ width: '100%', fontSize: '12px', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
            >
              {isScanning ? <RefreshCw size={14} className="vnest-spin" /> : <FolderOpen size={14} />}
              <span>{isScanning ? 'Scanning Directory...' : 'Select Directory to Search...'}</span>
            </button>

            {scannedDir && (
              <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  SCANNED FOLDER
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {scannedDir}
                </span>
              </div>
            )}

            {matchedResults && (
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Scan Matches Found: {matchedResults.relinkedCount}
                  </span>
                  <span style={{ fontSize: '11px', color: matchedResults.remainingMissingCount === 0 ? 'var(--accent-sage)' : 'var(--accent-yellow)' }}>
                    {matchedResults.remainingMissingCount === 0 ? 'All missing files found!' : `${matchedResults.remainingMissingCount} still missing`}
                  </span>
                </div>

                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {matchedResults.matches.map((m) => (
                    <div key={m.assetId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <CheckCircle2 size={13} style={{ color: 'var(--accent-sage)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.assetName}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        {formatBytes(m.fileSize)}
                      </span>
                    </div>
                  ))}
                  {matchedResults.matches.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      No filename matches found in selected directory.
                    </div>
                  )}
                </div>

                {matchedResults.matches.length > 0 && (
                  <button
                    onClick={handleApplyBatchRelink}
                    className="vnest-btn-primary"
                    style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                  >
                    Apply All {matchedResults.relinkedCount} Matches
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button onClick={onClose} className="vnest-btn-subtle" style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
