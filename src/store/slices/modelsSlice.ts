import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WhisperModelInfo } from '../../services/types/stt.ts';
import { LLMModelInfo } from '../../services/types/llm.ts';

interface ModelsState {
  whisperModels: WhisperModelInfo[];
  llmModels: LLMModelInfo[];
  activeWhisperModelId: string;
  activeLlmModelId: string;
  deviceRamMb: number;
  hasNeuralEngine: boolean;
}

const initialState: ModelsState = {
  whisperModels: [
    {
      id: 'whisper-tiny-en',
      name: 'tiny.en',
      quantization: 'q5_1',
      fileSizeBytes: 32505856,
      isDownloaded: true,
      localPath: 'models/whisper/ggml-tiny.en-q5_1.bin',
      sha256: 'be07e048b1e59e33aa46fdf38737851e6d929272345825d730d75db957f10b0c',
      recommendedMinRamMb: 512,
    },
    {
      id: 'whisper-base-en',
      name: 'base.en',
      quantization: 'q5_1',
      fileSizeBytes: 59768832,
      isDownloaded: false,
      recommendedMinRamMb: 1024,
      sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf00e087302fb9432d033f0f',
    },
  ],
  llmModels: [
    {
      id: 'llama-3.2-1b-instruct',
      name: 'Llama-3.2-1B-Instruct',
      quantization: 'Q4_K_M',
      contextLengthTokens: 4096,
      fileSizeBytes: 734003200,
      isDownloaded: true,
      localPath: 'models/llm/llama-3.2-1b-instruct-q4_k_m.gguf',
      sha256: '5a2b1f893e4811a2f90119b9d3111f8e65e495208b5e9b7245b780ea3b5b19c2',
      minRamRequirementMb: 1500,
    },
  ],
  activeWhisperModelId: 'whisper-tiny-en',
  activeLlmModelId: 'llama-3.2-1b-instruct',
  deviceRamMb: 6144, // 6 GB detected
  hasNeuralEngine: true,
};

export const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    setActiveWhisperModel: (state, action: PayloadAction<string>) => {
      state.activeWhisperModelId = action.payload;
    },
    setActiveLlmModel: (state, action: PayloadAction<string>) => {
      state.activeLlmModelId = action.payload;
    },
    setModelDownloaded: (
      state,
      action: PayloadAction<{ id: string; isDownloaded: boolean; localPath?: string }>
    ) => {
      const w = state.whisperModels.find((m) => m.id === action.payload.id);
      if (w) {
        w.isDownloaded = action.payload.isDownloaded;
        w.localPath = action.payload.localPath;
      }
      const l = state.llmModels.find((m) => m.id === action.payload.id);
      if (l) {
        l.isDownloaded = action.payload.isDownloaded;
        l.localPath = action.payload.localPath;
      }
    },
  },
});

export const { setActiveWhisperModel, setActiveLlmModel, setModelDownloaded } = modelsSlice.actions;
export default modelsSlice.reducer;
