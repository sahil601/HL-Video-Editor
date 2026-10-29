import React, { useState } from 'react';
import {
  X,
  Share2,
  AlertTriangle,
  FolderOpen,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Project, ProjectAsset } from '../../types/project';
import { extractVnestPackage, inspectAndValidateVnestPackage } from '../../core/package';
import { formatDurationSimple } from '../../core/time';

interface OpenSharedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLoaded: (project: Project, assetBlobs: Map<string, { blob: Blob; url: string }>) => void;
  initialBuffer?: ArrayBuffer | null;
}

export const OpenSharedModal: React.FC<OpenSharedModalProps> = ({
  isOpen,
  onClose,
  onProjectLoaded,
  initialBuffer,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState<{
    project: Project;
    missing: ProjectAsset[];
    assetMap: Map<string, { blob: Blob; url: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && initialBuffer) {
      processArchive(initialBuffer);
    } else if (!isOpen) {
      setExtractedInfo(null);
      setError(null);
    }
  }, [isOpen, initialBuffer]);

  if (!isOpen) return null;

  const processArchive = async (fileData: Blob | ArrayBuffer) => {
    setError(null);
    setIsValidating(true);

    try {
      // 1. Inspect & Validate
      const validation = await inspectAndValidateVnestPackage(fileData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
      }

      // 2. Extract
      const { project, extractedAssets, missingAssets } = await extractVnestPackage(fileData);

      setExtractedInfo({
        project,
        missing: missingAssets,
        assetMap: extractedAssets,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Archive validation error: ${msg}`);
      setExtractedInfo(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processArchive(file);
    }
  };

  const handleConfirmOpen = () => {
    if (extractedInfo) {
      onProjectLoaded(extractedInfo.project, extractedInfo.assetMap);
      onClose();
    }
  };

  return (
    <div className="vnest-modal-backdrop">
      <div className="vnest-modal-box">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={18} style={{ color: 'var(--accent-sage)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Open Shared .vnest Package</h3>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Drag & Drop or Browse */}
        {!extractedInfo && (
          <div
            onClick={() => document.getElementById('open-vnest-file')?.click()}
            className="vnest-card"
            style={{
              padding: '32px 20px',
              borderStyle: 'dashed',
              borderWidth: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-2)',
            }}
          >
            <input
              id="open-vnest-file"
              type="file"
              accept=".vnest,.zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <FolderOpen size={36} style={{ color: 'var(--accent-sage)', marginBottom: '12px', opacity: 0.8 }} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Click to select .vnest project file</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, maxWidth: '280px' }}>
              Select the portable project archive sent from another Windows PC.
            </p>
          </div>
        )}

        {/* Loading Spinner */}
        {isValidating && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent-sage)', padding: '16px 0' }}>
            <Loader2 size={16} className="spin" />
            <span>Scanning archive security, verifying checksums & extracting media...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--accent-rose)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Verified Archive Summary */}
        {extractedInfo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-sage)',
              backgroundColor: 'var(--accent-sage-subtle)',
              border: '1px solid rgba(155, 175, 155, 0.3)',
              padding: '10px 12px',
              borderRadius: '8px',
            }}>
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>Package verified: Safe file paths, valid schema v{extractedInfo.project.schemaVersion}</span>
            </div>

            <div className="vnest-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Project Name:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{extractedInfo.project.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timeline Duration:</span>
                <span className="font-mono-time" style={{ color: 'var(--text-primary)' }}>
                  {formatDurationSimple(extractedInfo.project.durationMs)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Canvas Format:</span>
                <span style={{ color: 'var(--accent-sage)' }}>
                  {extractedInfo.project.settings.width}x{extractedInfo.project.settings.height} ({extractedInfo.project.settings.aspectRatio})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Bundled Assets:</span>
                <span style={{ color: 'var(--accent-sage)', fontWeight: 700 }}>{extractedInfo.assetMap.size} files restored</span>
              </div>

              {extractedInfo.missing.length > 0 && (
                <div style={{
                  marginTop: '6px',
                  paddingTop: '6px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--accent-yellow)',
                  fontSize: '11px',
                }}>
                  <AlertTriangle size={14} />
                  <span>{extractedInfo.missing.length} unbundled external media links to relink</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onClose}
            className="vnest-btn-secondary"
          >
            Cancel
          </button>
          {extractedInfo && (
            <button
              onClick={handleConfirmOpen}
              className="vnest-btn-primary"
            >
              Open Project in Timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
