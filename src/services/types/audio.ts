export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'interrupted';

export interface AudioRecordingConfig {
  sampleRate: number; // typically 16000 for whisper.cpp
  channels: 1 | 2;    // mono (1) required for Whisper
  bitDepth: 16;
  audioFormat: 'wav' | 'pcm' | 'm4a' | 'webm';
  chunkDurationSeconds?: number;
}

export interface RecordingMetadata {
  id: string;
  meetingId: string;
  filePath: string;
  audioPlaybackUrl?: string;
  audioBlob?: Blob;
  durationSeconds: number;
  fileSizeBytes: number;
  sampleRate: number;
  createdAt: string;
}

export interface AudioLevelData {
  decibels: number; // -160 to 0 dB
  peak: number;     // 0.0 to 1.0 normalized
  rms: number;      // 0.0 to 1.0
}

export type AudioLevelListener = (data: AudioLevelData) => void;
export type InterruptionListener = (reason: 'phone_call' | 'alarm' | 'low_storage' | 'audio_focus_loss') => void;
export type PlaybackProgressListener = (currentTime: number, duration: number, isPlaying: boolean) => void;

export interface IAudioRecorderService {
  requestPermissions(): Promise<boolean>;
  checkPermissions(): Promise<boolean>;
  startRecording(meetingId: string, config?: Partial<AudioRecordingConfig>): Promise<string>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  stopRecording(): Promise<RecordingMetadata>;
  getRecordingState(): RecordingState;
  getDurationSeconds(): number;
  onAudioLevel(callback: AudioLevelListener): () => void;
  onInterruption(callback: InterruptionListener): () => void;
  getAvailableStorageBytes(): Promise<number>;
  recoverOrphanedRecordings(): Promise<RecordingMetadata[]>;
  playAudio(audioUrlOrPath: string): Promise<void>;
  pausePlayback(): void;
  stopPlayback(): void;
  seekPlayback(timeSeconds: number): void;
  onPlaybackProgress(callback: PlaybackProgressListener): () => void;
}
