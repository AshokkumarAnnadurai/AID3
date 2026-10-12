import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RecordingState, AudioLevelData } from '../../services/types/audio.ts';

interface RecorderState {
  status: RecordingState;
  activeMeetingId: string | null;
  activeMeetingTitle: string;
  durationSeconds: number;
  currentAudioUri: string | null;
  audioLevels: AudioLevelData;
  storageAvailableBytes: number;
  hasPermission: boolean | null;
  error: string | null;
}

const initialState: RecorderState = {
  status: 'idle',
  activeMeetingId: null,
  activeMeetingTitle: '',
  durationSeconds: 0,
  currentAudioUri: null,
  audioLevels: { decibels: -60, peak: 0, rms: 0 },
  storageAvailableBytes: 36700160000,
  hasPermission: null,
  error: null,
};

export const recorderSlice = createSlice({
  name: 'recorder',
  initialState,
  reducers: {
    setRecordingStatus: (state, action: PayloadAction<RecordingState>) => {
      state.status = action.payload;
    },
    setActiveMeeting: (
      state,
      action: PayloadAction<{ id: string; title: string }>
    ) => {
      state.activeMeetingId = action.payload.id;
      state.activeMeetingTitle = action.payload.title;
      state.durationSeconds = 0;
      state.error = null;
    },
    updateDuration: (state, action: PayloadAction<number>) => {
      state.durationSeconds = action.payload;
    },
    updateAudioLevels: (state, action: PayloadAction<AudioLevelData>) => {
      state.audioLevels = action.payload;
    },
    setAudioUri: (state, action: PayloadAction<string | null>) => {
      state.currentAudioUri = action.payload;
    },
    setPermissionStatus: (state, action: PayloadAction<boolean>) => {
      state.hasPermission = action.payload;
    },
    setStorageBytes: (state, action: PayloadAction<number>) => {
      state.storageAvailableBytes = action.payload;
    },
    setRecorderError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetRecorder: (state) => {
      state.status = 'idle';
      state.activeMeetingId = null;
      state.activeMeetingTitle = '';
      state.durationSeconds = 0;
      state.currentAudioUri = null;
      state.audioLevels = { decibels: -60, peak: 0, rms: 0 };
      state.error = null;
    },
  },
});

export const {
  setRecordingStatus,
  setActiveMeeting,
  updateDuration,
  updateAudioLevels,
  setAudioUri,
  setPermissionStatus,
  setStorageBytes,
  setRecorderError,
  resetRecorder,
} = recorderSlice.actions;

export default recorderSlice.reducer;
