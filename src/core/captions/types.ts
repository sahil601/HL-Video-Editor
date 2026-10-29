export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
  score?: number;
}

export interface CaptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words?: CaptionWord[];
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  backgroundPadding: number;
  borderRadius: number;
  positionY: number; // -50 to 50 (percentage vertical offset, e.g. 35 is bottom)
  positionX: number; // -50 to 50
  textAlign: 'left' | 'center' | 'right';
  highlightWord?: boolean;
  highlightColor?: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 28,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  backgroundPadding: 8,
  borderRadius: 6,
  positionY: 35,
  positionX: 0,
  textAlign: 'center',
  highlightWord: true,
  highlightColor: '#facc15', // Vibrant yellow word highlight
};

export type TranscriptionModelId = 'Xenova/whisper-tiny' | 'Xenova/whisper-tiny.en' | 'Xenova/whisper-base';

export interface TranscriptionProgress {
  status: 'idle' | 'downloading-model' | 'extracting-audio' | 'transcribing' | 'completed' | 'error';
  progress: number; // 0 to 100
  message: string;
  detail?: string;
}

export interface TranscriptionOptions {
  sourceType: 'project' | 'asset' | 'file';
  assetId?: string;
  filePath?: string;
  language: string; // 'auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', etc.
  model: TranscriptionModelId;
  wordTimestamps?: boolean;
}
