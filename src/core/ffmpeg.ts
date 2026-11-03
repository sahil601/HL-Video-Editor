import { Project, Clip, Track } from '../types/project';
import { ExportPreset } from '../types/timeline';
import { composeEffectsFfmpeg } from './effects/effectDefinitions';
import {
  getSpeedCurveSourceTimeMs,
  generateSpeedCurveSegments,
  calculateSpeedCurveAverage,
} from './speedCurves';
import { buildWatermarkFFmpegFilters } from './watermark';
import { buildColorGradingFFmpegFilters } from './colorGrading';
import { buildClipAudioFFmpegFilters, buildAudioDuckingFilter } from './audioProcessing';

import { ProfessionalExportPreset } from '../types/export';

export const EXPORT_PRESETS: ProfessionalExportPreset[] = [
  // General / Legacy Presets (Retained for 100% backward compatibility)
  {
    id: '1080p_16x9',
    name: '1080p Full HD (16:9)',
    description: 'Standard widescreen video for web and desktop displays',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    videoBitrate: '10M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'general',
  },
  {
    id: '1080p_9x16',
    name: '1080p Vertical (9:16)',
    description: 'Optimized for TikTok, Instagram Reels, and YouTube Shorts',
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatio: '9:16',
    videoBitrate: '10M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'general',
  },
  {
    id: '1080p_1x1',
    name: '1080p Square (1:1)',
    description: 'Square social media feeds',
    width: 1080,
    height: 1080,
    fps: 30,
    aspectRatio: '1:1',
    videoBitrate: '8M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'general',
  },
  {
    id: '720p_fast',
    name: '720p Fast Draft (16:9)',
    description: 'Quick export for reviewing cuts, pacing, and drafts',
    width: 1280,
    height: 720,
    fps: 30,
    aspectRatio: '16:9',
    videoBitrate: '4M',
    audioBitrate: '128k',
    format: 'mp4',
    codec: 'libx264',
    category: 'general',
  },
  {
    id: '4k_uhd',
    name: '4K Ultra HD (16:9)',
    description: 'Maximum resolution for premium 4K television and monitors',
    width: 3840,
    height: 2160,
    fps: 60,
    aspectRatio: '16:9',
    videoBitrate: '35M',
    audioBitrate: '320k',
    format: 'mp4',
    codec: 'libx264',
    category: 'general',
  },

  // Professional YouTube Presets
  {
    id: 'youtube_1080p',
    name: 'YouTube 1080p Full HD',
    description: 'Recommended 1080p60 upload for high frame-rate YouTube videos',
    width: 1920,
    height: 1080,
    fps: 60,
    aspectRatio: '16:9',
    videoBitrate: '12M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'youtube',
    tag: 'YouTube',
  },
  {
    id: 'youtube_4k',
    name: 'YouTube 4K Ultra HD',
    description: 'High-bitrate 60fps master optimized for YouTube VP9/AV1 transcoding',
    width: 3840,
    height: 2160,
    fps: 60,
    aspectRatio: '16:9',
    videoBitrate: '45M',
    audioBitrate: '320k',
    format: 'mp4',
    codec: 'libx264',
    category: 'youtube',
    tag: 'YouTube 4K',
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts (9:16)',
    description: 'Optimized 60fps vertical format for maximum engagement on YouTube Shorts',
    width: 1080,
    height: 1920,
    fps: 60,
    aspectRatio: '9:16',
    videoBitrate: '12M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'youtube',
    tag: 'Shorts',
  },

  // Professional Instagram Presets
  {
    id: 'instagram_story',
    name: 'Instagram Reel & Story (9:16)',
    description: 'Full-screen 9:16 vertical video conforming to Instagram Reels specs',
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatio: '9:16',
    videoBitrate: '10M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'instagram',
    tag: 'IG Reel',
  },
  {
    id: 'instagram_portrait',
    name: 'Instagram Portrait Feed (4:5)',
    description: 'Vertical 4:5 format covering maximum screen space in main feed without crop',
    width: 1080,
    height: 1350,
    fps: 30,
    aspectRatio: '4:5',
    videoBitrate: '8M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'instagram',
    tag: 'IG 4:5',
  },
  {
    id: 'instagram_square',
    name: 'Instagram Square Post (1:1)',
    description: 'Classic 1:1 square video post for standard Instagram grid',
    width: 1080,
    height: 1080,
    fps: 30,
    aspectRatio: '1:1',
    videoBitrate: '8M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'instagram',
    tag: 'IG Square',
  },

  // Professional TikTok Presets
  {
    id: 'tiktok_1080p',
    name: 'TikTok 1080p HD (9:16)',
    description: 'Crisp full-HD 9:16 vertical render for TikTok feed recommendation algorithms',
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatio: '9:16',
    videoBitrate: '10M',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    category: 'tiktok',
    tag: 'TikTok HD',
  },
  {
    id: 'tiktok_720p',
    name: 'TikTok 720p Fast (9:16)',
    description: 'Lightweight vertical video for ultra-fast mobile upload and instant processing',
    width: 720,
    height: 1280,
    fps: 30,
    aspectRatio: '9:16',
    videoBitrate: '5M',
    audioBitrate: '128k',
    format: 'mp4',
    codec: 'libx264',
    category: 'tiktok',
    tag: 'TikTok Fast',
  },

  // Cinema & Archival Presets
  {
    id: 'cinematic_4k',
    name: 'Cinematic 4K DCI (21:9)',
    description: 'Widescreen theatrical format at traditional 24.00 fps motion picture cadence',
    width: 3840,
    height: 1620,
    fps: 24,
    aspectRatio: '21:9',
    videoBitrate: '45M',
    audioBitrate: '320k',
    format: 'mp4',
    codec: 'libx264',
    category: 'cinema',
    tag: 'Cinema 24p',
  },
  {
    id: 'prores_hq',
    name: 'Apple ProRes 422 HQ',
    description: 'Professional 10-bit editing intermediate master with uncompressed fidelity',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    videoBitrate: '100M',
    audioBitrate: '320k',
    format: 'mov',
    codec: 'prores_ks',
    audioCodec: 'pcm_s16le',
    category: 'cinema',
    tag: 'ProRes 422',
  },
];

/**
 * Safely escapes a file path for inclusion inside an FFmpeg filter argument
 * (e.g. subtitles='path' or lut3d=file='path').
 * Handles Windows drive colons, backslashes, spaces, commas, brackets, semicolons, and quotes.
 */
export function escapeFFmpegFilterPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\''")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

/**
 * Converts a hex color (#RRGGBB or #RGB) into ASS subtitle format &HAABBGGRR
 */
export function hexToAssColor(hex?: string, alphaHex = '00'): string {
  if (!hex || !hex.startsWith('#')) return '&H00FFFFFF';
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length === 6) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
  }
  return '&H00FFFFFF';
}

/**
 * Builds standard FFmpeg arguments for rendering a project timeline
 */
export function buildFFmpegExportArgs(
  project: Project,
  preset: ExportPreset | ProfessionalExportPreset,
  outputPath: string,
  assetPathResolver: (assetId: string) => string | null,
  options?: {
    subtitleSrtPath?: string;
    captionStyle?: import('./captions/types').CaptionStyle;
    lutPathResolver?: (clipId: string) => string | null;
    encoderOverride?: string;
    hasAudioResolver?: (clip: Clip, resolvedPath: string) => boolean;
  }
): { args: string[]; inputFiles: string[] } {
  const args: string[] = ['-y']; // Overwrite output
  const inputFiles: string[] = [];
  const fileToInputIndex = new Map<string, number>();

  // Collect all unique media files used by clips on timeline
  const activeClips: Clip[] = [];
  for (const track of project.tracks) {
    if (track.isMuted) continue;
    for (const clip of track.clips) {
      const resolvedPath = (clip.assetId ? assetPathResolver(clip.assetId) : null) || assetPathResolver(clip.id);
      if (resolvedPath) {
        activeClips.push(clip);
        if (!fileToInputIndex.has(resolvedPath)) {
          fileToInputIndex.set(resolvedPath, inputFiles.length);
          inputFiles.push(resolvedPath);
        }
      }
    }
  }

  // Add inputs
  for (const file of inputFiles) {
    args.push('-i', file);
  }

  // If there are no clips, generate compliant color background with silent audio
  if (activeClips.length === 0) {
    const emptyDurationSec = 5;
    args.push(
      '-filter_complex',
      `color=c=${project.settings.backgroundColor || '#000000'}:s=${preset.width}x${preset.height}:d=${emptyDurationSec}:r=${preset.fps}[base];anullsrc=r=48000:cl=stereo,atrim=duration=${emptyDurationSec}[silent]`,
      '-map', '[base]',
      '-map', '[silent]',
      '-c:v', preset.codec || 'libx264',
      '-c:a', 'aac',
      '-b:a', preset.audioBitrate || '128k',
      '-pix_fmt', 'yuv420p',
      '-r', String(preset.fps),
      outputPath
    );
    return { args, inputFiles };
  }

  // Build filtergraph
  const totalDurationSec = Math.max(1, project.durationMs / 1000);
  const filtergraph: string[] = [];

  // 1. Base Canvas
  filtergraph.push(
    `color=c=${project.settings.backgroundColor || '#000000'}:s=${preset.width}x${preset.height}:r=${preset.fps}:d=${totalDurationSec}[base]`
  );

  let currentCanvasTag = 'base';
  let overlayIndex = 0;

  // 2. Process visual tracks (video, overlay, elements) in bottom-to-top order
  const visualTracks = project.tracks
    .filter((t) => t.type !== 'audio' && !t.isMuted && !t.isHidden)
    .sort((a, b) => b.order - a.order);

  for (const track of visualTracks) {
    const sortedClips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    for (const clip of sortedClips) {
      // If subtitle burning is enabled, skip text clips here as they are burned via the subtitles filter
      if (options?.subtitleSrtPath && clip.type === 'text') continue;

      const resolvedPath = (clip.assetId ? assetPathResolver(clip.assetId) : null) || assetPathResolver(clip.id);
      if (!resolvedPath || !fileToInputIndex.has(resolvedPath)) continue;

      const inputIdx = fileToInputIndex.get(resolvedPath)!;
      const clipStartSec = clip.startMs / 1000;
      const clipDurationSec = clip.durationMs / 1000;
      const sourceInSec = clip.sourceStartMs / 1000;

      // Check if this clip immediately precedes an adjacent clip that has an entrance transition
      const nextAdjacentClip = sortedClips.find(
        (c) =>
          c.id !== clip.id &&
          Math.abs(c.startMs - (clip.startMs + clip.durationMs)) < 50 &&
          c.transition &&
          c.transition.durationMs > 0 &&
          c.transition.type !== 'cut'
      );
      const underlayerTransSec = nextAdjacentClip
        ? Math.min((nextAdjacentClip.durationMs / 1000) * 0.5, nextAdjacentClip.transition!.durationMs / 1000)
        : 0;

      const clipTag = `clip_${overlayIndex}`;
      const nextCanvasTag = `layer_${overlayIndex}`;

      // Assemble individual clip filter chain
      const clipFilters: string[] = [];
      let initialSourceTag = `${inputIdx}:v`;

      // A. Trim & Speed / Variable Speed Curves / Freeze Frame / Still Images & Elements
      if (clip.speedCurve && clip.speedCurve.length >= 2) {
        const totalSrcMs = getSpeedCurveSourceTimeMs(clip.speedCurve, clip.durationMs, clip.durationMs, clip.speed);
        const segments = generateSpeedCurveSegments(clip.speedCurve, clip.sourceStartMs, totalSrcMs, clip.durationMs, 8);
        const splitTags = segments.map((_, i) => `[s_${overlayIndex}_${i}]`).join('');
        filtergraph.push(`[${inputIdx}:v]split=${segments.length}${splitTags}`);

        const segTags: string[] = [];
        segments.forEach((seg, i) => {
          const sTag = `seg_${overlayIndex}_${i}`;
          segTags.push(`[${sTag}]`);
          const pts = (1 / Math.max(0.1, seg.speed)).toFixed(4);
          filtergraph.push(
            `[s_${overlayIndex}_${i}]trim=start=${seg.sourceStartSec.toFixed(3)}:duration=${seg.sourceDurationSec.toFixed(3)},setpts=${pts}*PTS-STARTPTS[${sTag}]`
          );
        });

        const speedConcatTag = `vspeed_${overlayIndex}`;
        filtergraph.push(`${segTags.join('')}concat=n=${segments.length}:v=1:a=0[${speedConcatTag}]`);
        initialSourceTag = speedConcatTag;
      } else if (clip.isFrozen && clip.freezeFrameSourceMs !== undefined) {
        const freezeSec = clip.freezeFrameSourceMs / 1000;
        clipFilters.push(
          `trim=start=${freezeSec}:duration=0.04`,
          `loop=loop=-1:size=1`,
          `trim=duration=${clipDurationSec}`,
          `setpts=PTS-STARTPTS`
        );
      } else if (clip.type === 'image' || clip.type === 'element') {
        clipFilters.push(
          `loop=loop=-1:size=1`,
          `trim=duration=${clipDurationSec}`,
          `setpts=PTS-STARTPTS`
        );
      } else {
        const speedPts = clip.speed > 0 ? (1 / clip.speed).toFixed(4) : '1.0';
        clipFilters.push(
          `trim=start=${sourceInSec}:duration=${clipDurationSec}`,
          `setpts=${speedPts}*PTS-STARTPTS`
        );
      }

      // If this clip serves as an underlayer for an adjacent incoming transition, clone its final frame
      if (underlayerTransSec > 0.04) {
        clipFilters.push(`tpad=stop_mode=clone:stop_duration=${underlayerTransSec.toFixed(3)}`);
      }

      // B. Crop
      if (clip.transform.crop) {
        const { top, bottom, left, right } = clip.transform.crop;
        if (top > 0 || bottom > 0 || left > 0 || right > 0) {
          const wFrac = Math.max(0.05, 1 - (left + right) / 100);
          const hFrac = Math.max(0.05, 1 - (top + bottom) / 100);
          const xFrac = left / 100;
          const yFrac = top / 100;
          clipFilters.push(`crop=w=iw*${wFrac.toFixed(3)}:h=ih*${hFrac.toFixed(3)}:x=iw*${xFrac.toFixed(3)}:y=ih*${yFrac.toFixed(3)}`);
        }
      }

      // C. Flip Horizontal / Vertical
      if (clip.transform.flipH) clipFilters.push('hflip');
      if (clip.transform.flipV) clipFilters.push('vflip');

      // D. Rotation
      if (clip.transform.rotation && clip.transform.rotation !== 0) {
        const rad = (clip.transform.rotation * Math.PI) / 180;
        clipFilters.push(`rotate=${rad.toFixed(4)}:ow='rotw(${rad.toFixed(4)})':oh='roth(${rad.toFixed(4)})':c=none`);
      }

      // E. Chroma Key & Spill Suppression (Green Screen / Blue Screen)
      if (clip.chromaKey?.enabled) {
        const hex = clip.chromaKey.color.replace('#', '0x');
        const sim = clip.chromaKey.similarity ?? 0.35;
        const blend = clip.chromaKey.smoothness ?? 0.10;
        clipFilters.push(`colorkey=color=${hex}:similarity=${sim}:blend=${blend}`);

        if (clip.chromaKey.spill && clip.chromaKey.spill > 0) {
          const hexLower = clip.chromaKey.color.toLowerCase();
          const isGreen = hexLower.includes('00ff') || hexLower === '#00ff00' || hexLower === '#00b140';
          const despillType = isGreen ? 'green' : 'blue';
          clipFilters.push(`despill=type=${despillType}:mix=${(clip.chromaKey.spill / 100).toFixed(2)}`);
        }
      }

      // F. Professional Color Grading (Phase 6)
      if (clip.colorAdjustments) {
        const resolvedLutPath = options?.lutPathResolver ? options.lutPathResolver(clip.id) : clip.colorAdjustments?.lut?.filePath;
        const cgFilters = buildColorGradingFFmpegFilters(clip.colorAdjustments, resolvedLutPath || undefined);
        if (cgFilters.length > 0) {
          clipFilters.push(...cgFilters);
        }
      }

      // F2. Advanced Masks (Phase 3)
      if (clip.mask && clip.mask.shape !== 'none') {
        const m = clip.mask;
        const mX = m.positionX ?? 0;
        const mY = m.positionY ?? 0;
        const sX = Math.max(0.05, m.scaleX ?? 1);
        const sY = Math.max(0.05, m.scaleY ?? 1);
        const inv = !!m.inverted;

        clipFilters.push('format=yuva420p');
        if (m.shape === 'circle' || m.shape === 'oval') {
          const rx = m.shape === 'circle' ? `(0.35*${sX.toFixed(2)})` : `(0.45*${sX.toFixed(2)})`;
          const ry = m.shape === 'circle' ? `(0.35*${sX.toFixed(2)})` : `(0.25*${sY.toFixed(2)})`;
          const cx = `(W*(0.5+${(mX / 100).toFixed(3)}))`;
          const cy = `(H*(0.5+${(mY / 100).toFixed(3)}))`;
          const cond = `lte(hypot((X-${cx})/(W*${rx}),(Y-${cy})/(H*${ry})),1.0)`;
          const alphaExpr = inv ? `if(${cond},0,255)` : `if(${cond},255,0)`;
          clipFilters.push(`geq=r='r(X,Y)':a='${alphaExpr}'`);
        } else if (m.shape === 'linear') {
          const rotRad = ((m.rotation ?? 0) * Math.PI) / 180;
          const cosR = Math.cos(rotRad).toFixed(3);
          const sinR = Math.sin(rotRad).toFixed(3);
          const cx = `(W*(0.5+${(mX / 100).toFixed(3)}))`;
          const cy = `(H*(0.5+${(mY / 100).toFixed(3)}))`;
          const cond = `lte((X-${cx})*${cosR}+(Y-${cy})*${sinR},0)`;
          const alphaExpr = inv ? `if(${cond},0,255)` : `if(${cond},255,0)`;
          clipFilters.push(`geq=r='r(X,Y)':a='${alphaExpr}'`);
        } else if (m.shape === 'rectangle') {
          const halfW = `(W*0.4*${sX.toFixed(2)})`;
          const halfH = `(H*0.3*${sY.toFixed(2)})`;
          const cx = `(W*(0.5+${(mX / 100).toFixed(3)}))`;
          const cy = `(H*(0.5+${(mY / 100).toFixed(3)}))`;
          const cond = `and(lte(abs(X-${cx}),${halfW}),lte(abs(Y-${cy}),${halfH}))`;
          const alphaExpr = inv ? `if(${cond},0,255)` : `if(${cond},255,0)`;
          clipFilters.push(`geq=r='r(X,Y)':a='${alphaExpr}'`);
        }
      }

      // F3. Video Effects & VFX
      if (clip.effects && clip.effects.length > 0) {
        const vfxFilters = composeEffectsFfmpeg(clip.effects);
        if (vfxFilters.length > 0) {
          clipFilters.push(...vfxFilters);
        }
      }

      // F4. Transitions (Entrance & Visual Cross-fades)
      if (clip.transition && clip.transition.durationMs > 0 && clip.transition.type !== 'cut') {
        const transSec = Math.min(clipDurationSec * 0.5, clip.transition.durationMs / 1000);
        if (transSec > 0.04) {
          const tType = clip.transition.type;
          if (tType === 'fadeBlack') {
            clipFilters.push(`fade=t=in:st=0:d=${transSec.toFixed(3)}:color=black`);
          } else if (tType === 'fadeWhite' || tType === 'flash') {
            clipFilters.push(`fade=t=in:st=0:d=${transSec.toFixed(3)}:color=white`);
          } else if (
            tType === 'crossfade' ||
            tType === 'zoomIn' ||
            tType === 'zoomOut' ||
            tType === 'wipeLeft' ||
            tType === 'wipeRight' ||
            tType === 'wipeUp' ||
            tType === 'wipeDown'
          ) {
            clipFilters.push(`fade=t=in:st=0:d=${transSec.toFixed(3)}:alpha=1`);
          } else if (tType === 'filmBurn') {
            clipFilters.push(
              `colorchannelmixer=rr=1.4:rg=0.2:rb=0.1`,
              `eq=brightness='if(lt(t,${transSec.toFixed(3)}),0.35*(1-t/${transSec.toFixed(3)}),0)'`,
              `fade=t=in:st=0:d=${transSec.toFixed(3)}:alpha=1`
            );
          } else if (tType === 'rotate') {
            clipFilters.push(
              `rotate='if(lt(t,${transSec.toFixed(3)}),2*PI*(1-t/${transSec.toFixed(3)}),0)':ow='rotw(0)':oh='roth(0)':c=none`,
              `fade=t=in:st=0:d=${transSec.toFixed(3)}:alpha=1`
            );
          } else if (tType === 'blur') {
            clipFilters.push(
              `gblur=sigma='if(lt(t,${transSec.toFixed(3)}),12*(1-t/${transSec.toFixed(3)}),0)'`,
              `fade=t=in:st=0:d=${transSec.toFixed(3)}:alpha=1`
            );
          } else if (tType === 'glitch' || tType === 'rgbSplit') {
            clipFilters.push(
              `noise=alls='if(lt(t,${transSec.toFixed(3)}),35*(1-t/${transSec.toFixed(3)}),0)':allf=t+u`,
              `fade=t=in:st=0:d=${transSec.toFixed(3)}:alpha=1`
            );
          }
        }
      }

      // G. Scale & Position Calculation
      const scale = clip.transform.scale || 1.0;
      const targetW = Math.round(preset.width * scale);
      const targetH = Math.round(preset.height * scale);
      clipFilters.push(`scale=w=${targetW}:h=${targetH}:force_original_aspect_ratio=decrease`);

      // G2. Watermark Removal (Phase 4)
      if (clip.watermarkRemover && clip.watermarkRemover.enabled) {
        const wmFilters = buildWatermarkFFmpegFilters(clip.watermarkRemover, targetW, targetH);
        if (wmFilters.length > 0) {
          clipFilters.push(...wmFilters);
        }
      }

      // H. Opacity Alpha Handling
      const opacity = clip.transform.opacity !== undefined ? clip.transform.opacity : 1.0;
      clipFilters.push(`format=yuva420p`);
      if (opacity < 1.0) {
        clipFilters.push(`colorchannelmixer=aa=${opacity.toFixed(2)}`);
      }

      // Register input clip pipeline
      filtergraph.push(`[${initialSourceTag}]${clipFilters.join(',')}[${clipTag}]`);

      // I. Overlay with Position Offset & Directional Slide Transitions
      const basePosX = clip.transform.positionX
        ? `(W-w)/2+W*${(clip.transform.positionX / 100).toFixed(4)}`
        : `(W-w)/2`;
      const basePosY = clip.transform.positionY
        ? `(H-h)/2+H*${(clip.transform.positionY / 100).toFixed(4)}`
        : `(H-h)/2`;

      let posX = basePosX;
      let posY = basePosY;

      if (clip.transition && clip.transition.durationMs > 0) {
        const transSec = Math.min(clipDurationSec * 0.5, clip.transition.durationMs / 1000);
        const tType = clip.transition.type;
        if (transSec > 0.04) {
          if (tType === 'slideLeft') {
            posX = `if(lt(t,${(clipStartSec + transSec).toFixed(3)}), ${basePosX}+W*(1-(t-${clipStartSec.toFixed(3)})/${transSec.toFixed(3)}), ${basePosX})`;
          } else if (tType === 'slideRight') {
            posX = `if(lt(t,${(clipStartSec + transSec).toFixed(3)}), ${basePosX}-W*(1-(t-${clipStartSec.toFixed(3)})/${transSec.toFixed(3)}), ${basePosX})`;
          } else if (tType === 'slideUp') {
            posY = `if(lt(t,${(clipStartSec + transSec).toFixed(3)}), ${basePosY}+H*(1-(t-${clipStartSec.toFixed(3)})/${transSec.toFixed(3)}), ${basePosY})`;
          } else if (tType === 'slideDown') {
            posY = `if(lt(t,${(clipStartSec + transSec).toFixed(3)}), ${basePosY}-H*(1-(t-${clipStartSec.toFixed(3)})/${transSec.toFixed(3)}), ${basePosY})`;
          }
        }
      }

      const overlayEndSec = clipStartSec + clipDurationSec + (underlayerTransSec > 0.04 ? underlayerTransSec : 0);
      filtergraph.push(
        `[${currentCanvasTag}][${clipTag}]overlay=x='${posX}':y='${posY}':enable='between(t,${clipStartSec.toFixed(3)},${overlayEndSec.toFixed(3)})':format=auto[${nextCanvasTag}]`
      );

      currentCanvasTag = nextCanvasTag;
      overlayIndex++;
    }
  }

  // 2B. Burn Subtitles / Captions if requested
  if (options?.subtitleSrtPath) {
    const srtNormalized = escapeFFmpegFilterPath(options.subtitleSrtPath);
    const subtitleCanvasTag = `layer_subtitles`;
    const style = options.captionStyle;
    const baseFontSize = style?.fontSize || 28;
    const scaledFontSize = Math.round(baseFontSize * (preset.height / 1080));
    const alignment = (style?.positionY ?? 35) < -15 ? 5 : (style?.positionY ?? 35) > 15 ? 2 : 8;
    const marginV = Math.abs(Math.round(((style?.positionY ?? 35) / 100) * preset.height));
    const strokeWidth = style?.strokeWidth ?? 2;
    const primaryColor = hexToAssColor(style?.color || '#ffffff');
    const outlineColor = hexToAssColor(style?.strokeColor || '#000000');

    const forceStyle = [
      `Fontname=${style?.fontFamily || 'Arial'}`,
      `FontSize=${scaledFontSize}`,
      `PrimaryColour=${primaryColor}`,
      `OutlineColour=${outlineColor}`,
      `BorderStyle=1`,
      `Outline=${strokeWidth}`,
      `Alignment=${alignment}`,
      `MarginV=${Math.max(20, marginV)}`,
    ].join(',');

    filtergraph.push(
      `[${currentCanvasTag}]subtitles='${srtNormalized}':force_style='${forceStyle}'[${subtitleCanvasTag}]`
    );
    currentCanvasTag = subtitleCanvasTag;
  }

  // 2B. Project-Level Watermark Removal (Phase 4)
  if (project.watermarkRemover && project.watermarkRemover.enabled) {
    const wmFilters = buildWatermarkFFmpegFilters(project.watermarkRemover, preset.width, preset.height);
    if (wmFilters.length > 0) {
      const wmCanvasTag = `wm_canvas`;
      filtergraph.push(`[${currentCanvasTag}]${wmFilters.join(',')}[${wmCanvasTag}]`);
      currentCanvasTag = wmCanvasTag;
    }
  }

  // 3. Audio Processing: Collect and mix all active audio clips

  const audioFilters: string[] = [];
  const audioStreamTags: string[] = [];
  let audioIndex = 0;

  for (const track of project.tracks) {
    if (track.isMuted) continue;
    for (const clip of track.clips) {
      // 1. Clips without audio streams must not be referenced as [inputIdx:a]
      if (clip.type === 'image' || clip.type === 'element' || clip.type === 'text') {
        continue;
      }

      const resolvedPath = (clip.assetId ? assetPathResolver(clip.assetId) : null) || assetPathResolver(clip.id);
      if (!resolvedPath || !fileToInputIndex.has(resolvedPath)) continue;

      // 2. Check if asset metadata or extension confirms lack of audio stream
      const asset = project.assets.find((a) => a.id === clip.assetId || a.id === clip.id);
      if (asset) {
        if (asset.type === 'image') continue;
        if (asset.hasAudio === false) continue;
      }
      const lower = resolvedPath.toLowerCase();
      if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|tiff?)$/.test(lower)) {
        continue;
      }

      // 3. Check custom hasAudioResolver predicate if provided
      if (options?.hasAudioResolver && !options.hasAudioResolver(clip, resolvedPath)) {
        continue;
      }

      // Only include if clip has audible volume
      const volume = clip.volume !== undefined ? clip.volume : 1.0;
      if (volume <= 0) continue;

      // Phase 3: Check mute audio on speed
      if (clip.muteAudioOnSpeed && ((clip.speedCurve && clip.speedCurve.length >= 2) || (clip.speed > 0 && Math.abs(clip.speed - 1.0) > 0.01))) {
        continue;
      }

      const inputIdx = fileToInputIndex.get(resolvedPath)!;
      const clipStartMs = Math.round(clip.startMs);
      const clipDurationSec = clip.durationMs / 1000;
      const sourceInSec = clip.sourceStartMs / 1000;
      const aTag = `audio_${audioIndex}`;

      const streamFilters: string[] = [
        `atrim=start=${sourceInSec}:duration=${clipDurationSec}`,
        `asetpts=PTS-STARTPTS`,
      ];

      // Phase 3: Speed adjustment on audio (atempo with pitch correction or natural pitch shift)
      const hasCurve = clip.speedCurve && clip.speedCurve.length >= 2;
      const effectiveSpeed = hasCurve ? calculateSpeedCurveAverage(clip.speedCurve) : clip.speed;

      if (effectiveSpeed > 0 && Math.abs(effectiveSpeed - 1.0) > 0.01) {
        if (clip.pitchCorrection !== false) {
          let tempo = Math.max(0.1, Math.min(8.0, effectiveSpeed));
          while (tempo > 2.0) {
            streamFilters.push(`atempo=2.0`);
            tempo /= 2.0;
          }
          while (tempo < 0.5) {
            streamFilters.push(`atempo=0.5`);
            tempo /= 0.5;
          }
          streamFilters.push(`atempo=${tempo.toFixed(3)}`);
        } else {
          const sampleRate = Math.round(48000 * effectiveSpeed);
          streamFilters.push(`asetrate=${sampleRate}`, `aresample=48000`);
        }
      }

      // Volume
      streamFilters.push(`volume=${volume.toFixed(2)}`);

      // Professional Audio Processing (Phase 6: Equalizer, Noise Reduction, Normalization, Limiter)
      if (clip.audioProcessing) {
        const apFilters = buildClipAudioFFmpegFilters(clip.audioProcessing);
        if (apFilters.length > 0) {
          streamFilters.push(...apFilters);
        }
      }

      // Audio Ducking (Auto-attenuates background music during dialogue)
      const duckFilter = buildAudioDuckingFilter(clip, project);
      if (duckFilter) {
        streamFilters.push(duckFilter);
      }

      // Fade-In & Fade-Out
      if (clip.fadeInMs > 0) {
        const inSec = (clip.fadeInMs / 1000).toFixed(2);
        streamFilters.push(`afade=t=in:ss=0:d=${inSec}`);
      }
      if (clip.fadeOutMs > 0) {
        const outSec = (clip.fadeOutMs / 1000).toFixed(2);
        const outStartSec = Math.max(0, clipDurationSec - clip.fadeOutMs / 1000).toFixed(2);
        streamFilters.push(`afade=t=out:st=${outStartSec}:d=${outSec}`);
      }

      // Delay to align with timeline start position
      streamFilters.push(`adelay=${clipStartMs}|${clipStartMs}`);

      audioFilters.push(`[${inputIdx}:a]${streamFilters.join(',')}[${aTag}]`);
      audioStreamTags.push(`[${aTag}]`);
      audioIndex++;
    }
  }

  let finalAudioTag = '';
  if (audioStreamTags.length > 0) {
    filtergraph.push(...audioFilters);
    if (audioStreamTags.length === 1) {
      filtergraph.push(`${audioStreamTags[0]}atrim=duration=${totalDurationSec}[a_final]`);
      finalAudioTag = '[a_final]';
    } else {
      filtergraph.push(
        `${audioStreamTags.join('')}amix=inputs=${audioStreamTags.length}:duration=longest:dropout_transition=2,atrim=duration=${totalDurationSec}[a_mixed]`
      );
      finalAudioTag = '[a_mixed]';
    }
  } else {
    // Generate compliant silent audio track directly within filter_complex
    filtergraph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${totalDurationSec}[a_silent]`);
    finalAudioTag = '[a_silent]';
  }

  // Connect filtergraph
  args.push('-filter_complex', filtergraph.join(';'));
  args.push('-map', `[${currentCanvasTag}]`);
  args.push('-map', finalAudioTag);

  const profPreset = preset as ProfessionalExportPreset;
  const audioCodec = profPreset.audioCodec || 'aac';

  if (audioCodec === 'pcm_s16le') {
    args.push('-c:a', 'pcm_s16le');
  } else if (audioCodec === 'libmp3lame') {
    args.push('-c:a', 'libmp3lame', '-b:a', preset.audioBitrate || '192k');
  } else {
    args.push('-c:a', 'aac', '-b:a', preset.audioBitrate || '192k');
  }

  // Video encoding flags
  const effectiveCodec = options?.encoderOverride || preset.codec || 'libx264';
  if (effectiveCodec === 'prores_ks' || effectiveCodec === 'prores') {
    args.push('-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le');
  } else if (effectiveCodec === 'libvpx-vp9') {
    args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
  } else if (effectiveCodec === 'libx265') {
    args.push('-c:v', 'libx265', '-preset', 'medium', '-pix_fmt', 'yuv420p');
  } else if (
    effectiveCodec.includes('nvenc') ||
    effectiveCodec.includes('qsv') ||
    effectiveCodec.includes('amf')
  ) {
    args.push('-c:v', effectiveCodec, '-pix_fmt', 'yuv420p');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p');
  }

  // Video Rate Control (CRF vs Bitrate)
  if (profPreset.rateControl === 'crf' && profPreset.crf !== undefined) {
    args.push('-crf', String(profPreset.crf));
  } else {
    args.push('-b:v', preset.videoBitrate);
  }

  // Optimize MP4/MOV files for web streaming playback
  if (outputPath.toLowerCase().endsWith('.mp4') || outputPath.toLowerCase().endsWith('.mov')) {
    args.push('-movflags', '+faststart');
  }

  args.push('-r', String(preset.fps), outputPath);

  return { args, inputFiles };
}

/**
 * Parses FFmpeg stderr line to extract progress percentage
 */
export function parseFFmpegProgress(stderrLine: string, totalDurationMs: number): number | null {
  // Pattern: time=00:01:23.45
  const timeMatch = stderrLine.match(/time=(\d+):(\d+):(\d+\.\d+)/);
  if (timeMatch && totalDurationMs > 0) {
    const hours = parseInt(timeMatch[1], 10);
    const mins = parseInt(timeMatch[2], 10);
    const secs = parseFloat(timeMatch[3]);
    const currentMs = (hours * 3600 + mins * 60 + secs) * 1000;
    const progress = Math.min(100, Math.max(0, (currentMs / totalDurationMs) * 100));
    return Math.round(progress * 10) / 10;
  }
  return null;
}
