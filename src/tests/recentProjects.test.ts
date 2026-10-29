import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDefaultProject } from '../core/project';
import { Project, ProjectSummary, Clip } from '../types/project';
import { extractVnestPackage, inspectAndValidateVnestPackage, createVnestPackage } from '../core/package';
import { RecoveryManager } from '../core/recovery';

// Mock localStorage for test environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (index: number) => Array.from(storageMap.keys())[index] || null,
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

describe('Recent Projects System & Multi-Project Isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
  });

  describe('Duplicate Display Names Isolation', () => {
    it('opens two projects with identical display names and verifies each loads its own saved timeline and clips', () => {
      const duplicateDisplayName = 'Vlog Demo Project';

      // Project A
      const projectA = createDefaultProject(duplicateDisplayName, '16:9');
      projectA.id = 'proj_duplicate_name_alpha';
      const clipA1: Clip = {
        id: 'clip_alpha_1',
        trackId: 'track_video_main',
        name: 'Alpha Clip 1',
        type: 'video',
        startMs: 0,
        durationMs: 3000,
        sourceStartMs: 0,
        sourceEndMs: 3000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      const clipA2: Clip = {
        id: 'clip_alpha_2',
        trackId: 'track_video_main',
        name: 'Alpha Clip 2',
        type: 'video',
        startMs: 3000,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      projectA.tracks[2].clips = [clipA1, clipA2];
      projectA.durationMs = 7000;

      // Project B (Same display name, completely different ID and timeline clips)
      const projectB = createDefaultProject(duplicateDisplayName, '16:9');
      projectB.id = 'proj_duplicate_name_beta';
      const clipB1: Clip = {
        id: 'clip_beta_1',
        trackId: 'track_video_main',
        name: 'Beta Clip 1',
        type: 'video',
        startMs: 0,
        durationMs: 10000,
        sourceStartMs: 0,
        sourceEndMs: 10000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      const clipB2: Clip = {
        id: 'clip_beta_2',
        trackId: 'track_overlay_1',
        name: 'Beta Clip 2 (PIP)',
        type: 'overlay',
        startMs: 2000,
        durationMs: 5000,
        sourceStartMs: 0,
        sourceEndMs: 5000,
        speed: 1,
        volume: 0.8,
        fadeInMs: 500,
        fadeOutMs: 500,
        transform: { positionX: 20, positionY: 20, scale: 0.5, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      const clipB3: Clip = {
        id: 'clip_beta_3',
        trackId: 'track_text_1',
        name: 'Beta Title Text',
        type: 'text',
        startMs: 0,
        durationMs: 4000,
        sourceStartMs: 0,
        sourceEndMs: 4000,
        speed: 1,
        volume: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        transform: { positionX: 0, positionY: -10, scale: 1, rotation: 0, opacity: 1 },
        keyframes: [],
      };
      projectB.tracks[0].clips = [clipB3];
      projectB.tracks[1].clips = [clipB2];
      projectB.tracks[2].clips = [clipB1];
      projectB.durationMs = 10000;

      // Save both into storage under their unique IDs
      mockLocalStorage.setItem(`vnest_project_${projectA.id}`, JSON.stringify(projectA));
      mockLocalStorage.setItem(`vnest_project_${projectB.id}`, JSON.stringify(projectB));

      // Build recent projects index with both entries having the same display name
      const recents: ProjectSummary[] = [
        {
          id: projectA.id,
          name: projectA.name,
          updatedAt: '2026-10-21T09:00:00.000Z',
          durationMs: projectA.durationMs,
          clipCount: 2,
          assetCount: 0,
        },
        {
          id: projectB.id,
          name: projectB.name,
          updatedAt: '2026-10-21T09:05:00.000Z',
          durationMs: projectB.durationMs,
          clipCount: 3,
          assetCount: 0,
        },
      ];
      mockLocalStorage.setItem('vnest_recent_projects', JSON.stringify(recents));

      // Simulate opening Project A
      const summaryA = recents.find((p) => p.id === projectA.id);
      expect(summaryA).toBeDefined();
      expect(summaryA!.name).toBe(duplicateDisplayName);

      const savedA = mockLocalStorage.getItem(`vnest_project_${summaryA!.id}`);
      expect(savedA).not.toBeNull();
      const loadedA = JSON.parse(savedA!) as Project;

      // Verify Project A loaded only its own timeline and clips
      expect(loadedA.id).toBe('proj_duplicate_name_alpha');
      expect(loadedA.name).toBe(duplicateDisplayName);
      expect(loadedA.durationMs).toBe(7000);
      const allClipsA = loadedA.tracks.flatMap((t) => t.clips);
      expect(allClipsA).toHaveLength(2);
      expect(allClipsA.map((c) => c.id)).toEqual(['clip_alpha_1', 'clip_alpha_2']);

      // Simulate opening Project B
      const summaryB = recents.find((p) => p.id === projectB.id);
      expect(summaryB).toBeDefined();
      expect(summaryB!.name).toBe(duplicateDisplayName);

      const savedB = mockLocalStorage.getItem(`vnest_project_${summaryB!.id}`);
      expect(savedB).not.toBeNull();
      const loadedB = JSON.parse(savedB!) as Project;

      // Verify Project B loaded only its own timeline and clips
      expect(loadedB.id).toBe('proj_duplicate_name_beta');
      expect(loadedB.name).toBe(duplicateDisplayName);
      expect(loadedB.durationMs).toBe(10000);
      const allClipsB = loadedB.tracks.flatMap((t) => t.clips);
      expect(allClipsB).toHaveLength(3);
      expect(allClipsB.map((c) => c.id)).toContain('clip_beta_1');
      expect(allClipsB.map((c) => c.id)).toContain('clip_beta_2');
      expect(allClipsB.map((c) => c.id)).toContain('clip_beta_3');

      // Assert total separation between A and B
      expect(loadedA.id).not.toBe(loadedB.id);
      expect(allClipsA.map((c) => c.id)).not.toEqual(allClipsB.map((c) => c.id));
    });
  });

  describe('Missing and Invalid Project Files', () => {
    it('detects and rejects missing project files without corrupting state', async () => {
      // Simulate file reading returning failure for non-existent file
      const nonExistentPath = 'C:/Users/fake/Documents/non_existent.vnest';
      const mockReadFileBinary = vi.fn().mockResolvedValue({
        success: false,
        error: 'ENOENT: no such file or directory',
      });

      const fileRes = await mockReadFileBinary(nonExistentPath);
      expect(fileRes.success).toBe(false);
      expect(fileRes.error).toContain('no such file');
    });

    it('detects and rejects invalid or corrupted .vnest project files with clear error diagnostics', async () => {
      // Corrupted file buffer (plain text / random bytes instead of valid ZIP)
      const corruptedBytes = new TextEncoder().encode('This is completely invalid corrupted file data, not a ZIP archive.');

      const validation = await inspectAndValidateVnestPackage(corruptedBytes);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toMatch(/Corrupted or invalid zip archive/i);

      // Attempting to extract directly should throw a descriptive error
      await expect(extractVnestPackage(corruptedBytes)).rejects.toThrow(/Cannot open .vnest project/i);
    });

    it('detects and rejects .vnest package missing manifest.json', async () => {
      // Create a valid zip but omit manifest.json
      const JSZip = (await import('jszip')).default;
      const emptyZip = new JSZip();
      emptyZip.file('random.txt', 'hello world');
      const zipData = await emptyZip.generateAsync({ type: 'uint8array' });

      const validation = await inspectAndValidateVnestPackage(zipData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Archive is missing manifest.json');
    });

    it('successfully extracts and opens a valid portable .vnest package', async () => {
      const proj = createDefaultProject('Portable Package Demo', '16:9');
      proj.id = 'proj_portable_test_123';
      const emptyAssetMap = new Map();
      const zipBlob = await createVnestPackage(proj, emptyAssetMap, { includeMedia: false });
      const arrayBuffer = await zipBlob.arrayBuffer();

      const { project: extractedProj } = await extractVnestPackage(arrayBuffer);
      expect(extractedProj.id).toBe('proj_portable_test_123');
      expect(extractedProj.name).toBe('Portable Package Demo');
    });
  });

  describe('Storage Fallbacks (Autosave & Recovery Snapshots)', () => {
    it('recovers project from vnest_autosave when vnest_project_${id} is missing', () => {
      const autosaveProject = createDefaultProject('Autosaved Vlog', '16:9');
      autosaveProject.id = 'proj_autosave_recovery_test';
      mockLocalStorage.setItem('vnest_autosave', JSON.stringify(autosaveProject));

      // vnest_project_${id} is intentionally missing
      expect(mockLocalStorage.getItem(`vnest_project_${autosaveProject.id}`)).toBeNull();

      // Fallback logic
      const autosaveRaw = mockLocalStorage.getItem('vnest_autosave');
      expect(autosaveRaw).not.toBeNull();
      const parsedAutosave = JSON.parse(autosaveRaw!) as Project;
      expect(parsedAutosave.id).toBe(autosaveProject.id);

      // Successfully recovers project and persists it
      mockLocalStorage.setItem(`vnest_project_${parsedAutosave.id}`, autosaveRaw!);
      expect(mockLocalStorage.getItem(`vnest_project_${autosaveProject.id}`)).not.toBeNull();
    });

    it('recovers project from RecoveryManager snapshot when master storage is missing', () => {
      const snapshotProject = createDefaultProject('Snapshot Recovered Vlog', '16:9');
      snapshotProject.id = 'proj_snap_recovery_test';

      const saveRes = RecoveryManager.saveSnapshot(snapshotProject, 'autosave');
      expect(saveRes.success).toBe(true);

      const snapshots = RecoveryManager.getSnapshots();
      const matchingSnap = snapshots.find((s) => s.projectId === snapshotProject.id);
      expect(matchingSnap).toBeDefined();

      const recovered = RecoveryManager.getSnapshotProject(matchingSnap!.id);
      expect(recovered).not.toBeNull();
      expect(recovered!.id).toBe(snapshotProject.id);
      expect(recovered!.name).toBe('Snapshot Recovered Vlog');
    });

    it('reports missing data cleanly when project is not found in any source', () => {
      const unknownId = 'proj_completely_unknown_999';
      const saved = mockLocalStorage.getItem(`vnest_project_${unknownId}`);
      const autosave = mockLocalStorage.getItem('vnest_autosave');
      const snapshots = RecoveryManager.getSnapshots().filter((s) => s.projectId === unknownId);

      expect(saved).toBeNull();
      expect(autosave).toBeNull();
      expect(snapshots).toHaveLength(0);
    });
  });
});
