export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  aspectRatio: AspectRatio;
  sampleRate: number;
  backgroundColor: string;
}

export type AssetType = 'video' | 'audio' | 'image';

export type ProxyQuality = '360p' | '540p' | '720p';
export type ProxyStatus = 'none' | 'generating' | 'ready' | 'error';

export interface ProxySettings {
  enabled: boolean;
  quality: ProxyQuality;
  autoGenerateOnImport?: boolean;
  useForExport?: boolean;
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: AssetType;
  relativePath: string;
  originalPath: string;
  fileSize: number;
  durationMs: number;
  width?: number;
  height?: number;
  fps?: number;
  sha256?: string;
  isBundled: boolean;
  isMissing?: boolean;
  thumbnailUrl?: string;
  blobUrl?: string;
  waveformPeaks?: number[];
  isFavorite?: boolean;
  importedAt?: number;
  proxyPath?: string;
  proxyStatus?: ProxyStatus;
  proxyProgress?: number;
  proxyError?: string;
  proxyQuality?: ProxyQuality;
  proxyFileSize?: number;
  hasAudio?: boolean;
}

export type TrackType = 'video' | 'overlay' | 'audio' | 'text';

export type ClipType = 'video' | 'overlay' | 'audio' | 'image' | 'text' | 'element';

export type ElementCategory = 'shape' | 'arrow' | 'frame' | 'bubble';

export type ElementShapeType =
  | 'rectangle'
  | 'circle'
  | 'star'
  | 'triangle'
  | 'arrow_right'
  | 'arrow_curved'
  | 'frame_cinema'
  | 'frame_border'
  | 'bubble_speech'
  | 'bubble_thought';

export interface ElementProperties {
  elementType: ElementShapeType;
  category: ElementCategory;
  color: string;           // primary fill/stroke color
  secondaryColor?: string; // outline or accent color
  strokeWidth?: number;
  cornerRadius?: number;
  aspectRatio?: number;
  text?: string;           // optional text (e.g. inside speech bubble)
  opacity?: number;
}

export type PipLayoutPreset =
  | 'pip_top_right'
  | 'pip_top_left'
  | 'pip_bottom_right'
  | 'pip_bottom_left'
  | 'split_left_50'
  | 'split_right_50'
  | 'split_top_50'
  | 'split_bottom_50'
  | 'split_four_quadrants'
  | 'reset_fullscreen';

export interface SpeedCurvePoint {
  x: number; // 0.0 to 1.0 (normalized time)
  y: number; // 0.1 to 8.0 (speed multiplier)
}

export type MaskShape = 'none' | 'rectangle' | 'circle' | 'oval' | 'linear';

export interface ClipMask {
  shape: MaskShape;
  positionX: number; // percentage offset -100% to 100%
  positionY: number; // percentage offset -100% to 100%
  scaleX: number;    // percentage 10% to 200%
  scaleY: number;    // percentage 10% to 200%
  feather: number;   // feathering 0 to 50 px / %
  inverted: boolean;
  rotation?: number; // 0 to 360 degrees
}

export interface ClipCrop {
  top: number;    // percentage 0 to 50
  bottom: number; // percentage 0 to 50
  left: number;   // percentage 0 to 50
  right: number;  // percentage 0 to 50
}

export interface ClipTransform {
  positionX: number; // percentage offset -100% to 100%
  positionY: number; // percentage offset -100% to 100%
  scale: number;     // 0.1 to 5.0 (default 1.0)
  rotation: number;  // -360 to 360 degrees
  opacity: number;   // 0.0 to 1.0
  flipH?: boolean;
  flipV?: boolean;
  crop?: ClipCrop;
  blendMode?: BlendMode;
  mask?: ClipMask;
}

export type KeyframeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier';

export interface BezierControlPoints {
  cp1x: number; // 0.0 to 1.0 (normalized time)
  cp1y: number; // normalized value offset
  cp2x: number; // 0.0 to 1.0 (normalized time)
  cp2y: number; // normalized value offset
}

export interface Keyframe {
  id: string;
  offsetMs: number;
  properties: Partial<ClipTransform & {
    volume?: number;
    exposure?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
  }>;
  easing: KeyframeEasing;
  bezierHandles?: BezierControlPoints;
}


export interface TextWordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TextProperties {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  backgroundPadding?: number;
  borderRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  textAlign: 'left' | 'center' | 'right';
  shadowColor?: string;
  shadowBlur?: number;    // 0 to 40 px
  shadowOffsetX?: number; // -30 to 30 px
  shadowOffsetY?: number; // -30 to 30 px
  shadowOpacity?: number; // 0 to 1
  inAnimation?: 'none' | 'fade' | 'slide' | 'zoom' | 'typewriter';
  inAnimationDurationMs?: number; // default 500ms
  outAnimation?: 'none' | 'fade' | 'slide' | 'zoom';
  outAnimationDurationMs?: number; // default 500ms
  customFontPath?: string;
  isCaption?: boolean;
  highlightWord?: boolean;
  highlightColor?: string;
  words?: TextWordTiming[];
}

export interface ColorWheelValue {
  x: number;     // -1.0 to 1.0 (hue / saturation coordinate on circle)
  y: number;     // -1.0 to 1.0
  luma: number;  // -100 to 100 master luminance / offset / gain
}

export interface ColorWheels {
  lift: ColorWheelValue;  // Shadows
  gamma: ColorWheelValue; // Midtones
  gain: ColorWheelValue;  // Highlights
}

export interface LutSettings {
  enabled: boolean;
  name?: string;       // e.g. "Teal & Orange", "Warm Sunset", "Custom.cube"
  preset?: string;     // preset id e.g. 'teal_orange'
  cubeData?: string;   // raw .cube file contents (for portable bundling)
  filePath?: string;   // absolute or relative path to .cube file
  intensity: number;   // 0 to 100%
}

export interface ColorAdjustments {
  exposure?: number;    // -100 to 100 (maps to -2.0 to +2.0 EV)
  brightness: number;   // -100 to 100
  contrast: number;     // -100 to 100
  saturation: number;   // -100 to 100
  temperature?: number; // -100 to 100
  tint?: number;        // -100 to 100
  highlights?: number;  // -100 to 100
  shadows?: number;     // -100 to 100
  gamma?: number;       // -100 to 100 (maps to 0.5 to 2.0)
  fade?: number;        // 0 to 100
  vignette?: number;    // 0 to 100
  sharpen?: number;     // 0 to 100
  colorWheels?: ColorWheels;
  lut?: LutSettings;
  bypassed?: boolean;   // Phase 6: Before/After comparison bypass toggle
  presetName?: string;
}

export interface AudioEqualizer {
  enabled: boolean;
  lowGainDb: number;   // -15 to +15 dB (Bass, ~100Hz)
  midGainDb: number;   // -15 to +15 dB (Mids, ~1kHz)
  highGainDb: number;  // -15 to +15 dB (Treble, ~10kHz)
  preset?: string;     // 'flat' | 'bass_boost' | 'vocal_enhance' | 'podcast' | 'treble_boost'
}

export interface AudioNoiseReduction {
  enabled: boolean;
  amount: number;      // 0 to 100% (maps to -15dB to -40dB noise floor in afftdn)
}

export type CleanVoicePreset = 'light' | 'standard' | 'strong';

export interface CleanVoiceSettings {
  enabled: boolean;
  preset: CleanVoicePreset;           // 'light' | 'standard' | 'strong'
  bypassed?: boolean;                 // A/B Before/After bypass toggle
  removeRumble?: boolean;             // Sub-bass highpass rumble filter (default true)
  noiseGate?: boolean;                // Downward expander / gate for speech pauses (default true)
  vocalClarity?: boolean;             // Voice presence EQ shaping (default true)
  customNoiseFloorDb?: number;        // Optional fine-tuning override for noise floor (-60 to -10 dB)
  customGateThreshold?: number;       // Optional fine-tuning override for gate threshold (0.001 to 0.2)
}

export interface AudioNormalization {
  enabled: boolean;
  target: 'streaming' | 'broadcast' | 'peak'; // streaming: -14 LUFS, broadcast: -23 LUFS, peak: -1.0 dBFS
}

export interface AudioDucking {
  enabled: boolean;
  duckAmountDb: number; // e.g. -12 dB (reduction level under speech)
  thresholdDb?: number; // e.g. -24 dB
}

export interface AudioProcessingSettings {
  equalizer?: AudioEqualizer;
  noiseReduction?: AudioNoiseReduction;
  cleanVoice?: CleanVoiceSettings;    // Phase 9A: One-Click Clean Voice Core (Conventional DSP)
  normalization?: AudioNormalization;
  ducking?: AudioDucking;
  limiter?: boolean;    // soft anti-clipping limiter (alimiter)
  gainDb?: number;      // -24 to +12 dB extra trim
}

export interface ChromaKeySettings {
  enabled: boolean;
  color: string;       // hex color code, default '#00FF00'
  similarity: number;  // 0.01 to 1.0 (default 0.35)
  smoothness: number;  // 0.0 to 1.0 (default 0.10)
  spill?: number;      // 0.0 to 1.0 (default 0.15)
}

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'lighten'
  | 'color-dodge'
  | 'soft-light';

export type OverlayCategory =
  | 'light_leaks'
  | 'film_grain'
  | 'particles'
  | 'retro_vhs'
  | 'cinematic'
  | 'frames';

export interface OverlayProperties {
  overlayType: string;
  category: OverlayCategory;
  blendMode: BlendMode;
  opacity: number;
  color?: string;
  speed?: number;
}

export type EffectCategory =
  | 'cinematic'
  | 'glitch'
  | 'blur_glow'
  | 'motion_impact'
  | 'color_looks'
  | 'particles_vfx';

export type VideoEffectType =
  // Cinematic
  | 'vintage_film'
  | 'sepia_tone'
  | 'cinematic_teal_orange'
  | 'film_noir'
  // Glitch
  | 'rgb_split'
  | 'digital_glitch'
  | 'crt_scanlines'
  | 'distortion'
  // Blur & Glow
  | 'gaussian_blur'
  | 'bloom_glow'
  | 'sharpen'
  | 'soft_focus'
  // Motion & Impact
  | 'camera_shake'
  | 'zoom_pulse'
  | 'flash_impact'
  | 'light_leak_pulse'
  // Color Looks
  | 'vivid_pop'
  | 'faded_retro'
  | 'cyber_neon'
  | 'mono_contrast'
  // Particles & VFX
  | 'spark_shower'
  | 'smoke_haze'
  | 'energy_aura'
  | 'embers';

export interface VideoEffect {
  id: string;
  type: VideoEffectType;
  name: string;
  category: EffectCategory;
  intensity: number; // 0 to 100
  enabled: boolean;
  params?: Record<string, any>;
}

export type TransitionCategory = 'basic' | 'directional' | 'motion' | 'cinematic' | 'stylized';

export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'fadeBlack'
  | 'fadeWhite'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'wipeLeft'
  | 'wipeRight'
  | 'wipeUp'
  | 'wipeDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'rotate'
  | 'blur'
  | 'flash'
  | 'glitch'
  | 'rgbSplit'
  | 'filmBurn';

export interface ClipTransition {
  id: string;
  type: TransitionType;
  durationMs: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
}

export interface AutoCutSettings {
  sensitivity: number;          // 0.1 to 0.9 scene detection threshold (default 0.3)
  minSceneDurationMs: number;   // minimum scene length in ms (default 1000)
  silenceThresholdDb: number;   // audio silence threshold in dB, e.g. -30 (default -30)
  minSilenceDurationMs: number; // minimum silence length in ms (default 500)
  speechPaddingBeforeMs: number;// padding added before speech in ms (default 200)
  speechPaddingAfterMs: number; // padding added after speech in ms (default 200)
  targetDurationSec?: number | 'all'; // e.g. 15, 30, 60, or 'all'
  aspectRatioPreset?: AspectRatio;    // optional canvas ratio update ('9:16' | '1:1' | '16:9')
}

export interface ProposedCut {
  id: string;
  startMs: number;        // start time on source media
  endMs: number;          // end time on source media
  durationMs: number;     // duration in ms
  sourceStartMs: number;
  sourceEndMs: number;
  type: 'speech' | 'scene_change' | 'silence_removal';
  confidence: number;     // 0 to 1 confidence score
  included: boolean;      // user review toggle
  reason: string;
}

export type WatermarkMethod = 'delogo' | 'blur' | 'pixelate' | 'crop';

export interface WatermarkTrackingKeyframe {
  offsetMs: number;
  positionX: number; // 0 to 100%
  positionY: number; // 0 to 100%
  width: number;     // 1 to 100%
  height: number;    // 1 to 100%
  confidence?: number;
}

export interface WatermarkRemoverSettings {
  enabled: boolean;
  shape: 'rectangle' | 'oval';
  positionX: number;       // 0 to 100 percentage of width
  positionY: number;       // 0 to 100 percentage of height
  width: number;           // 1 to 100 percentage of width
  height: number;          // 1 to 100 percentage of height
  feather: number;         // 0 to 20 px band feathering
  startMs?: number;        // start time in ms
  endMs?: number;          // end time in ms
  method: WatermarkMethod; // 'delogo' | 'blur' | 'pixelate' | 'crop'
  blurIntensity?: number;  // 1 to 30 (default 10)
  pixelSize?: number;      // 4 to 32 (default 12)
  trackingKeyframes?: WatermarkTrackingKeyframe[];
  detectedCandidate?: boolean;
  userConfirmed?: boolean;
}

export interface Clip {
  id: string;
  trackId: string;
  assetId?: string;
  name: string;
  type: ClipType;
  startMs: number;        // integer millisecond position on timeline
  durationMs: number;     // integer millisecond duration on timeline
  sourceStartMs: number;  // in-point in media
  sourceEndMs: number;    // out-point in media
  speed: number;          // uniform speed multiplier (0.1 to 8.0)
  speedCurve?: SpeedCurvePoint[];
  speedCurvePreset?: string;
  pitchCorrection?: boolean;
  muteAudioOnSpeed?: boolean;
  volume: number;         // 0.0 to 2.0
  fadeInMs: number;       // audio fade-in
  fadeOutMs: number;      // audio fade-out
  transform: ClipTransform;
  mask?: ClipMask;
  keyframes: Keyframe[];
  textProperties?: TextProperties;
  colorAdjustments?: ColorAdjustments;
  transition?: ClipTransition;
  chromaKey?: ChromaKeySettings;
  elementProperties?: ElementProperties;
  overlayProperties?: OverlayProperties;
  effects?: VideoEffect[];
  isFrozen?: boolean;
  freezeFrameSourceMs?: number;
  watermarkRemover?: WatermarkRemoverSettings;
  groupId?: string; // Phase 5: Multi-clip grouping ID
  audioProcessing?: AudioProcessingSettings; // Phase 6: Professional Audio EQ, Denoise, Loudnorm, Ducking
}

export type TimelineTool = 'select' | 'ripple' | 'roll' | 'slip' | 'slide';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  order: number;
  isMuted: boolean;
  isLocked: boolean;
  isHidden?: boolean; // Phase 5: Video/overlay visibility toggle
  isSolo?: boolean;   // Phase 5: Solo audio/track
  clips: Clip[];
}

export interface Project {
  schemaVersion: '1.0.0';
  generator: string;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  assets: ProjectAsset[];
  tracks: Track[];
  durationMs: number;
  watermarkRemover?: WatermarkRemoverSettings;
  proxySettings?: ProxySettings; // Phase 7: Proxy media preview and export settings
  autosaveIntervalSec?: number;  // Phase 7: Configurable autosave interval (default 60s)
  filePath?: string;             // File path to .vnest archive on disk if saved/loaded from disk
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  durationMs: number;
  clipCount: number;
  assetCount: number;
  thumbnailUrl?: string;
  filePath?: string;             // File path to .vnest archive on disk if saved/loaded from disk
}
