import { configureStore } from '@reduxjs/toolkit';
import meetingsReducer from './slices/meetingsSlice.ts';
import recorderReducer from './slices/recorderSlice.ts';
import jobsReducer from './slices/jobsSlice.ts';
import modelsReducer from './slices/modelsSlice.ts';
import settingsReducer from './slices/settingsSlice.ts';

export const store = configureStore({
  reducer: {
    meetings: meetingsReducer,
    recorder: recorderReducer,
    jobs: jobsReducer,
    models: modelsReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
