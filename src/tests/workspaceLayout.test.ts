import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_WORKSPACE_LAYOUT,
  STORAGE_KEY_LAYOUT,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_TIMELINE_HEIGHT,
  MIN_PREVIEW_WIDTH,
  clampWorkspaceLayout,
  loadSavedWorkspaceLayout,
  saveWorkspaceLayout,
  resetWorkspaceLayout,
  WorkspaceLayout,
} from '../core/workspaceLayout';

// Node.js localStorage polyfill for headless tests
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

describe('Workspace Layout & Usability System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
  });

  it('provides sensible default layout dimensions', () => {
    expect(DEFAULT_WORKSPACE_LAYOUT.leftWidth).toBe(320);
    expect(DEFAULT_WORKSPACE_LAYOUT.rightWidth).toBe(320);
    expect(DEFAULT_WORKSPACE_LAYOUT.timelineHeight).toBe(280);
    expect(DEFAULT_WORKSPACE_LAYOUT.isLeftCollapsed).toBe(false);
    expect(DEFAULT_WORKSPACE_LAYOUT.isRightCollapsed).toBe(false);
    expect(DEFAULT_WORKSPACE_LAYOUT.isTimelineCollapsed).toBe(false);
    expect(DEFAULT_WORKSPACE_LAYOUT.isFullscreenPreview).toBe(false);
  });

  describe('clampWorkspaceLayout', () => {
    it('preserves valid dimensions on standard 1920x1080 resolution', () => {
      const input: WorkspaceLayout = {
        leftWidth: 350,
        rightWidth: 360,
        timelineHeight: 320,
        isLeftCollapsed: false,
        isRightCollapsed: false,
        isTimelineCollapsed: false,
        isFullscreenPreview: false,
      };

      const result = clampWorkspaceLayout(input, 1920, 1080);
      expect(result.leftWidth).toBe(350);
      expect(result.rightWidth).toBe(360);
      expect(result.timelineHeight).toBe(320);
      expect(result.isLeftCollapsed).toBe(false);
      expect(result.isRightCollapsed).toBe(false);
      expect(result.isTimelineCollapsed).toBe(false);
    });

    it('clamps sidebars when requested width is under minimum (220px)', () => {
      const input = { leftWidth: 100, rightWidth: 150 };
      const result = clampWorkspaceLayout(input, 1440, 900);
      expect(result.leftWidth).toBe(MIN_SIDEBAR_WIDTH);
      expect(result.rightWidth).toBe(MIN_SIDEBAR_WIDTH);
    });

    it('clamps sidebars when requested width exceeds maximum (550px)', () => {
      const input = { leftWidth: 900, rightWidth: 800 };
      const result = clampWorkspaceLayout(input, 1920, 1080);
      expect(result.leftWidth).toBe(MAX_SIDEBAR_WIDTH);
      expect(result.rightWidth).toBe(MAX_SIDEBAR_WIDTH);
    });

    it('protects center preview viewport on compact 1280x720 display', () => {
      // On 1280px screen with MIN_PREVIEW_WIDTH = 340, available side space is (1280-340)/2 = 470px
      const input = { leftWidth: 500, rightWidth: 500 };
      const result = clampWorkspaceLayout(input, 1280, 720);
      expect(result.leftWidth).toBeLessThanOrEqual(470);
      expect(result.rightWidth).toBeLessThanOrEqual(470);
      expect(1280 - result.leftWidth - result.rightWidth).toBeGreaterThanOrEqual(MIN_PREVIEW_WIDTH);
    });

    it('clamps timeline height to leave room for preview on 720p display', () => {
      // 720 - 208 = 512px max safe timeline height
      const input = { timelineHeight: 650 };
      const result = clampWorkspaceLayout(input, 1280, 720);
      expect(result.timelineHeight).toBe(512);
    });

    it('clamps timeline height to minimum (160px) when requested too small', () => {
      const input = { timelineHeight: 50 };
      const result = clampWorkspaceLayout(input, 1280, 720);
      expect(result.timelineHeight).toBe(MIN_TIMELINE_HEIGHT);
    });
  });

  describe('Storage Persistence & Restoration', () => {
    it('saves layout to localStorage accurately', () => {
      const customLayout: WorkspaceLayout = {
        leftWidth: 380,
        rightWidth: 340,
        timelineHeight: 310,
        isLeftCollapsed: true,
        isRightCollapsed: false,
        isTimelineCollapsed: true,
        isFullscreenPreview: false,
      };

      saveWorkspaceLayout(customLayout);

      const raw = localStorage.getItem(STORAGE_KEY_LAYOUT);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.leftWidth).toBe(380);
      expect(parsed.rightWidth).toBe(340);
      expect(parsed.timelineHeight).toBe(310);
      expect(parsed.isLeftCollapsed).toBe(true);
      expect(parsed.isTimelineCollapsed).toBe(true);
    });

    it('loads saved layout preferences and clamps them against current window dimensions', () => {
      const saved = {
        leftWidth: 400,
        rightWidth: 350,
        timelineHeight: 300,
        isLeftCollapsed: false,
        isRightCollapsed: true,
        isTimelineCollapsed: false,
      };
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(saved));

      const loaded = loadSavedWorkspaceLayout(1440, 900);
      expect(loaded.leftWidth).toBe(400);
      expect(loaded.rightWidth).toBe(350);
      expect(loaded.timelineHeight).toBe(300);
      expect(loaded.isLeftCollapsed).toBe(false);
      expect(loaded.isRightCollapsed).toBe(true);
      expect(loaded.isTimelineCollapsed).toBe(false);
      // Fullscreen preview should always be reset to false on launch
      expect(loaded.isFullscreenPreview).toBe(false);
    });

    it('gracefully handles corrupted localStorage JSON by falling back to clamped defaults', () => {
      localStorage.setItem(STORAGE_KEY_LAYOUT, 'not-valid-json{{{');
      const loaded = loadSavedWorkspaceLayout(1440, 900);
      expect(loaded.leftWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.leftWidth);
      expect(loaded.rightWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.rightWidth);
      expect(loaded.timelineHeight).toBe(DEFAULT_WORKSPACE_LAYOUT.timelineHeight);
    });

    it('resets layout to default and clears localStorage', () => {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify({ leftWidth: 450 }));
      const reset = resetWorkspaceLayout(1920, 1080);
      expect(reset.leftWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.leftWidth);
      expect(reset.rightWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.rightWidth);
      expect(localStorage.getItem(STORAGE_KEY_LAYOUT)).toBeNull();
    });
  });
});
