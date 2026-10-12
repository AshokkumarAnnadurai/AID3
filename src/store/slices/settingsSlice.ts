import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  theme: 'dark' | 'light';
  autoTranscribe: boolean;
  strictEvidenceMode: boolean;
  sampleRate: 16000 | 44100;
  offlineStrictGuarantee: boolean;
  simulatedDevice: 'iphone15' | 'pixel8' | 'responsive';
}

const initialState: SettingsState = {
  theme: 'dark',
  autoTranscribe: true,
  strictEvidenceMode: true,
  sampleRate: 16000,
  offlineStrictGuarantee: true,
  simulatedDevice: 'iphone15',
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setAutoTranscribe: (state, action: PayloadAction<boolean>) => {
      state.autoTranscribe = action.payload;
    },
    setStrictEvidenceMode: (state, action: PayloadAction<boolean>) => {
      state.strictEvidenceMode = action.payload;
    },
    setSimulatedDevice: (
      state,
      action: PayloadAction<'iphone15' | 'pixel8' | 'responsive'>
    ) => {
      state.simulatedDevice = action.payload;
    },
  },
});

export const { toggleTheme, setAutoTranscribe, setStrictEvidenceMode, setSimulatedDevice } =
  settingsSlice.actions;
export default settingsSlice.reducer;
