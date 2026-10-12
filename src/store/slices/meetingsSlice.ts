import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MeetingRecord } from '../../services/types/database.ts';
import { SQLiteService } from '../../services/database/sqliteService.ts';

interface MeetingsState {
  items: MeetingRecord[];
  selectedMeeting: MeetingRecord | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filterStatus: string | null;
}

const initialState: MeetingsState = {
  items: [],
  selectedMeeting: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  filterStatus: null,
};

export const fetchMeetings = createAsyncThunk(
  'meetings/fetchMeetings',
  async (filter?: { search?: string; status?: string }) => {
    const db = SQLiteService.getInstance();
    return await db.meetingRepository.getAll(filter);
  }
);

export const createMeeting = createAsyncThunk(
  'meetings/createMeeting',
  async (meeting: Omit<MeetingRecord, 'createdAt' | 'updatedAt'>) => {
    const db = SQLiteService.getInstance();
    return await db.meetingRepository.create(meeting);
  }
);

export const deleteMeeting = createAsyncThunk(
  'meetings/deleteMeeting',
  async (id: string) => {
    const db = SQLiteService.getInstance();
    await db.meetingRepository.delete(id);
    return id;
  }
);

export const renameMeeting = createAsyncThunk(
  'meetings/renameMeeting',
  async ({ id, title }: { id: string; title: string }) => {
    const db = SQLiteService.getInstance();
    return await db.meetingRepository.rename(id, title);
  }
);

export const updateMeeting = createAsyncThunk(
  'meetings/updateMeeting',
  async ({ id, updates }: { id: string; updates: Partial<MeetingRecord> }) => {
    const db = SQLiteService.getInstance();
    return await db.meetingRepository.update(id, updates);
  }
);

export const meetingsSlice = createSlice({
  name: 'meetings',
  initialState,
  reducers: {
    selectMeeting: (state, action: PayloadAction<MeetingRecord | null>) => {
      state.selectedMeeting = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setFilterStatus: (state, action: PayloadAction<string | null>) => {
      state.filterStatus = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMeetings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch meetings';
      })
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        state.items = state.items.filter((m) => m.id !== action.payload);
        if (state.selectedMeeting?.id === action.payload) {
          state.selectedMeeting = null;
        }
      })
      .addCase(renameMeeting.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.items.findIndex((m) => m.id === updated.id);
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selectedMeeting?.id === updated.id) {
          state.selectedMeeting = updated;
        }
      })
      .addCase(updateMeeting.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.items.findIndex((m) => m.id === updated.id);
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selectedMeeting?.id === updated.id) {
          state.selectedMeeting = updated;
        }
      });
  },
});

export const { selectMeeting, setSearchQuery, setFilterStatus } = meetingsSlice.actions;
export default meetingsSlice.reducer;
