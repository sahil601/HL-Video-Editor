import React, { useState } from 'react';
import {
  Film,
  Plus,
  FolderOpen,
  Share2,
  Clock,
  Trash2,
  RotateCcw,
  Sparkles,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import { AspectRatio, ProjectSummary } from '../../types/project';
import { formatDurationSimple } from '../../core/time';

interface HomeScreenProps {
  onNewProject: (aspectRatio: AspectRatio, name: string) => void;
  onOpenProjectFile: () => void;
  onOpenSharedPackage: () => void;
  onSelectRecent: (projectId: string, filePath?: string) => void;
  onRecoverUnsaved: () => void;
  onLoadTemplate: () => void;
  hasUnsavedRecovery: boolean;
  recentProjects: ProjectSummary[];
  onDeleteRecent: (projectId: string) => void;
  theme?: 'charcoal' | 'light';
  onToggleTheme?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNewProject,
  onOpenProjectFile,
  onOpenSharedPackage,
  onSelectRecent,
  onRecoverUnsaved,
  onLoadTemplate,
  hasUnsavedRecovery,
  recentProjects,
  onDeleteRecent,
  theme = 'charcoal',
  onToggleTheme,
}) => {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('16:9');
  const [projectName, setProjectName] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const ratios: { id: AspectRatio; name: string; desc: string; icon: string }[] = [
    { id: '16:9', name: '16:9 Landscape', desc: 'YouTube, TV & Desktop', icon: '📺' },
    { id: '9:16', name: '9:16 Vertical', desc: 'TikTok, Reels & Shorts', icon: '📱' },
    { id: '1:1', name: '1:1 Square', desc: 'Instagram Feeds', icon: '⏹️' },
    { id: '4:5', name: '4:5 Portrait', desc: 'Social Feeds', icon: '📄' },
  ];

  const handleCreate = () => {
    const finalName = projectName.trim() || 'My Project';
    onNewProject(selectedRatio, finalName);
    setShowNewModal(false);
  };

  return (
    <div className="vnest-home-view">
      {/* Top Banner */}
      <header className="vnest-home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--bg-surface-3), var(--bg-surface-1))',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          }}>
            <Film size={20} color="var(--accent-sage)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                HL
              </span>
              <span className="vnest-badge vnest-badge-indigo">
                Desktop
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              Professional Multi-Track Video Editor for Windows
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasUnsavedRecovery && (
            <button
              onClick={onRecoverUnsaved}
              className="vnest-btn-subtle"
              style={{
                backgroundColor: 'rgba(197, 180, 123, 0.15)',
                color: 'var(--accent-yellow)',
                borderColor: 'rgba(197, 180, 123, 0.3)',
                fontWeight: 600,
              }}
              title="Restore edits from last unexpected exit"
            >
              <RotateCcw size={13} />
              <span>Recover Unsaved Project</span>
            </button>
          )}

          <button
            onClick={onLoadTemplate}
            className="vnest-btn-secondary"
            style={{ fontSize: '12px' }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-sage)' }} />
            <span>Quick Demo Project</span>
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="vnest-btn-icon"
              title={`Switch to ${theme === 'light' ? 'Soft Charcoal' : 'Soft Light'} theme`}
              style={{ padding: '6px' }}
            >
              {theme === 'light' ? <Moon style={{ width: 16, height: 16 }} /> : <Sun style={{ width: 16, height: 16 }} />}
            </button>
          )}
        </div>
      </header>

      {/* Hero / Quick Actions */}
      <main className="vnest-home-body">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            Get Started
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Create a new video project, import media, or collaborate on a shared .vnest archive.
          </p>
        </div>

        {/* Action Grid */}
        <div className="vnest-home-action-grid">
          {/* New Project Card */}
          <div
            onClick={() => setShowNewModal(true)}
            className="vnest-home-action-card"
          >
            <div
              className="vnest-home-action-icon"
              style={{
                backgroundColor: 'var(--accent-sage-subtle)',
                border: '1px solid rgba(155, 175, 155, 0.3)',
                color: 'var(--accent-sage)',
              }}
            >
              <Plus size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                New Project
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Start fresh with multi-track timeline, presets, and customized aspect ratio.
              </p>
            </div>
          </div>

          {/* Open Shared Project Card */}
          <div
            onClick={onOpenSharedPackage}
            className="vnest-home-action-card"
          >
            <div
              className="vnest-home-action-icon"
              style={{
                backgroundColor: 'var(--accent-cyan-glow)',
                border: '1px solid rgba(127, 167, 163, 0.3)',
                color: 'var(--accent-cyan)',
              }}
            >
              <Share2 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Open Shared .vnest Package
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Continue editing a project received from a friend with all bundled media intact.
              </p>
            </div>
          </div>

          {/* Open Local Project File */}
          <div
            onClick={onOpenProjectFile}
            className="vnest-home-action-card"
          >
            <div
              className="vnest-home-action-icon"
              style={{
                backgroundColor: 'var(--bg-surface-3)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-secondary)',
              }}
            >
              <FolderOpen size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Open Project File
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Browse your computer for saved HL project files (.vnest).
              </p>
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <section style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              Recent Projects
            </h3>
            {recentProjects.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{recentProjects.length} saved</span>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <div className="vnest-card" style={{ padding: '36px', textAlign: 'center', borderStyle: 'dashed' }}>
              <div style={{
                width: '44px',
                height: '44px',
                margin: '0 auto 12px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                <Layers size={22} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No recent projects yet
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 16px' }}>
                Create your first video edit, or load the built-in demo project to explore the multi-track timeline.
              </p>
              <button onClick={() => setShowNewModal(true)} className="vnest-btn-primary">
                <Plus size={14} />
                <span>Create First Project</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {recentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectRecent(p.id, p.filePath)}
                  className="vnest-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '110px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-sage-subtle)',
                      border: '1px solid rgba(155, 175, 155, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-sage)',
                    }}>
                      <Film size={18} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRecent(p.id);
                      }}
                      className="vnest-btn-icon"
                      style={{ padding: '4px', color: 'var(--text-muted)' }}
                      title="Remove from recents"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>{formatDurationSimple(p.durationMs)}</span>
                      <span>•</span>
                      <span>{p.clipCount} clips</span>
                      <span>•</span>
                      <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="vnest-modal-backdrop">
          <div className="vnest-modal-box" style={{ maxWidth: '440px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                Create New Video Project
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Choose project name and target canvas aspect ratio
              </p>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Summer Travel Vlog"
                style={{ width: '100%' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Canvas Aspect Ratio
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ratios.map((r) => {
                  const isSelected = selectedRatio === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRatio(r.id)}
                      className="vnest-card"
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--accent-sage)' : 'var(--border-subtle)',
                        backgroundColor: isSelected ? 'var(--selected-surface)' : 'var(--bg-surface-2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span>{r.icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {r.name}
                        </span>
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{r.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setShowNewModal(false)}
                className="vnest-btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleCreate} className="vnest-btn-primary">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
