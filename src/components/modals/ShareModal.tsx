import React, { useState } from 'react';
import {
  X,
  Share2,
  Package,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react';
import { Project } from '../../types/project';
import { createVnestPackage } from '../../core/package';

interface ShareModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  assetBinaryMap: Map<string, Blob | Uint8Array | ArrayBuffer>;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  project,
  isOpen,
  onClose,
  assetBinaryMap,
}) => {
  const [includeMedia, setIncludeMedia] = useState(true);
  const [isPackaging, setIsPackaging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Calculate total media size
  const totalMediaBytes = project.assets.reduce((sum, a) => sum + (a.fileSize || 0), 0);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleCreatePackage = async () => {
    setError(null);
    setIsPackaging(true);
    setStatusMessage('Compressing timeline manifest and bundling media assets...');

    try {
      const zipBlob = await createVnestPackage(project, assetBinaryMap, { includeMedia });

      const safeProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const defaultFilename = `${safeProjectName}.vnest`;

      if (window.vnestNative?.selectSaveProject && window.vnestNative?.saveFileBinary) {
        setStatusMessage('Selecting destination on your computer...');
        const chosenPath = await window.vnestNative.selectSaveProject(defaultFilename);
        if (chosenPath) {
          const arrayBuffer = await zipBlob.arrayBuffer();
          const saveRes = await window.vnestNative.saveFileBinary(chosenPath, arrayBuffer);
          if (!saveRes.success) throw new Error(saveRes.error || 'Failed to write file to disk');
          setIsSuccess(true);
          setStatusMessage(`Successfully saved package: ${chosenPath}`);
        } else {
          setIsPackaging(false);
          return;
        }
      } else {
        // Browser download fallback
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsSuccess(true);
        setStatusMessage('Portable .vnest package downloaded successfully!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Packaging failed: ${msg}`);
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <div className="vnest-modal-backdrop">
      <div className="vnest-modal-box">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={18} style={{ color: 'var(--accent-sage)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Share Portable .vnest Project</h3>
          </div>
          {!isPackaging && (
            <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '4px' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Info */}
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Create an all-in-one portable project package that your friend or collaborator can open on another Windows PC and continue editing right where you left off.
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="vnest-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package size={20} style={{ color: 'var(--accent-sage)' }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Project Assets</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {project.assets.length} media files ({formatBytes(totalMediaBytes)})
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeMedia}
                onChange={(e) => setIncludeMedia(e.target.checked)}
              />
              Bundle Media
            </label>
          </div>

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--accent-sage-subtle)',
            border: '1px solid rgba(155, 175, 155, 0.3)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--accent-sage)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <HardDrive size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              {includeMedia
                ? 'Bundling media ensures recipient can open and edit with zero missing file errors, even if their computer has a completely different directory structure.'
                : 'Lightweight mode saves only the timeline manifest. Recipient will need to have matching media files on their PC.'}
            </span>
          </div>
        </div>

        {/* Status Area */}
        {(isPackaging || isSuccess || error) && (
          <div className="vnest-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {isPackaging && <Loader2 size={14} className="spin" style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />}
            {isSuccess && <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />}
            {error && <AlertCircle size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />}
            <span style={{ color: error ? 'var(--accent-rose)' : isSuccess ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
              {statusMessage || error}
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onClose}
            className="vnest-btn-secondary"
          >
            {isSuccess ? 'Close' : 'Cancel'}
          </button>
          {!isSuccess && (
            <button
              disabled={isPackaging}
              onClick={handleCreatePackage}
              className="vnest-btn-cyan"
            >
              <Download size={14} />
              <span>{isPackaging ? 'Packaging...' : 'Create .vnest Package'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
