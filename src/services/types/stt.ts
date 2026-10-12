export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speakerId?: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  isEdited: boolean;
  originalText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhisperModelInfo {
  id: string;
  name: 'tiny.en' | 'base.en' | 'small.en' | 'medium.en';
  quantization: 'q5_1' | 'q8_0' | 'fp16';
  fileSizeBytes: number;
  isDownloaded: boolean;
  localPath?: string;
  sha256: string;
  recommendedMinRamMb: number;
}

export interface STTTranscriptionOptions {
  modelId: string;
  language?: string;
  promptHint?: string;
  translate?: boolean;
  detectSpeakers?: boolean;
  chunkDurationSeconds?: number;
}

export interface STTProgressUpdate {
  progress: number; // 0.0 to 1.0
  processedDurationSeconds: number;
  totalDurationSeconds: number;
  estimatedRemainingSeconds?: number;
  currentSegment?: TranscriptSegment;
}

export type STTProgressCallback = (update: STTProgressUpdate) => void;

export interface ITranscriptionEngine {
  isAvailable(): Promise<boolean>;
  getLoadedModelInfo(): WhisperModelInfo | null;
  loadModel(modelInfo: WhisperModelInfo): Promise<void>;
  unloadModel(): Promise<void>;
  transcribeAudioFile(
    audioFilePath: string,
    options: STTTranscriptionOptions,
    onProgress?: STTProgressCallback
  ): Promise<TranscriptSegment[]>;
  cancelTranscription(): Promise<void>;
}
