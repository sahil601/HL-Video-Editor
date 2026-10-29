import React, { useRef, useEffect } from 'react';
import { Clip } from '../../types/project';
import {
  attachOrUpdateAudioPipeline,
  detachAudioPipeline,
  resumeAudioContext,
} from '../../core/audioPreviewGraph';

interface AudioClipPlayerProps {
  src: string;
  clip: Clip;
  isPlaying: boolean;
  targetTimeSec: number;
  volume: number;
  isMuted: boolean;
}

export const AudioClipPlayer: React.FC<AudioClipPlayerProps> = ({
  src,
  clip,
  isPlaying,
  targetTimeSec,
  volume,
  isMuted,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize Web Audio DSP pipeline on settings or volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const pipeline = attachOrUpdateAudioPipeline(
      audio,
      clip.audioProcessing,
      volume,
      isMuted
    );

    // If Web Audio pipeline is active, masterGain handles volume scaling;
    // otherwise fallback to native HTMLMediaElement volume control.
    if (!pipeline) {
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    } else {
      audio.volume = 1.0;
    }
  }, [clip.audioProcessing, volume, isMuted]);

  // Teardown Web Audio pipeline on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        detachAudioPipeline(audio);
      }
    };
  }, []);

  // Playback transport, retiming, and drift sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Retiming & Speed
    const targetRate = Math.max(0.25, Math.min(4.0, clip.speed || 1.0));
    if (Math.abs(audio.playbackRate - targetRate) > 0.01) {
      audio.playbackRate = targetRate;
    }

    // Drift / seeking synchronization
    if (Math.abs(audio.currentTime - targetTimeSec) > 0.15) {
      audio.currentTime = Math.max(0, targetTimeSec);
    }

    // Play / Pause state synchronization
    if (isPlaying) {
      resumeAudioContext();
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, targetTimeSec, clip.speed]);

  return (
    <audio
      ref={audioRef}
      src={src}
      preload="auto"
      crossOrigin="anonymous"
      style={{ display: 'none' }}
    />
  );
};
