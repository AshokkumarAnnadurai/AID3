import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProcessingJob } from '../../services/types/queue.ts';

interface JobsState {
  jobs: Record<string, ProcessingJob>;
  activeJobIds: string[];
}

const initialState: JobsState = {
  jobs: {},
  activeJobIds: [],
};

export const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    upsertJob: (state, action: PayloadAction<ProcessingJob>) => {
      const job = action.payload;
      state.jobs[job.id] = job;
      if (job.status === 'queued' || job.status === 'running') {
        if (!state.activeJobIds.includes(job.id)) {
          state.activeJobIds.push(job.id);
        }
      } else {
        state.activeJobIds = state.activeJobIds.filter((id) => id !== job.id);
      }
    },
    removeJob: (state, action: PayloadAction<string>) => {
      delete state.jobs[action.payload];
      state.activeJobIds = state.activeJobIds.filter((id) => id !== action.payload);
    },
  },
});

export const { upsertJob, removeJob } = jobsSlice.actions;
export default jobsSlice.reducer;
