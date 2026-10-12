import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/index.ts';
import { useAppDispatch, useAppSelector } from './store/hooks.ts';
import { fetchMeetings, createMeeting } from './store/slices/meetingsSlice.ts';
import { SQLiteService } from './services/database/sqliteService.ts';
import { MobileShell, ActiveTab } from './components/MobileShell.tsx';
import { DashboardScreen } from './features/dashboard/DashboardScreen.tsx';
import { MeetingsScreen } from './features/meetings/MeetingsScreen.tsx';
import { MeetingDetailScreen } from './features/meetings/MeetingDetailScreen.tsx';
import { RecorderScreen } from './features/recorder/RecorderScreen.tsx';
import { ActionsScreen } from './features/actions/ActionsScreen.tsx';
import { SettingsScreen } from './features/settings/SettingsScreen.tsx';
import { LocalAIPocScreen } from './features/poc/LocalAIPocScreen.tsx';
import { MeetingRecord } from './services/types/database.ts';

function MeetingAppContent() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const db = SQLiteService.getInstance();
        await db.initialize();

        // Check if meetings exist; seed initial sample meetings if empty
        const existing = await db.meetingRepository.getAll();
        if (existing.length === 0) {
          const sample1 = await db.meetingRepository.create({
            id: 'mtg_seed_001',
            title: 'Q4 Local AI Architecture Review',
            description: 'Evaluation of on-device Whisper STT & Llama-3.2 1B inference pipeline without cloud backends.',
            recordedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            durationSeconds: 1640,
            audioUri: 'file:///app_storage/recordings/mtg_seed_001.wav',
            audioFileSizeBytes: 52480000,
            audioSampleRate: 16000,
            recordingStatus: 'completed',
            transcriptionStatus: 'completed',
            analysisStatus: 'completed',
            approvalStatus: 'approved',
          });

          const sample2 = await db.meetingRepository.create({
            id: 'mtg_seed_002',
            title: 'Mobile Core Sync & SQLite Schema Planning',
            description: 'Discussion on WAL mode persistence, schema_migrations table, and audio interruption recovery.',
            recordedAt: new Date(Date.now() - 86400000).toISOString(),
            durationSeconds: 920,
            audioUri: 'file:///app_storage/recordings/mtg_seed_002.wav',
            audioFileSizeBytes: 29440000,
            audioSampleRate: 16000,
            recordingStatus: 'completed',
            transcriptionStatus: 'completed',
            analysisStatus: 'completed',
            approvalStatus: 'draft',
          });
        }

        await dispatch(fetchMeetings());
      } catch (err) {
        console.error('App initialization error:', err);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [dispatch]);

  const handleOpenMeeting = (meeting: MeetingRecord) => {
    setSelectedMeeting(meeting);
    setActiveTab('detail');
  };

  const handleRecordingFinished = (meeting: MeetingRecord) => {
    setSelectedMeeting(meeting);
    setActiveTab('detail');
    dispatch(fetchMeetings());
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab !== 'detail') {
      setSelectedMeeting(null);
    }
    setActiveTab(tab);
  };

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'dashboard' && (
        <DashboardScreen
          onStartRecording={() => setActiveTab('record')}
          onOpenMeeting={handleOpenMeeting}
          onViewAllMeetings={() => setActiveTab('meetings')}
          onViewActions={() => setActiveTab('actions')}
          onOpenPoc={() => setActiveTab('poc')}
        />
      )}

      {activeTab === 'meetings' && (
        <MeetingsScreen
          onStartRecording={() => setActiveTab('record')}
          onOpenMeeting={handleOpenMeeting}
        />
      )}

      {activeTab === 'record' && (
        <RecorderScreen
          onRecordingFinished={handleRecordingFinished}
          onCancel={() => setActiveTab('dashboard')}
        />
      )}

      {activeTab === 'detail' && selectedMeeting && (
        <MeetingDetailScreen
          meeting={selectedMeeting}
          onBack={() => setActiveTab('meetings')}
        />
      )}

      {activeTab === 'actions' && (
        <ActionsScreen
          onOpenMeetingById={(id) => {
            const db = SQLiteService.getInstance();
            db.meetingRepository.getById(id).then((m) => {
              if (m) handleOpenMeeting(m);
            });
          }}
        />
      )}

      {activeTab === 'settings' && <SettingsScreen />}

      {activeTab === 'poc' && <LocalAIPocScreen onDone={() => setActiveTab('dashboard')} />}
    </MobileShell>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <MeetingAppContent />
    </Provider>
  );
}
