/**
 * HL Video Editor — Professional Audio Processing Editor
 * Controls for 3-Band Equalizer, Noise Reduction, Audio Normalization, Ducking, and Anti-Clipping Limiter.
 */

import React from 'react';
import { Sliders, Volume2, Shield, Wand2, Mic, Sparkles } from 'lucide-react';
import { AudioProcessingSettings, AudioEqualizer, CleanVoicePreset } from '../../types/project';
import { EQUALIZER_PRESETS, CLEAN_VOICE_PRESETS, getDefaultAudioProcessing } from '../../core/audioProcessing';

interface AudioProcessingEditorProps {
  settings?: AudioProcessingSettings;
  onChange: (updated: AudioProcessingSettings) => void;
  isBackgroundMusic?: boolean;
}

export const AudioProcessingEditor: React.FC<AudioProcessingEditorProps> = ({
  settings,
  onChange,
  isBackgroundMusic = false,
}) => {
  const current = settings || getDefaultAudioProcessing();

  const update = (partial: Partial<AudioProcessingSettings>) => {
    onChange({ ...current, ...partial });
  };

  const eq = current.equalizer || {
    enabled: false,
    lowGainDb: 0,
    midGainDb: 0,
    highGainDb: 0,
    preset: 'flat',
  };

  const handleEqPreset = (presetId: string) => {
    const p = EQUALIZER_PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    update({
      equalizer: {
        enabled: true,
        preset: p.id,
        lowGainDb: p.lowGainDb,
        midGainDb: p.midGainDb,
        highGainDb: p.highGainDb,
      },
    });
  };

  const handleEqBand = (band: 'lowGainDb' | 'midGainDb' | 'highGainDb', val: number) => {
    update({
      equalizer: {
        ...eq,
        enabled: true,
        preset: 'custom',
        [band]: val,
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
      {/* 0. Clean Voice (Phase 9A: One-Click Conventional DSP) */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-1)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={current.cleanVoice?.enabled ?? false}
              onChange={(e) =>
                update({
                  cleanVoice: {
                    enabled: e.target.checked,
                    preset: current.cleanVoice?.preset ?? 'standard',
                    bypassed: current.cleanVoice?.bypassed ?? false,
                    removeRumble: current.cleanVoice?.removeRumble ?? true,
                    noiseGate: current.cleanVoice?.noiseGate ?? true,
                    vocalClarity: current.cleanVoice?.vocalClarity ?? true,
                  },
                })
              }
            />
            <Sparkles size={12} style={{ color: 'var(--accent-sage)' }} />
            <span>Clean Voice</span>
            <span
              style={{
                fontSize: 8,
                padding: '1px 4px',
                borderRadius: 3,
                backgroundColor: 'rgba(124, 154, 130, 0.15)',
                color: 'var(--accent-sage)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              DSP Filter
            </span>
          </label>

          {current.cleanVoice?.enabled && (
            <button
              onClick={() =>
                update({
                  cleanVoice: {
                    ...current.cleanVoice!,
                    bypassed: !current.cleanVoice!.bypassed,
                  },
                })
              }
              className="vnest-btn-subtle"
              style={{
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 600,
                color: current.cleanVoice.bypassed ? 'var(--text-muted)' : 'var(--accent-sage)',
                borderColor: current.cleanVoice.bypassed ? 'var(--border-subtle)' : 'var(--accent-sage)',
                backgroundColor: current.cleanVoice.bypassed ? 'transparent' : 'rgba(124, 154, 130, 0.12)',
              }}
              title={
                current.cleanVoice.bypassed
                  ? 'A/B Audition: Currently listening to BEFORE (Raw original audio). Click to audition AFTER (Clean Voice).'
                  : 'A/B Audition: Currently listening to AFTER (Clean Voice active). Click to audition BEFORE (Raw original audio).'
              }
            >
              {current.cleanVoice.bypassed ? 'Before (Raw)' : 'After (Clean)'}
            </button>
          )}
        </div>

        {current.cleanVoice?.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {/* Preset selector pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {(['light', 'standard', 'strong'] as CleanVoicePreset[]).map((pKey) => {
                const def = CLEAN_VOICE_PRESETS[pKey];
                const active = (current.cleanVoice?.preset ?? 'standard') === pKey;
                return (
                  <button
                    key={pKey}
                    onClick={() =>
                      update({
                        cleanVoice: {
                          ...current.cleanVoice!,
                          preset: pKey,
                        },
                      })
                    }
                    className="vnest-btn-subtle"
                    style={{
                      padding: '4px',
                      fontSize: 9,
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? 'var(--selected-surface)' : 'transparent',
                      borderColor: active ? 'var(--accent-sage)' : 'var(--border-subtle)',
                      color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      fontWeight: active ? 700 : 400,
                    }}
                    title={def.description}
                  >
                    <span>{def.name}</span>
                  </button>
                );
              })}
            </div>

            <p style={{ margin: 0, fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {CLEAN_VOICE_PRESETS[current.cleanVoice.preset ?? 'standard'].description}
            </p>

            {/* Fine-tuning toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2, fontSize: 9 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={current.cleanVoice.removeRumble ?? true}
                  onChange={(e) =>
                    update({
                      cleanVoice: { ...current.cleanVoice!, removeRumble: e.target.checked },
                    })
                  }
                />
                <span>De-Rumble (Highpass)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={current.cleanVoice.noiseGate ?? true}
                  onChange={(e) =>
                    update({
                      cleanVoice: { ...current.cleanVoice!, noiseGate: e.target.checked },
                    })
                  }
                />
                <span>Speech Gate</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={current.cleanVoice.vocalClarity ?? true}
                  onChange={(e) =>
                    update({
                      cleanVoice: { ...current.cleanVoice!, vocalClarity: e.target.checked },
                    })
                  }
                />
                <span>Vocal Clarity EQ</span>
              </label>
            </div>

            {/* Architecture note (Phase 9B Requirement 5) */}
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)', lineHeight: 1.25, borderTop: '1px solid var(--border-subtle)', paddingTop: 4, marginTop: 2 }}>
              Timeline preview uses zero-latency Web Audio DSP for A/B auditioning. Export renders with full 2048-pt FFT spectral denoiser (afftdn).
            </div>
          </div>
        )}
      </div>

      {/* 1. 3-Band Equalizer */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-1)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={eq.enabled}
              onChange={(e) =>
                update({
                  equalizer: { ...eq, enabled: e.target.checked },
                })
              }
            />
            <Sliders size={12} style={{ color: 'var(--accent-sage)' }} />
            <span>3-Band Equalizer</span>
          </label>

          {eq.enabled && (
            <button
              onClick={() => handleEqPreset('flat')}
              className="vnest-btn-subtle"
              style={{ padding: '2px 6px', fontSize: 9 }}
              title="Reset EQ to flat"
            >
              Reset
            </button>
          )}
        </div>

        {eq.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {/* Presets */}
            <div>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                EQ Presets
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {EQUALIZER_PRESETS.map((p) => {
                  const active = eq.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleEqPreset(p.id)}
                      className="vnest-btn-subtle"
                      style={{
                        padding: '3px 4px',
                        fontSize: 9,
                        justifyContent: 'center',
                        backgroundColor: active ? 'var(--selected-surface)' : 'transparent',
                        borderColor: active ? 'var(--accent-sage)' : 'var(--border-subtle)',
                        color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
                        fontWeight: active ? 700 : 400,
                      }}
                      title={p.description}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders: Low, Mid, High */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)' }}>
                  <span>Low 100Hz</span>
                  <span style={{ fontWeight: 600 }}>{eq.lowGainDb > 0 ? `+${eq.lowGainDb}` : eq.lowGainDb}dB</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.lowGainDb}
                  onChange={(e) => handleEqBand('lowGainDb', parseFloat(e.target.value))}
                  style={{ width: '100%', height: 4 }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)' }}>
                  <span>Mid 1kHz</span>
                  <span style={{ fontWeight: 600 }}>{eq.midGainDb > 0 ? `+${eq.midGainDb}` : eq.midGainDb}dB</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.midGainDb}
                  onChange={(e) => handleEqBand('midGainDb', parseFloat(e.target.value))}
                  style={{ width: '100%', height: 4 }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)' }}>
                  <span>High 10kHz</span>
                  <span style={{ fontWeight: 600 }}>{eq.highGainDb > 0 ? `+${eq.highGainDb}` : eq.highGainDb}dB</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.highGainDb}
                  onChange={(e) => handleEqBand('highGainDb', parseFloat(e.target.value))}
                  style={{ width: '100%', height: 4 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Noise Reduction */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-1)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={current.noiseReduction?.enabled ?? false}
              onChange={(e) =>
                update({
                  noiseReduction: {
                    enabled: e.target.checked,
                    amount: current.noiseReduction?.amount ?? 40,
                  },
                })
              }
            />
            <Wand2 size={12} style={{ color: 'var(--accent-sage)' }} />
            <span>Noise Reduction</span>
          </label>
          {current.noiseReduction?.enabled && (
            <span style={{ fontSize: 9, color: 'var(--accent-sage)', fontWeight: 600 }}>
              {current.noiseReduction.amount}%
            </span>
          )}
        </div>

        {current.noiseReduction?.enabled && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>
              <span>Denoise Intensity</span>
              <span>Spectral FFT</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={current.noiseReduction.amount}
              onChange={(e) =>
                update({
                  noiseReduction: {
                    enabled: true,
                    amount: parseInt(e.target.value, 10),
                  },
                })
              }
              style={{ width: '100%', height: 4 }}
              title="Reduces background hiss, hum, and ambient fan noise via FFT filter"
            />
          </div>
        )}
      </div>

      {/* 3. Audio Normalization */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-1)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={current.normalization?.enabled ?? false}
              onChange={(e) =>
                update({
                  normalization: {
                    enabled: e.target.checked,
                    target: current.normalization?.target ?? 'streaming',
                  },
                })
              }
            />
            <Volume2 size={12} style={{ color: 'var(--accent-sage)' }} />
            <span>Loudness Normalization</span>
          </label>
        </div>

        {current.normalization?.enabled && (
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
              Target Loudness Standard
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {[
                { id: 'streaming', label: 'Streaming', desc: '-14 LUFS (YouTube/Spotify)' },
                { id: 'broadcast', label: 'Broadcast', desc: '-23 LUFS (EBU R128)' },
                { id: 'peak', label: 'Peak Norm', desc: '-1 dBFS Dynamic' },
              ].map((std) => {
                const active = (current.normalization?.target ?? 'streaming') === std.id;
                return (
                  <button
                    key={std.id}
                    onClick={() =>
                      update({
                        normalization: {
                          enabled: true,
                          target: std.id as any,
                        },
                      })
                    }
                    className="vnest-btn-subtle"
                    style={{
                      padding: '3px 4px',
                      fontSize: 9,
                      justifyContent: 'center',
                      backgroundColor: active ? 'var(--selected-surface)' : 'transparent',
                      borderColor: active ? 'var(--accent-sage)' : 'var(--border-subtle)',
                      color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      fontWeight: active ? 700 : 400,
                    }}
                    title={std.desc}
                  >
                    {std.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Audio Ducking (Auto-duck music under dialogue) */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-1)',
          padding: 8,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={current.ducking?.enabled ?? false}
              onChange={(e) =>
                update({
                  ducking: {
                    enabled: e.target.checked,
                    duckAmountDb: current.ducking?.duckAmountDb ?? -12,
                    thresholdDb: -24,
                  },
                })
              }
            />
            <Mic size={12} style={{ color: 'var(--accent-sage)' }} />
            <span>Audio Ducking</span>
          </label>
          {current.ducking?.enabled && (
            <span style={{ fontSize: 9, color: 'var(--accent-sage)', fontWeight: 600 }}>
              {current.ducking.duckAmountDb} dB
            </span>
          )}
        </div>

        {current.ducking?.enabled && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>
              <span>Reduction Level</span>
              <span style={{ color: 'var(--text-muted)' }}>Lowers volume under voice</span>
            </div>
            <input
              type="range"
              min="-24"
              max="-3"
              step="1"
              value={current.ducking.duckAmountDb}
              onChange={(e) =>
                update({
                  ducking: {
                    enabled: true,
                    duckAmountDb: parseInt(e.target.value, 10),
                    thresholdDb: -24,
                  },
                })
              }
              style={{ width: '100%', height: 4 }}
              title="Reduces background audio during dialogue clips"
            />
          </div>
        )}
      </div>

      {/* 5. Master Gain & Soft Limiter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={current.limiter ?? true}
            onChange={(e) => update({ limiter: e.target.checked })}
          />
          <Shield size={11} style={{ color: 'var(--accent-sage)' }} />
          <span>Anti-Clipping Soft Limiter</span>
        </label>
      </div>
    </div>
  );
};
