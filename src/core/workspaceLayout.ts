/**
 * Workspace Layout Management for HL Video Editor
 * Handles panel sizing, collapsing, clamping, and localStorage persistence.
 */

export interface WorkspaceLayout {
  leftWidth: number;          // Left sidebar (Media Library) width in px
  rightWidth: number;         // Right sidebar (Properties Inspector) width in px
  timelineHeight: number;     // Bottom timeline panel height in px
  isLeftCollapsed: boolean;   // Left sidebar collapse toggle
  isRightCollapsed: boolean;  // Right sidebar collapse toggle
  isTimelineCollapsed: boolean; // Timeline height collapse toggle (minimized to toolbar)
  isFullscreenPreview: boolean; // Expanded/Theater preview mode
}

export const STORAGE_KEY_LAYOUT = 'hl_workspace_layout';

export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 550;
export const MIN_TIMELINE_HEIGHT = 160;
export const COLLAPSED_TIMELINE_HEIGHT = 44;
export const MIN_PREVIEW_WIDTH = 340;
export const MIN_PREVIEW_HEIGHT = 160;

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  leftWidth: 320,
  rightWidth: 320,
  timelineHeight: 280,
  isLeftCollapsed: false,
  isRightCollapsed: false,
  isTimelineCollapsed: false,
  isFullscreenPreview: false,
};

/**
 * Clamps panel dimensions based on available window bounds so essential controls
 * are never rendered inaccessible or pushed off-screen.
 */
export function clampWorkspaceLayout(
  layout: Partial<WorkspaceLayout>,
  windowWidth = 1440,
  windowHeight = 900
): WorkspaceLayout {
  // Max safe timeline height leaves room for header (48px) and minimum preview (160px)
  const maxSafeTimelineHeight = Math.max(MIN_TIMELINE_HEIGHT, windowHeight - 208);
  const clampedTimelineHeight = Math.min(
    maxSafeTimelineHeight,
    Math.max(MIN_TIMELINE_HEIGHT, layout.timelineHeight ?? DEFAULT_WORKSPACE_LAYOUT.timelineHeight)
  );

  // Available horizontal space for sidebars while guaranteeing preview width
  const maxSideSpace = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.floor((windowWidth - MIN_PREVIEW_WIDTH) / 2)
  );

  const clampedLeftWidth = Math.min(
    Math.min(MAX_SIDEBAR_WIDTH, maxSideSpace),
    Math.max(MIN_SIDEBAR_WIDTH, layout.leftWidth ?? DEFAULT_WORKSPACE_LAYOUT.leftWidth)
  );

  const clampedRightWidth = Math.min(
    Math.min(MAX_SIDEBAR_WIDTH, maxSideSpace),
    Math.max(MIN_SIDEBAR_WIDTH, layout.rightWidth ?? DEFAULT_WORKSPACE_LAYOUT.rightWidth)
  );

  return {
    leftWidth: clampedLeftWidth,
    rightWidth: clampedRightWidth,
    timelineHeight: clampedTimelineHeight,
    isLeftCollapsed: Boolean(layout.isLeftCollapsed),
    isRightCollapsed: Boolean(layout.isRightCollapsed),
    isTimelineCollapsed: Boolean(layout.isTimelineCollapsed),
    isFullscreenPreview: Boolean(layout.isFullscreenPreview),
  };
}

/**
 * Loads and validates saved workspace layout preferences from localStorage.
 */
export function loadSavedWorkspaceLayout(
  windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1440,
  windowHeight = typeof window !== 'undefined' ? window.innerHeight : 900
): WorkspaceLayout {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAYOUT) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return clampWorkspaceLayout(
          {
            leftWidth: typeof parsed.leftWidth === 'number' ? parsed.leftWidth : DEFAULT_WORKSPACE_LAYOUT.leftWidth,
            rightWidth: typeof parsed.rightWidth === 'number' ? parsed.rightWidth : DEFAULT_WORKSPACE_LAYOUT.rightWidth,
            timelineHeight: typeof parsed.timelineHeight === 'number' ? parsed.timelineHeight : DEFAULT_WORKSPACE_LAYOUT.timelineHeight,
            isLeftCollapsed: Boolean(parsed.isLeftCollapsed),
            isRightCollapsed: Boolean(parsed.isRightCollapsed),
            isTimelineCollapsed: Boolean(parsed.isTimelineCollapsed),
            isFullscreenPreview: false, // Never open directly into fullscreen
          },
          windowWidth,
          windowHeight
        );
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved workspace layout, using defaults:', err);
  }

  return clampWorkspaceLayout(DEFAULT_WORKSPACE_LAYOUT, windowWidth, windowHeight);
}

/**
 * Saves workspace layout preferences safely to localStorage.
 */
export function saveWorkspaceLayout(layout: WorkspaceLayout): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      leftWidth: layout.leftWidth,
      rightWidth: layout.rightWidth,
      timelineHeight: layout.timelineHeight,
      isLeftCollapsed: layout.isLeftCollapsed,
      isRightCollapsed: layout.isRightCollapsed,
      isTimelineCollapsed: layout.isTimelineCollapsed,
    };
    localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save workspace layout:', err);
  }
}

/**
 * Clears saved layout overrides and returns the clamped default layout.
 */
export function resetWorkspaceLayout(
  windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1440,
  windowHeight = typeof window !== 'undefined' ? window.innerHeight : 900
): WorkspaceLayout {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_LAYOUT);
    }
  } catch {}
  return clampWorkspaceLayout(DEFAULT_WORKSPACE_LAYOUT, windowWidth, windowHeight);
}
