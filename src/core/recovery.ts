/**
 * Project Recovery & Snapshot Engine for HL Video Editor
 * Manages rolling recovery snapshots, abnormal shutdown detection,
 * quota-safe storage, and snapshot inspection/restoration.
 */

import { Project } from '../types/project';

export interface ProjectRecoverySnapshot {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  durationMs: number;
  clipCount: number;
  trackCount: number;
  assetCount: number;
  reason: 'autosave' | 'abnormal_shutdown' | 'manual';
  byteSize: number;
}

const SNAPSHOT_INDEX_KEY = 'hl_recovery_snapshots';
const SESSION_LOCK_KEY = 'hl_session_lock';
const MAX_SNAPSHOTS = 5;

export interface SessionLock {
  projectId: string;
  projectName: string;
  timestamp: string;
  isDirty: boolean;
}

export class RecoveryManager {
  /**
   * Get list of all available recovery snapshots
   */
  public static getSnapshots(): ProjectRecoverySnapshot[] {
    try {
      const raw = localStorage.getItem(SNAPSHOT_INDEX_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw) as ProjectRecoverySnapshot[];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('Failed to read recovery snapshot index:', e);
      return [];
    }
  }

  /**
   * Retrieve full project state for a specific snapshot
   */
  public static getSnapshotProject(snapshotId: string): Project | null {
    try {
      const raw = localStorage.getItem(`hl_recovery_data_${snapshotId}`);
      if (!raw) return null;
      return JSON.parse(raw) as Project;
    } catch (e) {
      console.warn(`Failed to read project snapshot ${snapshotId}:`, e);
      return null;
    }
  }

  /**
   * Save a rolling project recovery snapshot safely without overwriting the master project
   */
  public static saveSnapshot(
    project: Project,
    reason: 'autosave' | 'abnormal_shutdown' | 'manual' = 'autosave'
  ): { success: boolean; snapshotId?: string; error?: string } {
    try {
      const now = new Date().toISOString();
      const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const projectJson = JSON.stringify(project);
      const byteSize = projectJson.length * 2; // rough UTF-16 byte estimate

      const totalClips = project.tracks.reduce((sum, t) => sum + t.clips.length, 0);

      const meta: ProjectRecoverySnapshot = {
        id: snapshotId,
        projectId: project.id,
        projectName: project.name,
        timestamp: now,
        durationMs: project.durationMs,
        clipCount: totalClips,
        trackCount: project.tracks.length,
        assetCount: project.assets.length,
        reason,
        byteSize,
      };

      // Get current list and evict oldest if exceeding max snapshots
      let current = this.getSnapshots();

      // If storage is near quota, aggressively prune older snapshots first
      while (current.length >= MAX_SNAPSHOTS) {
        const oldest = current.pop();
        if (oldest) {
          localStorage.removeItem(`hl_recovery_data_${oldest.id}`);
        }
      }

      // Attempt to save data item
      try {
        localStorage.setItem(`hl_recovery_data_${snapshotId}`, projectJson);
      } catch (quotaErr) {
        // QuotaExceededError handling: purge all old snapshots and retry once
        console.warn('Storage quota exceeded, purging older recovery snapshots:', quotaErr);
        for (const s of current) {
          localStorage.removeItem(`hl_recovery_data_${s.id}`);
        }
        current = [];
        try {
          localStorage.setItem(`hl_recovery_data_${snapshotId}`, projectJson);
        } catch (retryErr: any) {
          return { success: false, error: 'Disk or localStorage quota exceeded: ' + (retryErr?.message || String(retryErr)) };
        }
      }

      // Add to front of index
      current.unshift(meta);
      localStorage.setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(current));

      // Also update session lock timestamp
      this.markSessionActive(project, true);

      return { success: true, snapshotId };
    } catch (err: any) {
      console.warn('Failed to save recovery snapshot:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Delete a specific recovery snapshot
   */
  public static deleteSnapshot(snapshotId: string): void {
    try {
      localStorage.removeItem(`hl_recovery_data_${snapshotId}`);
      const current = this.getSnapshots().filter((s) => s.id !== snapshotId);
      localStorage.setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to delete recovery snapshot:', e);
    }
  }

  /**
   * Clear all recovery snapshots
   */
  public static clearAllSnapshots(): void {
    try {
      const current = this.getSnapshots();
      for (const s of current) {
        localStorage.removeItem(`hl_recovery_data_${s.id}`);
      }
      localStorage.removeItem(SNAPSHOT_INDEX_KEY);
    } catch (e) {
      console.warn('Failed to clear snapshots:', e);
    }
  }

  /**
   * Mark current session active with dirty flag
   */
  public static markSessionActive(project: Project, isDirty = true): void {
    try {
      const lock: SessionLock = {
        projectId: project.id,
        projectName: project.name,
        timestamp: new Date().toISOString(),
        isDirty,
      };
      localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify(lock));
    } catch {}
  }

  /**
   * Mark session as cleanly saved
   */
  public static markSessionClean(): void {
    try {
      const raw = localStorage.getItem(SESSION_LOCK_KEY);
      if (raw) {
        const lock = JSON.parse(raw) as SessionLock;
        lock.isDirty = false;
        localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify(lock));
      }
    } catch {}
  }

  /**
   * Mark session as cleanly closed (e.g. going to Home screen or clean app exit)
   */
  public static markSessionClosed(): void {
    try {
      localStorage.removeItem(SESSION_LOCK_KEY);
    } catch {}
  }

  /**
   * Check if an abnormal shutdown occurred with unsaved changes
   */
  public static detectAbnormalShutdown(): { lock: SessionLock; snapshot?: ProjectRecoverySnapshot } | null {
    try {
      const raw = localStorage.getItem(SESSION_LOCK_KEY);
      if (!raw) return null;
      const lock = JSON.parse(raw) as SessionLock;
      if (!lock.isDirty) return null;

      // Find newest snapshot for this project
      const snapshots = this.getSnapshots();
      const match = snapshots.find((s) => s.projectId === lock.projectId) || snapshots[0];

      return { lock, snapshot: match };
    } catch {
      return null;
    }
  }

  /**
   * Format friendly relative timestamp (e.g. "Just now", "2 minutes ago", "Yesterday at 14:32")
   */
  public static formatFriendlyTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 30) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }
}
