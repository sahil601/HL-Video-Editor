import React, { useRef, useEffect } from 'react';
import { Clip } from '../../types/project';
import {
  attachOrUpdateAudioPipeline,
  detachAudioPipeline,
  resumeAudioContext,
} from '../../core/audioPreviewGraph';

interface ChromaKeyVideoProps {
  src: string;
  clip: Clip;
  isPlaying: boolean;
  targetTimeSec: number;
  volume: number;
  isMuted: boolean;
  style?: React.CSSProperties;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export const ChromaKeyVideo: React.FC<ChromaKeyVideoProps> = ({
  src,
  clip,
  isPlaying,
  targetTimeSec,
  volume,
  isMuted,
  style,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const chroma = clip.chromaKey;
  const isChromaEnabled = !!chroma?.enabled;

  // Synchronize Web Audio DSP pipeline on settings or volume changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const pipeline = attachOrUpdateAudioPipeline(
      video,
      clip.audioProcessing,
      volume,
      isMuted
    );

    // If Web Audio pipeline is active, masterGain handles volume scaling;
    // otherwise fallback to native HTMLMediaElement volume control.
    if (!pipeline) {
      video.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    } else {
      video.volume = 1.0;
    }
  }, [clip.audioProcessing, volume, isMuted]);

  // Teardown Web Audio pipeline on unmount
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        detachAudioPipeline(video);
      }
    };
  }, []);

  // Sync playback time & audio volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (clip.isFrozen && clip.freezeFrameSourceMs !== undefined) {
      video.currentTime = clip.freezeFrameSourceMs / 1000;
      if (!video.paused) video.pause();
    } else {
      if (Math.abs(video.currentTime - targetTimeSec) > 0.15) {
        video.currentTime = targetTimeSec;
      }
      if (isPlaying) {
        resumeAudioContext();
        if (video.paused) {
          video.play().catch(() => {});
        }
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [isPlaying, targetTimeSec, clip.isFrozen, clip.freezeFrameSourceMs]);

  // Real-time canvas processing loop for chroma key
  useEffect(() => {
    if (!isChromaEnabled) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const [keyR, keyG, keyB] = hexToRgb(chroma?.color || '#00FF00');
    const similarity = chroma?.similarity ?? 0.35;
    const smoothness = chroma?.smoothness ?? 0.10;
    const maxDist = 441.67; // Math.sqrt(255^2 + 255^2 + 255^2)

    const processFrame = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Downsample slightly for preview performance if large video
        const scale = Math.min(1, 640 / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        ctx.drawImage(video, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const total = data.length;

        for (let i = 0; i < total; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const dr = r - keyR;
          const dg = g - keyG;
          const db = b - keyB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db) / maxDist;

          if (dist < similarity) {
            data[i + 3] = 0; // Transparent
          } else if (dist < similarity + smoothness && smoothness > 0) {
            const factor = (dist - similarity) / smoothness;
            data[i + 3] = Math.round(data[i + 3] * factor);
          }

          // Spill suppression / despill: neutralize green or blue fringe on edges and subject
          const spill = chroma?.spill ?? 0.2;
          if (data[i + 3] > 0 && spill > 0) {
            if (keyG > keyR && keyG > keyB) {
              // Green screen despill: clamp excess green to average of red and blue
              const avgRB = (r + b) / 2;
              if (g > avgRB) {
                data[i + 1] = Math.round(g * (1 - spill) + avgRB * spill);
              }
            } else if (keyB > keyR && keyB > keyG) {
              // Blue screen despill: clamp excess blue to average of red and green
              const avgRG = (r + g) / 2;
              if (b > avgRG) {
                data[i + 2] = Math.round(b * (1 - spill) + avgRG * spill);
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
      }

      animRef.current = requestAnimationFrame(processFrame);
    };

    animRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isChromaEnabled, chroma?.color, chroma?.similarity, chroma?.smoothness, chroma?.spill]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={isMuted}
        style={
          isChromaEnabled
            ? { display: 'none' }
            : { width: '100%', height: '100%', objectFit: 'contain', ...style }
        }
      />
      {isChromaEnabled && (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
        />
      )}
    </>
  );
};
