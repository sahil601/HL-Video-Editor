import React from 'react';
import {
  X,
  FileVideo,
  FileAudio,
  FileImage,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  HardDrive,
  Tv,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ProjectAsset } from '../../types/project';
import { getFormattedMediaDetails } from '../../core/mediaRelinking';

interface MediaInspectorModalProps {
  asset: ProjectAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onRelink: (assetId: string) => void;
  onGenerateProxy?: (asset: ProjectAsset) => void;
  onDeleteProxy?: (asset: ProjectAsset) => void;
}

export const MediaInspectorModal: React.FC<MediaInspectorModalProps> = ({
  asset,
  isOpen,
  onClose,
  onRelink,
  onGenerateProxy,
  onDeleteProxy,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !asset) return null;

  const info = getFormattedMediaDetails(asset);

  const handleCopyPath = () => {
    if (info.originalPath) {
      navigator.clipboard.writeText(info.originalPath).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const getMediaIcon = () => {
    switch (asset.type) {
      case 'video':
        return <FileVideo size={20} style={{ color: 'var(--accent-sage)' }} />;
      case 'audio':
        return <FileAudio size={20} style={{ color: 'var(--accent-blue)' }} />;
      case 'image':
      default:
        return <FileImage size={20} style={{ color: 'var(--accent-purple)' }} />;
    }
  };

  return (
    <div className="vnest-modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="vnest-modal-box" style={{ maxWidth: 580, width: '100%', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {getMediaIcon()}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.name}
                </h3>
                {info.isMissing && (
                  <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                    MISSING
                  </span>
                )}
                {asset.proxyStatus === 'ready' && (
                  <span style={{ fontSize: '10px', background: 'rgba(155, 175, 155, 0.2)', color: 'var(--accent-sage)', border: '1px solid rgba(155, 175, 155, 0.3)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                    PROXY {asset.proxyQuality?.toUpperCase() || '540P'}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Asset ID: {asset.id}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Missing File Alert */}
        {info.isMissing && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '12px' }}>
              <AlertTriangle size={16} />
              <span>Source media file cannot be found at original disk location.</span>
            </div>
            <button
              onClick={() => {
                onRelink(asset.id);
                onClose();
              }}
              className="vnest-btn-primary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Relink Media
            </button>
          </div>
        )}

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {/* File Path */}
          <div style={{ gridColumn: 'span 2', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>FILE PATH</span>
              <button
                onClick={handleCopyPath}
                className="vnest-btn-icon"
                title="Copy file path"
                style={{ padding: '2px 6px', fontSize: '10px', height: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}
              >
                {copied ? <CheckCircle2 size={12} style={{ color: 'var(--accent-sage)' }} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {info.originalPath}
            </div>
          </div>

          {/* Media Type & Size */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <HardDrive size={13} />
              <span>FORMAT & SIZE</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {info.type} • {info.fileSizeFormatted}
            </div>
          </div>

          {/* Duration */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <Clock size={13} />
              <span>DURATION</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {info.durationFormatted} ({info.durationSec}s)
            </div>
          </div>

          {/* Resolution & Ratio */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <Tv size={13} />
              <span>RESOLUTION & ASPECT</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {info.resolutionFormatted}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {info.aspectRatioFormatted}
            </div>
          </div>

          {/* Frame Rate */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <Activity size={13} />
              <span>FRAME RATE</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {info.fpsFormatted}
            </div>
          </div>

          {/* Proxy Media Status */}
          <div style={{ gridColumn: 'span 2', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  <Sparkles size={13} style={{ color: 'var(--accent-sage)' }} />
                  <span>PROXY MEDIA STATUS</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: asset.proxyStatus === 'ready' ? 'var(--accent-sage)' : 'var(--text-secondary)' }}>
                  {info.proxyStatusFormatted}
                </div>
                {asset.proxyPath && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {asset.proxyPath}
                  </div>
                )}
              </div>

              {asset.type === 'video' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {asset.proxyStatus === 'ready' ? (
                    <button
                      onClick={() => onDeleteProxy && onDeleteProxy(asset)}
                      className="vnest-btn-subtle"
                      style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--accent-red)' }}
                    >
                      Delete Proxy
                    </button>
                  ) : (
                    <button
                      onClick={() => onGenerateProxy && onGenerateProxy(asset)}
                      disabled={asset.proxyStatus === 'generating'}
                      className="vnest-btn-primary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      {asset.proxyStatus === 'generating' ? 'Generating...' : 'Generate Proxy'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={() => {
              onRelink(asset.id);
              onClose();
            }}
            className="vnest-btn-subtle"
            style={{ fontSize: '12px' }}
          >
            Relink / Replace File
          </button>
          <button onClick={onClose} className="vnest-btn-primary" style={{ fontSize: '12px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
