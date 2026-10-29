import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Clock,
  Film,
  Layers,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { Project } from '../../types/project';
import { RecoveryManager, ProjectRecoverySnapshot } from '../../core/recovery';
import { formatTimecode } from '../../core/time';
import { formatBytes } from '../../core/mediaRelinking';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreProject: (project: Project) => void;
  isAbnormalShutdown?: boolean;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onClose,
  onRestoreProject,
  isAbnormalShutdown = false,
}) => {
  const [snapshots, setSnapshots] = useState<ProjectRecoverySnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const list = RecoveryManager.getSnapshots();
      setSnapshots(list);
      if (list.length > 0 && !selectedSnapshotId) {
        setSelectedSnapshotId(list[0].id);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || snapshots[0];

  const handleRestore = () => {
    if (!selectedSnapshot) return;
    const project = RecoveryManager.getSnapshotProject(selectedSnapshot.id);
    if (project) {
      // Clear session lock dirty flag to prevent duplicate prompts
      RecoveryManager.markSessionActive(project, false);
      onRestoreProject(project);
      onClose();
    }
  };

  const handleDelete = (id: string) => {
    RecoveryManager.deleteSnapshot(id);
    const updated = RecoveryManager.getSnapshots();
    setSnapshots(updated);
    if (selectedSnapshotId === id) {
      setSelectedSnapshotId(updated[0]?.id || null);
    }
  };

  const handleDismissAll = () => {
    RecoveryManager.markSessionClosed();
    onClose();
  };

  return (
    <div className="vnest-modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="vnest-modal-box" style={{ maxWidth: 640, width: '100%', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} style={{ color: 'var(--accent-sage)' }} />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {isAbnormalShutdown ? 'Session Recovery' : 'Project Recovery Snapshots'}
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {snapshots.length} recoverable snapshot{snapshots.length !== 1 ? 's' : ''} available
              </span>
            </div>
          </div>
          <button onClick={onClose} className="vnest-btn-icon" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Abnormal Shutdown Warning Banner */}
        {isAbnormalShutdown && (
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '6px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
              HL detected an unsaved session from an unexpected shutdown. You can inspect or restore your rolling autosave snapshot below.
            </div>
          </div>
        )}

        {/* Snapshots List & Inspector Split View */}
        {snapshots.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '14px', marginBottom: '20px' }}>
            {/* Snapshot Selection Column */}
            <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '12px', maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {snapshots.map((s) => {
                const isSelected = s.id === selectedSnapshot?.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSnapshotId(s.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent-sage)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--accent-sage)' : 'var(--text-primary)' }}>
                        {RecoveryManager.formatFriendlyTime(s.timestamp)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                        className="vnest-btn-icon"
                        style={{ padding: '2px', opacity: 0.6 }}
                        title="Delete snapshot"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.projectName} ({s.clipCount} clips)
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Snapshot Inspector Details */}
            {selectedSnapshot && (
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedSnapshot.projectName}
                    </h4>
                    <span style={{ fontSize: '10px', background: 'rgba(155, 175, 155, 0.15)', color: 'var(--accent-sage)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      {selectedSnapshot.reason.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '11px', marginBottom: '14px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Saved At</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {new Date(selectedSnapshot.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {formatTimecode(selectedSnapshot.durationMs)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Timeline Content</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {selectedSnapshot.clipCount} clips, {selectedSnapshot.trackCount} tracks
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Media Assets</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {selectedSnapshot.assetCount} assets
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleRestore}
                    className="vnest-btn-primary"
                    style={{ flex: 1, fontSize: '12px', padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCcw size={14} />
                    <span>Restore This Snapshot</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No recovery snapshots found. Autosave creates snapshots automatically as you edit.
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <button
            onClick={handleDismissAll}
            className="vnest-btn-subtle"
            style={{ fontSize: '11px', color: 'var(--text-muted)' }}
          >
            Dismiss All Recovery Prompts
          </button>
          <button onClick={onClose} className="vnest-btn-subtle" style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
