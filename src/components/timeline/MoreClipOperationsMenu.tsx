import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Link as LinkIcon,
  Unlink,
  Snowflake,
  Music,
  Mic,
} from 'lucide-react';

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface WindowViewport {
  innerWidth: number;
  innerHeight: number;
}

export interface CalculatedMenuPosition {
  top: number;
  left: number;
  placement: 'bottom' | 'top';
  maxHeight?: number;
}

/**
 * Calculates optimal popover coordinates avoiding clipping, keeping the menu
 * strictly inside the visible viewport and opening below by default, or above
 * if vertical space below is insufficient.
 */
export function calculateMenuPosition(
  anchorRect: AnchorRect,
  menuDimensions: { width: number; height: number },
  viewport: WindowViewport,
  options?: { gap?: number; padding?: number }
): CalculatedMenuPosition {
  const gap = options?.gap ?? 6;
  const padding = options?.padding ?? 8;

  const { innerWidth, innerHeight } = viewport;
  const menuWidth = Math.max(menuDimensions.width, 160);
  const menuHeight = Math.max(menuDimensions.height, 140);

  // Available room below and above the anchor button
  const spaceBelow = innerHeight - anchorRect.bottom - gap - padding;
  const spaceAbove = anchorRect.top - gap - padding;

  let placement: 'bottom' | 'top' = 'bottom';
  let top = anchorRect.bottom + gap;

  // Open upward only when space below cannot fit the menu and space above is greater
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    placement = 'top';
    top = anchorRect.top - gap - menuHeight;
  }

  // Horizontal positioning: default align with anchor's left edge
  let left = anchorRect.left;
  // If menu would overflow right viewport boundary, shift it left
  if (left + menuWidth > innerWidth - padding) {
    left = Math.max(padding, innerWidth - menuWidth - padding);
  }
  // If menu would overflow left boundary, clamp to padding
  if (left < padding) {
    left = padding;
  }

  // Clamp vertical bounds to keep menu inside viewport at all resolutions
  let maxHeight: number | undefined = undefined;
  if (top < padding) {
    top = padding;
    maxHeight = Math.max(80, innerHeight - (padding * 2));
  } else if (top + menuHeight > innerHeight - padding) {
    maxHeight = Math.max(80, innerHeight - top - padding);
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
    maxHeight: maxHeight ? Math.round(maxHeight) : undefined,
  };
}

export interface MoreClipOperationsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  canGroupSelected: boolean;
  isCurrentClipGrouped: boolean;
  selectedClipId: string | null;
  onGroupClips?: () => void;
  onUngroupClips?: () => void;
  onFreezeFrame?: () => void;
  onExtractAudio?: () => void;
  onOpenVoiceOver?: () => void;
}

export const MoreClipOperationsMenu: React.FC<MoreClipOperationsMenuProps> = ({
  isOpen,
  onClose,
  anchorRef,
  canGroupSelected,
  isCurrentClipGrouped,
  selectedClipId,
  onGroupClips,
  onUngroupClips,
  onFreezeFrame,
  onExtractAudio,
  onOpenVoiceOver,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<CalculatedMenuPosition>(() => ({
    top: 0,
    left: 0,
    placement: 'bottom',
  }));

  // Reposition synchronously before paint when opened or when anchor rect updates
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const updatePosition = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth || 190;
      const measuredHeight = menuRef.current?.offsetHeight || 175;

      const pos = calculateMenuPosition(
        rect,
        { width: measuredWidth, height: measuredHeight },
        { innerWidth: window.innerWidth, innerHeight: window.innerHeight }
      );
      setPosition(pos);
    };

    updatePosition();
  }, [isOpen, anchorRef]);

  // Handle outside clicks, Escape key dismissal, and window resizing
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (anchorRef.current && anchorRef.current.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleWindowChange = () => {
      if (!anchorRef.current) {
        onClose();
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth || 190;
      const measuredHeight = menuRef.current?.offsetHeight || 175;

      setPosition(
        calculateMenuPosition(
          rect,
          { width: measuredWidth, height: measuredHeight },
          { innerWidth: window.innerWidth, innerHeight: window.innerHeight }
        )
      );
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || typeof document === 'undefined' || !document.body) {
    return null;
  }

  const menuElement = (
    <div
      ref={menuRef}
      id="timeline-more-clip-ops-menu"
      data-testid="timeline-more-clip-ops-menu"
      data-placement={position.placement}
      role="menu"
      aria-label="More Clip Operations"
      className="vnest-popover-menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: position.maxHeight ? `${position.maxHeight}px` : undefined,
        overflowY: position.maxHeight ? 'auto' : 'visible',
      }}
    >
      {onGroupClips && (
        <button
          id="menu-item-group-clips"
          data-testid="menu-item-group-clips"
          role="menuitem"
          onClick={() => {
            onClose();
            onGroupClips();
          }}
          disabled={!canGroupSelected}
          className="vnest-btn-subtle"
          style={{
            justifyContent: 'flex-start',
            fontSize: '11px',
            padding: '5px 8px',
            gap: 6,
            width: '100%',
          }}
          title="Group selected clips (Ctrl+G)"
        >
          <LinkIcon size={12} />
          <span>Group Clips (Ctrl+G)</span>
        </button>
      )}

      {onUngroupClips && (
        <button
          id="menu-item-ungroup-clips"
          data-testid="menu-item-ungroup-clips"
          role="menuitem"
          onClick={() => {
            onClose();
            onUngroupClips();
          }}
          disabled={!isCurrentClipGrouped}
          className="vnest-btn-subtle"
          style={{
            justifyContent: 'flex-start',
            fontSize: '11px',
            padding: '5px 8px',
            gap: 6,
            width: '100%',
          }}
          title="Ungroup selected clips (Ctrl+Shift+G)"
        >
          <Unlink size={12} />
          <span>Ungroup (Ctrl+Shift+G)</span>
        </button>
      )}

      {onFreezeFrame && (
        <button
          id="menu-item-freeze-frame"
          data-testid="menu-item-freeze-frame"
          role="menuitem"
          onClick={() => {
            onClose();
            onFreezeFrame();
          }}
          disabled={!selectedClipId}
          className="vnest-btn-subtle"
          style={{
            justifyContent: 'flex-start',
            fontSize: '11px',
            padding: '5px 8px',
            gap: 6,
            width: '100%',
          }}
          title="Freeze Frame at playhead (creates 3s freeze clip)"
        >
          <Snowflake size={12} />
          <span>Freeze Frame</span>
        </button>
      )}

      {onExtractAudio && (
        <button
          id="menu-item-extract-audio"
          data-testid="menu-item-extract-audio"
          role="menuitem"
          onClick={() => {
            onClose();
            onExtractAudio();
          }}
          disabled={!selectedClipId}
          className="vnest-btn-subtle"
          style={{
            justifyContent: 'flex-start',
            fontSize: '11px',
            padding: '5px 8px',
            gap: 6,
            width: '100%',
          }}
          title="Extract audio from selected video to audio track"
        >
          <Music size={12} />
          <span>Extract Audio</span>
        </button>
      )}

      {onOpenVoiceOver && (
        <button
          id="menu-item-voiceover"
          data-testid="menu-item-voiceover"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenVoiceOver();
          }}
          className="vnest-btn-subtle"
          style={{
            justifyContent: 'flex-start',
            fontSize: '11px',
            padding: '5px 8px',
            gap: 6,
            width: '100%',
          }}
          title="Record Voiceover narration"
        >
          <Mic size={12} />
          <span>Record Voiceover</span>
        </button>
      )}
    </div>
  );

  return createPortal(menuElement, document.body);
};
