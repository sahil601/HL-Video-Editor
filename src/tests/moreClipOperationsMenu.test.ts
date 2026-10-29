import { describe, it, expect } from 'vitest';
import {
  calculateMenuPosition,
  AnchorRect,
  WindowViewport,
} from '../components/timeline/MoreClipOperationsMenu';

describe('More Clip Operations Menu — Positioning and Boundary Protection', () => {
  const defaultMenuDim = { width: 190, height: 175 };
  const fullHDViewport: WindowViewport = { innerWidth: 1920, innerHeight: 1080 };
  const standardLaptopViewport: WindowViewport = { innerWidth: 1366, innerHeight: 768 };
  const compactViewport: WindowViewport = { innerWidth: 1024, innerHeight: 600 };

  it('positions the menu below the three-dot button by default with sufficient spacing', () => {
    // Toolbar located at middle of screen: Y = 500, height = 28
    const anchor: AnchorRect = {
      top: 500,
      bottom: 528,
      left: 650,
      right: 680,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(anchor, defaultMenuDim, fullHDViewport, { gap: 6, padding: 8 });

    expect(pos.placement).toBe('bottom');
    // Sits exactly gap (6px) below the bottom of the button
    expect(pos.top).toBe(534); // 528 + 6
    // Aligns with the anchor's left edge
    expect(pos.left).toBe(650);
    // Menu does not overlap button
    expect(pos.top).toBeGreaterThanOrEqual(anchor.bottom);
  });

  it('calculates available space and opens upward when space below is insufficient', () => {
    // Timeline toolbar near the bottom of a 768px laptop screen: anchor.bottom = 650
    // Space below = 768 - 650 - 6 - 8 = 104px (less than menuHeight 175px)
    // Space above = 622 - 6 - 8 = 608px (much greater than space below)
    const anchor: AnchorRect = {
      top: 622,
      bottom: 650,
      left: 650,
      right: 680,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(anchor, defaultMenuDim, standardLaptopViewport, { gap: 6, padding: 8 });

    expect(pos.placement).toBe('top');
    // Positioned above the button by gap (6px) and menu height (175px)
    expect(pos.top).toBe(622 - 6 - 175); // 441
    expect(pos.left).toBe(650);
    // The menu bottom (pos.top + menuHeight) is strictly above the button top
    expect(pos.top + defaultMenuDim.height).toBeLessThanOrEqual(anchor.top);
  });

  it('keeps the menu strictly inside the right window boundary at narrower resolutions', () => {
    // Three-dot button placed near the right edge of a 1024px window (e.g. left = 950)
    const anchor: AnchorRect = {
      top: 300,
      bottom: 328,
      left: 950,
      right: 980,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(anchor, defaultMenuDim, compactViewport, { gap: 6, padding: 8 });

    // Menu width is 190. 950 + 190 = 1140 which exceeds 1024 - 8 (1016).
    // Pos.left must be shifted left so right edge <= innerWidth - padding
    expect(pos.left + defaultMenuDim.width).toBeLessThanOrEqual(compactViewport.innerWidth - 8);
    expect(pos.left).toBe(compactViewport.innerWidth - defaultMenuDim.width - 8); // 1024 - 190 - 8 = 826
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it('keeps the menu strictly inside the left window boundary if anchor is near edge', () => {
    const anchor: AnchorRect = {
      top: 300,
      bottom: 328,
      left: 2,
      right: 32,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(anchor, defaultMenuDim, fullHDViewport, { gap: 6, padding: 8 });

    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left).toBe(8);
  });

  it('constrains maxHeight and prevents overflow when window height is critically small', () => {
    // Very constrained window height of 200px
    const tinyViewport: WindowViewport = { innerWidth: 800, innerHeight: 200 };
    const anchor: AnchorRect = {
      top: 90,
      bottom: 118,
      left: 200,
      right: 230,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(anchor, defaultMenuDim, tinyViewport, { gap: 6, padding: 8 });

    // Must define maxHeight so internal scroll is enabled
    expect(pos.maxHeight).toBeDefined();
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + (pos.maxHeight || 0)).toBeLessThanOrEqual(tinyViewport.innerHeight - 8);
  });

  it('handles standard HL Video Editor timeline layout scenarios accurately', () => {
    // Typical HL Editor layout: 1920x1080, timeline height 280px at bottom of window
    // Toolbar is at top of timeline: window.innerHeight - 280 = 800
    // Anchor button at Y = 804, bottom = 832
    // Space below = 1080 - 832 - 14 = 234px (> 175px menuHeight)
    // Should open downwards cleanly over timeline tracks
    const standardAnchor: AnchorRect = {
      top: 804,
      bottom: 832,
      left: 720,
      right: 750,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(standardAnchor, defaultMenuDim, fullHDViewport, { gap: 6, padding: 8 });

    expect(pos.placement).toBe('bottom');
    expect(pos.top).toBe(838); // 832 + 6
    expect(pos.top + defaultMenuDim.height).toBeLessThanOrEqual(fullHDViewport.innerHeight - 8);
  });

  it('flips upward when timeline is minimized/collapsed near the bottom edge', () => {
    // When timeline is minimized/collapsed: effective height is 42px
    // Toolbar is right at bottom: Y = 730 in 768px window
    // Button bottom = 758
    // Space below = 768 - 758 - 14 = -4px -> must flip UP
    const collapsedAnchor: AnchorRect = {
      top: 730,
      bottom: 758,
      left: 600,
      right: 630,
      width: 30,
      height: 28,
    };

    const pos = calculateMenuPosition(collapsedAnchor, defaultMenuDim, standardLaptopViewport, { gap: 6, padding: 8 });

    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(730 - 6 - 175); // 549
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + defaultMenuDim.height).toBeLessThanOrEqual(collapsedAnchor.top);
  });
});
