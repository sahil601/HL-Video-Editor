import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Project, Clip } from '../../types/project';
import { formatTimecode, stepFrame } from '../../core/time';
import { interpolateKeyframes } from '../../core/keyframes';
import { ChromaKeyVideo } from './ChromaKeyVideo';
import { AudioClipPlayer } from './AudioClipPlayer';
import { VideoScopes } from './VideoScopes';
import { buildColorGradingCssFilter } from '../../core/colorGrading';
import { generateElementSvg } from '../../core/elements/elementDefinitions';
import { composeEffectsCss } from '../../core/effects/effectDefinitions';
import { generateOverlaySvg } from '../../core/overlays/overlayDefinitions';
import { getSpeedCurveSourceTimeMs } from '../../core/speedCurves';
import { interpolateWatermarkPosition } from '../../core/watermark';
import { getEffectivePreviewUrl } from '../../core/proxy';

interface PreviewPlayerProps {
  project: Project;
  currentTimeMs: number;
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  onTogglePlay: () => void;
  assetUrlMap: Map<string, string>;
  proxyUrlMap?: Map<string, string>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  project,
  currentTimeMs,
  isPlaying,
  onSeek,
  onTogglePlay,
  assetUrlMap,
  proxyUrlMap,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomFit, setZoomFit] = useState<'fit' | '50%' | '100%'>('fit');
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showScopes, setShowScopes] = useState(false);

  // Active clips at current time (including outgoing clips acting as underlayer for adjacent transitions)
  const activeClips: Clip[] = [];
  for (const track of project.tracks) {
    if (track.isHidden && (track.type === 'video' || track.type === 'overlay' || track.type === 'text')) continue;
    if (track.isMuted && track.type === 'audio') continue;
    for (const clip of track.clips) {
      if (track.isMuted && clip.type === 'audio') continue;
      const isNormallyActive = currentTimeMs >= clip.startMs && currentTimeMs < clip.startMs + clip.durationMs;

      // Keep outgoing clip active if immediately followed by an adjacent clip with an entrance transition
      let isUnderlayer = false;
      const nextClip = track.clips.find(
        (c) =>
          c.startMs === clip.startMs + clip.durationMs &&
          c.transition &&
          c.transition.durationMs > 0 &&
          c.transition.type !== 'cut'
      );
      if (nextClip?.transition) {
        const transDuration = Math.min(nextClip.durationMs * 0.5, nextClip.transition.durationMs);
        if (
          currentTimeMs >= clip.startMs + clip.durationMs &&
          currentTimeMs < clip.startMs + clip.durationMs + transDuration
        ) {
          isUnderlayer = true;
        }
      }

      if (isNormallyActive || isUnderlayer) {
        activeClips.push(clip);
      }
    }
  }

  // Sort by track order (bottom tracks first, top tracks overlay); on same track, earlier startMs first (underlayer below incoming clip)
  activeClips.sort((a, b) => {
    const trackA = project.tracks.find((t) => t.id === a.trackId);
    const trackB = project.tracks.find((t) => t.id === b.trackId);
    const orderDiff = (trackB?.order ?? 0) - (trackA?.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.startMs - b.startMs;
  });

  const { width, height } = project.settings;
  const canvasAspectRatio = width / height;

  const handlePrevFrame = () => onSeek(stepFrame(currentTimeMs, project.settings.fps, -1));
  const handleNextFrame = () => onSeek(stepFrame(currentTimeMs, project.settings.fps, 1));
  const handleJumpStart = () => onSeek(0);
  const handleJumpEnd = () => onSeek(project.durationMs);

  const renderWatermarkOverlay = (
    wm: import('../../types/project').WatermarkRemoverSettings,
    offsetMs: number
  ) => {
    if (!wm.enabled) return null;
    if (wm.startMs !== undefined && wm.endMs !== undefined && (offsetMs < wm.startMs || offsetMs > wm.endMs)) {
      return null;
    }
    const pos = interpolateWatermarkPosition(wm, offsetMs);
    const isOval = wm.shape === 'oval';
    const borderRadius = isOval ? '50%' : `${wm.feather || 4}px`;

    return (
      <div
        key="watermark_overlay"
        style={{
          position: 'absolute',
          left: `${pos.positionX}%`,
          top: `${pos.positionY}%`,
          width: `${pos.width}%`,
          height: `${pos.height}%`,
          borderRadius,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 60,
          boxShadow: wm.method === 'delogo' ? 'inset 0 0 8px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        {wm.method === 'blur' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              backdropFilter: `blur(${wm.blurIntensity || 12}px)`,
              WebkitBackdropFilter: `blur(${wm.blurIntensity || 12}px)`,
              background: 'rgba(255, 255, 255, 0.05)',
            }}
          />
        )}
        {wm.method === 'delogo' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              backdropFilter: 'blur(6px) contrast(95%)',
              WebkitBackdropFilter: 'blur(6px) contrast(95%)',
              background: 'radial-gradient(circle, rgba(120, 120, 120, 0.18) 0%, rgba(120, 120, 120, 0.06) 100%)',
            }}
          />
        )}
        {wm.method === 'pixelate' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              backgroundImage: 'radial-gradient(#111 20%, transparent 20%)',
              backgroundSize: `${wm.pixelSize || 8}px ${wm.pixelSize || 8}px`,
              opacity: 0.85,
            }}
          />
        )}
        {wm.method === 'crop' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000000',
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="vnest-preview-center">
      {/* Viewport Top Bar */}
      <div className="vnest-preview-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Canvas:</span>
          <span>{project.settings.width}x{project.settings.height} ({project.settings.aspectRatio})</span>
          <span>•</span>
          <span>{project.settings.fps} fps</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowScopes(!showScopes)}
            className="vnest-btn-subtle"
            style={{
              padding: '2px 8px',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: showScopes ? 'var(--selected-surface)' : 'transparent',
              color: showScopes ? 'var(--accent-sage)' : 'var(--text-secondary)',
              borderColor: showScopes ? 'var(--accent-sage)' : 'var(--border-subtle)',
            }}
            title="Toggle Video Scopes (Waveform / RGB Parade / Vectorscope)"
          >
            <Activity size={12} />
            <span>Scopes</span>
          </button>

          {project.proxySettings?.enabled !== false && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--accent-sage)',
                background: 'rgba(143, 184, 148, 0.15)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(143, 184, 148, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={`Proxy preview playback active (${project.proxySettings?.quality || '540p'})`}
            >
              PROXY {project.proxySettings?.quality || '540p'}
            </span>
          )}

          <select
            value={zoomFit}
            onChange={(e) => setZoomFit(e.target.value as any)}
            style={{ padding: '2px 20px 2px 8px', fontSize: 10 }}
          >
            <option value="fit">Fit Canvas</option>
            <option value="50%">50%</option>
            <option value="100%">100%</option>
          </select>

          {onToggleFullscreen && (
            <button
              id="preview-fullscreen-btn"
              onClick={onToggleFullscreen}
              className="vnest-btn-subtle"
              style={{
                padding: '3px 8px',
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isFullscreen ? 'var(--selected-surface)' : 'transparent',
                borderColor: isFullscreen ? 'var(--accent-sage)' : 'var(--border-subtle)',
                color: isFullscreen ? 'var(--accent-sage)' : 'var(--text-secondary)',
              }}
              title={isFullscreen ? 'Return to Editor (Esc)' : 'Expanded / Fullscreen Preview'}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Exit Fullscreen Button in Theater Mode */}
      {isFullscreen && onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="vnest-exit-fullscreen-btn"
          title="Return to standard editor view (Esc)"
        >
          <Minimize2 size={13} />
          <span>Exit Fullscreen (Esc)</span>
        </button>
      )}

      {/* Main Preview Canvas Area */}
      <div ref={containerRef} className="vnest-preview-canvas-area">
        <div
          className="vnest-preview-canvas-box"
          style={{
            aspectRatio: `${canvasAspectRatio}`,
            width: zoomFit === 'fit' ? 'auto' : zoomFit === '50%' ? '50%' : '100%',
            height: zoomFit === 'fit' ? '100%' : 'auto',
            backgroundColor: project.settings.backgroundColor || '#000000',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {activeClips.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', pointerEvents: 'none' }}>
              <div>Timeline Empty at Current Playhead</div>
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Drag clips onto timeline tracks to preview</div>
            </div>
          ) : (
            activeClips.map((clip) => {
              const clipOffsetMs = Math.min(clip.durationMs - 1, Math.max(0, currentTimeMs - clip.startMs));
              const props = interpolateKeyframes(clip.transform, clip.volume, clip.keyframes, clipOffsetMs);
              const asset = clip.assetId ? project.assets.find((a) => a.id === clip.assetId) : undefined;
              const useProxies = project.proxySettings?.enabled !== false;
              const assetUrl = asset
                ? getEffectivePreviewUrl(asset, useProxies, proxyUrlMap || new Map(), assetUrlMap)
                : (clip.assetId ? assetUrlMap.get(clip.assetId) : undefined);

              const baseColors = clip.colorAdjustments;
              const effectiveColors = baseColors
                ? {
                    ...baseColors,
                    exposure: props.exposure !== undefined ? props.exposure : baseColors.exposure,
                    brightness: props.brightness !== undefined ? props.brightness : baseColors.brightness,
                    contrast: props.contrast !== undefined ? props.contrast : baseColors.contrast,
                    saturation: props.saturation !== undefined ? props.saturation : baseColors.saturation,
                  }
                : undefined;
              const colors = effectiveColors || {
                exposure: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                temperature: 0,
                tint: 0,
                highlights: 0,
                shadows: 0,
                gamma: 0,
                fade: 0,
                vignette: 0,
                sharpen: 0,
              };

              const filterStyle = buildColorGradingCssFilter(effectiveColors);

              // Phase 2: Video Effects & VFX CSS
              const vfx = composeEffectsCss(clip.effects);

              // Phase 2: Real-time Transitions
              let transitionOpacity = 1.0;
              let transitionTransform = '';
              let transitionFilter = '';
              let transitionClipPath: string | undefined;

              if (clip.transition && clip.transition.durationMs > 0 && clip.transition.type !== 'cut') {
                const transDuration = Math.min(clip.durationMs * 0.5, clip.transition.durationMs);
                if (clipOffsetMs < transDuration && transDuration > 0) {
                  const progress = Math.max(0, Math.min(1, clipOffsetMs / transDuration));
                  const tType = clip.transition.type;
                  if (tType === 'fadeBlack' || tType === 'crossfade') {
                    transitionOpacity = progress;
                  } else if (tType === 'fadeWhite' || tType === 'flash') {
                    transitionFilter += ` brightness(${100 + (1 - progress) * 250}%)`;
                  } else if (tType === 'slideLeft') {
                    transitionTransform += ` translateX(${(1 - progress) * 100}%)`;
                  } else if (tType === 'slideRight') {
                    transitionTransform += ` translateX(${-(1 - progress) * 100}%)`;
                  } else if (tType === 'slideUp') {
                    transitionTransform += ` translateY(${(1 - progress) * 100}%)`;
                  } else if (tType === 'slideDown') {
                    transitionTransform += ` translateY(${-(1 - progress) * 100}%)`;
                  } else if (tType === 'zoomIn') {
                    transitionTransform += ` scale(${0.4 + progress * 0.6})`;
                  } else if (tType === 'zoomOut') {
                    transitionTransform += ` scale(${1.6 - progress * 0.6})`;
                  } else if (tType === 'rotate') {
                    transitionTransform += ` rotate(${(1 - progress) * 180}deg)`;
                    transitionOpacity = progress;
                  } else if (tType === 'blur') {
                    transitionFilter += ` blur(${(1 - progress) * 16}px)`;
                  } else if (tType === 'glitch' || tType === 'rgbSplit') {
                    const d = Math.round((1 - progress) * 12);
                    transitionFilter += ` drop-shadow(${d}px 0 rgba(255,0,80,0.8)) drop-shadow(-${d}px 0 rgba(0,240,255,0.8))`;
                  } else if (tType === 'wipeLeft') {
                    transitionClipPath = `inset(0 0 0 ${(1 - progress) * 100}%)`;
                  } else if (tType === 'wipeRight') {
                    transitionClipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
                  } else if (tType === 'wipeUp') {
                    transitionClipPath = `inset(${(1 - progress) * 100}% 0 0 0)`;
                  } else if (tType === 'wipeDown') {
                    transitionClipPath = `inset(0 0 ${(1 - progress) * 100}% 0)`;
                  } else if (tType === 'filmBurn') {
                    transitionFilter += ` brightness(${100 + (1 - progress) * 180}%) sepia(${(1 - progress) * 75}%)`;
                    transitionOpacity = 0.3 + progress * 0.7;
                  }
                }
              }

              const flipX = clip.transform.flipH ? -1 : 1;
              const flipY = clip.transform.flipV ? -1 : 1;
              const crop = clip.transform.crop;
              const blendMode = (clip.overlayProperties?.blendMode || clip.transform.blendMode || 'normal') as any;

              const combinedFilter = `${filterStyle} ${vfx.filter} ${transitionFilter}`.trim();
              const baseTransform = `translate(${props.positionX}%, ${props.positionY}%) scale(${props.scale}) rotate(${props.rotation}deg) scaleX(${flipX}) scaleY(${flipY})`;
              const combinedTransform = `${baseTransform} ${vfx.transform} ${transitionTransform}`.trim();

              // Phase 3: Advanced Masks calculation
              let maskClipPath: string | undefined = undefined;
              let maskImageGrad: string | undefined = undefined;
              if (clip.mask && clip.mask.shape !== 'none') {
                const m = clip.mask;
                const mX = m.positionX ?? 0;
                const mY = m.positionY ?? 0;
                const msX = Math.max(0.05, m.scaleX ?? 1);
                const msY = Math.max(0.05, m.scaleY ?? 1);
                const mFeather = Math.max(0, Math.min(100, m.feather ?? 0));
                const mInv = !!m.inverted;
                const mRot = m.rotation ?? 0;

                if (m.shape === 'circle' || m.shape === 'oval') {
                  const rx = (m.shape === 'circle' ? 35 * msX : 45 * msX);
                  const ry = (m.shape === 'circle' ? 35 * msX : 25 * msY);
                  const stop1 = Math.max(0, 100 - mFeather);
                  const cIn = mInv ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)';
                  const cOut = mInv ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)';
                  maskImageGrad = `radial-gradient(ellipse ${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${(50 + mX).toFixed(1)}% ${(50 + mY).toFixed(1)}%, ${cIn} 0%, ${cIn} ${stop1.toFixed(1)}%, ${cOut} 100%)`;
                } else if (m.shape === 'linear') {
                  const cIn = mInv ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)';
                  const cOut = mInv ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)';
                  const mid = 50 + mX * 0.5;
                  const fHalf = Math.max(1, mFeather * 0.4);
                  maskImageGrad = `linear-gradient(${mRot + 90}deg, ${cIn} 0%, ${cIn} ${Math.max(0, mid - fHalf).toFixed(1)}%, ${cOut} ${Math.min(100, mid + fHalf).toFixed(1)}%, ${cOut} 100%)`;
                } else if (m.shape === 'rectangle') {
                  const halfW = 40 * msX;
                  const halfH = 30 * msY;
                  if (mFeather === 0 && !mInv && mRot === 0) {
                    const t = Math.max(0, 50 + mY - halfH);
                    const b = Math.max(0, 100 - (50 + mY + halfH));
                    const l = Math.max(0, 50 + mX - halfW);
                    const r = Math.max(0, 100 - (50 + mX + halfW));
                    maskClipPath = `inset(${t.toFixed(1)}% ${r.toFixed(1)}% ${b.toFixed(1)}% ${l.toFixed(1)}%)`;
                  } else {
                    const cIn = mInv ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)';
                    const cOut = mInv ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)';
                    maskImageGrad = `radial-gradient(ellipse ${halfW.toFixed(1)}% ${halfH.toFixed(1)}% at ${(50 + mX).toFixed(1)}% ${(50 + mY).toFixed(1)}%, ${cIn} 0%, ${cIn} ${Math.max(0, 100 - mFeather).toFixed(1)}%, ${cOut} 100%)`;
                  }
                }
              }

              const transformStyle: React.CSSProperties = {
                transform: combinedTransform,
                opacity: props.opacity * transitionOpacity,
                filter: combinedFilter,
                mixBlendMode: blendMode !== 'normal' ? blendMode : undefined,
                WebkitMaskImage: maskImageGrad,
                maskImage: maskImageGrad,
                clipPath:
                  maskClipPath ||
                  transitionClipPath ||
                  (crop && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)
                    ? `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`
                    : undefined),
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              };

              // Phase 3: Variable speed curves calculation
              const sourceTimeOffsetMs = (clip.speedCurve && clip.speedCurve.length >= 2)
                ? getSpeedCurveSourceTimeMs(clip.speedCurve, clipOffsetMs, clip.durationMs, clip.speed)
                : clipOffsetMs * clip.speed;
              const targetTimeSec = (clip.sourceStartMs + sourceTimeOffsetMs) / 1000;

              // Render procedural overlays
              if (clip.overlayProperties) {
                const overlaySvg = generateOverlaySvg(
                  clip.overlayProperties.overlayType,
                  1920,
                  1080,
                  { opacity: clip.overlayProperties.opacity, color: clip.overlayProperties.color }
                );
                return (
                  <div key={clip.id} style={transformStyle}>
                    <div
                      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                      dangerouslySetInnerHTML={{ __html: overlaySvg }}
                    />
                  </div>
                );
              }

              if (clip.type === 'video' || clip.type === 'overlay') {
                let videoFadeMultiplier = 1.0;
                if (clip.fadeInMs && clip.fadeInMs > 0 && clipOffsetMs < clip.fadeInMs) {
                  videoFadeMultiplier = Math.max(0, clipOffsetMs / clip.fadeInMs);
                } else if (clip.fadeOutMs && clip.fadeOutMs > 0 && (clip.durationMs - clipOffsetMs) < clip.fadeOutMs) {
                  videoFadeMultiplier = Math.max(0, (clip.durationMs - clipOffsetMs) / clip.fadeOutMs);
                }
                const effectiveVideoVolume = props.volume * volume * videoFadeMultiplier;

                return (
                  <div key={clip.id} style={transformStyle}>
                    {assetUrl ? (
                      <ChromaKeyVideo
                        src={assetUrl}
                        clip={clip}
                        isPlaying={isPlaying}
                        targetTimeSec={targetTimeSec}
                        volume={effectiveVideoVolume}
                        isMuted={isMuted}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#e0e7ff',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {clip.name}
                      </div>
                    )}

                    {/* Lifted blacks / Fade grading */}
                    {!colors.bypassed && colors.fade && colors.fade > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: `rgba(255, 255, 255, ${(colors.fade * 0.0018).toFixed(3)})`,
                          mixBlendMode: 'screen',
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Vignette effect overlay */}
                    {!colors.bypassed && colors.vignette && colors.vignette > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          boxShadow: `inset 0 0 ${Math.round(colors.vignette * 1.5)}px rgba(0,0,0,${(colors.vignette / 100).toFixed(2)})`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Watermark Removal Preview (Phase 4) */}
                    {clip.watermarkRemover && clip.watermarkRemover.enabled && renderWatermarkOverlay(clip.watermarkRemover, clipOffsetMs)}
                  </div>
                );
              }

              if (clip.type === 'image') {
                return (
                  <div key={clip.id} style={transformStyle}>
                    {assetUrl ? (
                      <img src={assetUrl} alt={clip.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: '#164e63',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#cffafe',
                          fontSize: 13,
                        }}
                      >
                        {clip.name}
                      </div>
                    )}

                    {/* Lifted blacks / Fade grading */}
                    {!colors.bypassed && colors.fade && colors.fade > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: `rgba(255, 255, 255, ${(colors.fade * 0.0018).toFixed(3)})`,
                          mixBlendMode: 'screen',
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {!colors.bypassed && colors.vignette && colors.vignette > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          boxShadow: `inset 0 0 ${Math.round(colors.vignette * 1.5)}px rgba(0,0,0,${(colors.vignette / 100).toFixed(2)})`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>
                );
              }

              if (clip.type === 'text') {
                const textProps = clip.textProperties;
                const inDuration = textProps?.inAnimationDurationMs ?? 400;
                const outDuration = textProps?.outAnimationDurationMs ?? 400;
                const timeUntilEnd = clip.durationMs - clipOffsetMs;

                let animOpacity = 1.0;
                let animTransform = '';
                let visibleCharsCount: number | null = null;

                // In animation
                if (textProps?.inAnimation && textProps.inAnimation !== 'none' && clipOffsetMs < inDuration && inDuration > 0) {
                  const p = Math.max(0, Math.min(1, clipOffsetMs / inDuration));
                  if (textProps.inAnimation === 'fade') {
                    animOpacity *= p;
                  } else if (textProps.inAnimation === 'slide') {
                    animOpacity *= p;
                    animTransform += ` translateY(${(1 - p) * 35}px)`;
                  } else if (textProps.inAnimation === 'zoom') {
                    animOpacity *= p;
                    animTransform += ` scale(${0.3 + p * 0.7})`;
                  } else if (textProps.inAnimation === 'typewriter') {
                    const fullText = textProps.text || clip.name || '';
                    visibleCharsCount = Math.floor(p * fullText.length);
                  }
                }

                // Out animation
                if (textProps?.outAnimation && textProps.outAnimation !== 'none' && timeUntilEnd < outDuration && outDuration > 0) {
                  const p = Math.max(0, Math.min(1, timeUntilEnd / outDuration));
                  if (textProps.outAnimation === 'fade') {
                    animOpacity *= p;
                  } else if (textProps.outAnimation === 'slide') {
                    animOpacity *= p;
                    animTransform += ` translateY(${(1 - p) * -35}px)`;
                  } else if (textProps.outAnimation === 'zoom') {
                    animOpacity *= p;
                    animTransform += ` scale(${0.3 + p * 0.7})`;
                  }
                }

                const fontSize = (textProps?.fontSize || 36) * props.scale;
                const strokeWidth = (textProps?.strokeWidth || 0) * props.scale;
                const strokeColor = textProps?.strokeColor || '#000000';
                const hasStroke = strokeWidth > 0;
                const hasWordHighlight = textProps?.highlightWord && textProps?.words && textProps.words.length > 0;

                // Text shadow custom styling
                const sX = textProps?.shadowOffsetX ?? 0;
                const sY = textProps?.shadowOffsetY ?? 2;
                const sB = textProps?.shadowBlur ?? (hasStroke ? 0 : 8);
                const sColor = textProps?.shadowColor ?? '#000000';
                const sOpacity = (textProps?.shadowOpacity ?? 85) / 100;
                const shadowCss = `${sX}px ${sY}px ${sB}px rgba(0,0,0,${sOpacity})`;

                const rawText = textProps?.text || clip.name;
                const displayedText = visibleCharsCount !== null ? rawText.slice(0, visibleCharsCount) : rawText;

                return (
                  <div
                    key={clip.id}
                    style={{
                      ...transformStyle,
                      opacity: transformStyle.opacity !== undefined ? Number(transformStyle.opacity) * animOpacity : animOpacity,
                      transform: `${transformStyle.transform} ${animTransform}`.trim(),
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: textProps?.fontFamily || 'inherit',
                        fontSize: `${fontSize}px`,
                        color: textProps?.color || '#ffffff',
                        backgroundColor: textProps?.backgroundColor || 'transparent',
                        textAlign: textProps?.textAlign || 'center',
                        textShadow: shadowCss,
                        WebkitTextStroke: hasStroke ? `${strokeWidth}px ${strokeColor}` : undefined,
                        padding:
                          textProps?.backgroundColor && textProps.backgroundColor !== 'transparent'
                            ? `${(textProps.backgroundPadding || 8) * props.scale}px ${
                                (textProps.backgroundPadding || 12) * props.scale * 1.5
                              }px`
                            : '0',
                        borderRadius: `${(textProps?.borderRadius || 6) * props.scale}px`,
                        maxWidth: '90%',
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      {hasWordHighlight ? (
                        textProps.words!.map((w, wIdx) => {
                          const isWordActive = currentTimeMs >= w.startMs && currentTimeMs <= w.endMs;
                          return (
                            <span
                              key={wIdx}
                              style={{
                                color: isWordActive
                                  ? textProps.highlightColor || '#facc15'
                                  : textProps.color || '#ffffff',
                                textShadow: isWordActive ? '0 0 12px rgba(250, 204, 21, 0.9)' : shadowCss,
                                display: 'inline-block',
                                marginRight: '0.25em',
                                transform: isWordActive ? 'scale(1.08)' : 'scale(1.0)',
                                transition: 'all 0.08s ease-out',
                              }}
                            >
                              {w.word}
                            </span>
                          );
                        })
                      ) : (
                        displayedText
                      )}
                    </div>
                  </div>
                );
              }

              if (clip.type === 'element' && clip.elementProperties) {
                const elemProps = clip.elementProperties;
                const isFrame = elemProps.elementType === 'frame_cinema' || elemProps.elementType === 'frame_border';
                const svgMarkup = generateElementSvg(elemProps, 600, 400);

                return (
                  <div key={clip.id} style={transformStyle}>
                    <div
                      style={{
                        width: isFrame ? '100%' : '65%',
                        height: isFrame ? '100%' : '65%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}
                      dangerouslySetInnerHTML={{ __html: svgMarkup }}
                    />
                  </div>
                );
              }

              if (clip.type === 'audio') {
                if (!assetUrl) return null;

                // Dynamic Audio Fade-in / Fade-out calculation
                let fadeMultiplier = 1.0;
                if (clip.fadeInMs && clip.fadeInMs > 0 && clipOffsetMs < clip.fadeInMs) {
                  fadeMultiplier = Math.max(0, clipOffsetMs / clip.fadeInMs);
                } else if (clip.fadeOutMs && clip.fadeOutMs > 0 && (clip.durationMs - clipOffsetMs) < clip.fadeOutMs) {
                  fadeMultiplier = Math.max(0, (clip.durationMs - clipOffsetMs) / clip.fadeOutMs);
                }

                const effectiveVolume = props.volume * volume * fadeMultiplier;

                return (
                  <AudioClipPlayer
                    key={clip.id}
                    src={assetUrl}
                    clip={clip}
                    isPlaying={isPlaying}
                    targetTimeSec={targetTimeSec}
                    volume={effectiveVolume}
                    isMuted={isMuted}
                  />
                );
              }

              return null;
            })
          )}

          {/* Project-level Watermark Removal Overlay (Phase 4) */}
          {project.watermarkRemover && project.watermarkRemover.enabled && renderWatermarkOverlay(project.watermarkRemover, currentTimeMs)}
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="vnest-preview-transport">
        {/* Timecode display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span
            className="font-mono-time"
            style={{
              padding: '3px 8px',
              borderRadius: 5,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            {formatTimecode(currentTimeMs, project.settings.fps)}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="font-mono-time" style={{ color: 'var(--text-secondary)' }}>
            {formatTimecode(project.durationMs, project.settings.fps)}
          </span>
        </div>

        {/* Playback Transport Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={handleJumpStart} className="vnest-btn-icon" title="Jump to Beginning (Home)">
            <SkipBack style={{ width: 15, height: 15 }} />
          </button>
          <button onClick={handlePrevFrame} className="vnest-btn-icon" title="Step Back 1 Frame (Left Arrow)">
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <button
            onClick={onTogglePlay}
            className="vnest-btn-primary"
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              boxShadow: '0 0 10px var(--accent-sage-glow)',
            }}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause style={{ width: 16, height: 16 }} /> : <Play style={{ width: 16, height: 16 }} />}
          </button>
          <button onClick={handleNextFrame} className="vnest-btn-icon" title="Step Forward 1 Frame (Right Arrow)">
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={handleJumpEnd} className="vnest-btn-icon" title="Jump to End (End)">
            <SkipForward style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Master Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="vnest-btn-icon"
            title={isMuted ? 'Unmute Preview Audio' : 'Mute Preview Audio'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX style={{ width: 16, height: 16, color: 'var(--accent-rose)' }} />
            ) : (
              <Volume2 style={{ width: 16, height: 16 }} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            style={{ width: 70 }}
            title={`Preview Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>
      </div>

      {/* Real-Time Video Scopes (Waveform / RGB Parade / Vectorscope) */}
      <VideoScopes
        isOpen={showScopes}
        onClose={() => setShowScopes(false)}
        videoElement={containerRef.current?.querySelector('video, canvas') as HTMLVideoElement | HTMLCanvasElement | null}
      />
    </div>
  );
};
