import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Volume2,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react';
import { extractWaveformPeaksFromBlob } from '../../core/waveform';

interface VoiceOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTimeMs: number;
  fps?: number;
  onSaveVoiceOver: (blob: Blob, filename: string, durationMs: number, peaks: number[]) => void;
}

export const VoiceOverModal: React.FC<VoiceOverModalProps> = ({
  isOpen,
  onClose,
  currentTimeMs,
  fps = 30,
  onSaveVoiceOver,
}) => {
  const [step, setStep] = useState<'ready' | 'recording' | 'preview'>('ready');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Audio stream and analysis
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [micLevel, setMicLevel] = useState<number>(0);

  // Recorder state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPeaks, setRecordedPeaks] = useState<number[]>([]);
  const [recordDurationMs, setRecordDurationMs] = useState<number>(0);
  const recordStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Preview playback
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [takeName, setTakeName] = useState<string>(() => `Voiceover_${Date.now().toString().slice(-4)}`);

  // Initialize Mic Stream and Device List
  const initMicrophone = async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      setPermissionError(null);
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      // Enumerate available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setAudioDevices(mics);
      if (!selectedDeviceId && mics.length > 0) {
        setSelectedDeviceId(mics[0].deviceId);
      }

      // Setup Web Audio Analyser for live visual VU meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err: any) {
      console.warn('Microphone access failed:', err);
      setHasPermission(false);
      setPermissionError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access was denied. Please allow microphone permissions in Windows or your browser settings.'
          : err.message || 'Could not connect to microphone.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      initMicrophone();
      setTakeName(`Voiceover_${Date.now().toString().slice(-4)}`);
      setStep('ready');
      setRecordedBlob(null);
      setRecordDurationMs(0);
    } else {
      cleanup();
    }
    return cleanup;
  }, [isOpen]);

  const cleanup = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  // Start Recording
  const handleStartRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    }

    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setRecordedBlob(blob);
      const peaks = await extractWaveformPeaksFromBlob(blob);
      setRecordedPeaks(peaks);
      setStep('preview');
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    recordStartTimeRef.current = performance.now();
    setStep('recording');

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.round(performance.now() - recordStartTimeRef.current);
      setRecordDurationMs(elapsed);
    }, 50);
  };

  // Stop Recording
  const handleStopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Toggle Preview Playback
  const handleTogglePreviewPlay = () => {
    if (!recordedBlob) return;
    if (previewAudioRef.current) {
      if (isPlaying(previewAudioRef.current)) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
        return;
      }
    }
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.onended = () => {
      setIsPreviewPlaying(false);
      URL.revokeObjectURL(url);
    };
    audio.play();
    setIsPreviewPlaying(true);
  };

  const isPlaying = (a: HTMLAudioElement) => !a.paused && !a.ended && a.readyState > 2;

  // Save voice-over take to project
  const handleConfirmSave = () => {
    if (!recordedBlob) return;
    const cleanName = takeName.trim() ? takeName.trim() : `Voiceover_${Date.now()}`;
    const filename = `${cleanName}.webm`;
    onSaveVoiceOver(recordedBlob, filename, Math.max(500, recordDurationMs), recordedPeaks);
    onClose();
  };

  if (!isOpen) return null;

  const formatTimer = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const ms100 = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms100).padStart(2, '0')}`;
  };

  return (
    <div className="vnest-modal-backdrop">
      <div
        className="vnest-modal-content"
        style={{
          width: '460px',
          maxWidth: '92vw',
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
              }}
            >
              <Mic size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Record Voice-Over</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Timeline Insertion: {(currentTimeMs / 1000).toFixed(2)}s
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="vnest-btn-icon"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Permission Error State */}
        {hasPermission === false && (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', margin: '0 0 4px' }}>
                  Microphone Not Available
                </h5>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {permissionError}
                </p>
                <button
                  onClick={() => initMicrophone()}
                  className="vnest-btn-subtle"
                  style={{ fontSize: 11, padding: '4px 10px', color: '#fca5a5' }}
                >
                  <RotateCcw size={12} /> Retry Permission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Device Selector */}
        {hasPermission && step === 'ready' && audioDevices.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Audio Input Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                initMicrophone(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 11,
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                color: '#ffffff',
              }}
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Audio Meter & Visualizer */}
        {hasPermission && step !== 'preview' && (
          <div
            style={{
              padding: 16,
              background: 'var(--bg-surface-2)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {/* Timer Display */}
            <div style={{ marginBottom: 12 }}>
              <div
                className="font-mono-time"
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: step === 'recording' ? '#f87171' : '#ffffff',
                  letterSpacing: '1px',
                }}
              >
                {formatTimer(recordDurationMs)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {step === 'recording' ? (
                  <>
                    <Radio size={12} color="#f87171" className="animate-pulse" />
                    <span style={{ color: '#f87171', fontWeight: 600 }}>RECORDING LIVE</span>
                  </>
                ) : (
                  <span>Ready to record microphone take</span>
                )}
              </div>
            </div>

            {/* Volume VU Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 320, margin: '0 auto' }}>
              <Volume2 size={14} color="var(--text-muted)" />
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: 'var(--bg-surface-3)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${micLevel}%`,
                    background:
                      micLevel > 80
                        ? 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)'
                        : micLevel > 50
                        ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                        : '#10b981',
                    borderRadius: 3,
                    transition: 'width 60ms ease-out',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>
                {micLevel}%
              </span>
            </div>
          </div>
        )}

        {/* Step: Preview Recorded Take */}
        {step === 'preview' && recordedBlob && (
          <div
            style={{
              padding: 16,
              background: 'var(--bg-surface-2)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Recorded Take Preview</span>
              <span className="font-mono-time" style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
                Duration: {(recordDurationMs / 1000).toFixed(2)}s
              </span>
            </div>

            {/* Take Name Input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                Take Name
              </label>
              <input
                type="text"
                value={takeName}
                onChange={(e) => setTakeName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: '#ffffff',
                }}
              />
            </div>

            {/* Playback Audition Button */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleTogglePreviewPlay}
                className="vnest-btn-subtle"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                }}
              >
                {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPreviewPlaying ? 'Pause Take' : 'Play Take'}</span>
              </button>

              <button
                onClick={() => {
                  setStep('ready');
                  setRecordedBlob(null);
                  setRecordDurationMs(0);
                }}
                className="vnest-btn-subtle"
                style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}
                title="Discard and record new take"
              >
                <RotateCcw size={14} /> Re-record
              </button>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            className="vnest-btn-subtle"
            style={{ padding: '7px 14px', fontSize: 12 }}
          >
            Cancel
          </button>

          {step === 'ready' && (
            <button
              disabled={hasPermission !== true}
              onClick={handleStartRecording}
              className="vnest-btn-primary"
              style={{
                padding: '7px 16px',
                fontSize: 12,
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }} />
              Start Recording
            </button>
          )}

          {step === 'recording' && (
            <button
              onClick={handleStopRecording}
              className="vnest-btn-primary"
              style={{
                padding: '7px 18px',
                fontSize: 12,
                backgroundColor: '#ef4444',
                borderColor: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Square size={14} fill="#ffffff" />
              Stop Recording
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleConfirmSave}
              className="vnest-btn-primary"
              style={{
                padding: '7px 18px',
                fontSize: 12,
                backgroundColor: 'var(--accent-sage)',
                borderColor: 'var(--accent-sage)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={14} />
              Add to Timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
