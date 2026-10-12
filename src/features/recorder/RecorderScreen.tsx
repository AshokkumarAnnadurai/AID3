import React, { useState, useEffect } from 'react';
import {
  Mic,
  Pause,
  Play,
  Square,
  ShieldAlert,
  HardDrive,
  Info,
  CheckCircle2,
  PhoneCall,
  RotateCcw,
  AlertTriangle,
  Volume2,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Input } from '../../components/Input.tsx';
import { Badge } from '../../components/Badge.tsx';
import { AudioWaveform } from '../../components/AudioWaveform.tsx';
import { formatDuration, formatFileSize } from '../../utils/formatters.ts';
import { AudioRecorderService } from '../../services/audio/audioService.ts';
import { SQLiteService } from '../../services/database/sqliteService.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import {
  setRecordingStatus,
  updateDuration,
  updateAudioLevels,
  resetRecorder,
} from '../../store/slices/recorderSlice.ts';
import { createMeeting } from '../../store/slices/meetingsSlice.ts';
import { MeetingRecord, RecordingCheckpointRecord } from '../../services/types/database.ts';

interface RecorderScreenProps {
  onRecordingFinished: (meeting: MeetingRecord) => void;
  onCancel: () => void;
}

export const RecorderScreen: React.FC<RecorderScreenProps> = ({
  onRecordingFinished,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const recorderStatus = useAppSelector((state) => state.recorder.status);
  const durationSeconds = useAppSelector((state) => state.recorder.durationSeconds);
  const audioLevels = useAppSelector((state) => state.recorder.audioLevels);
  const storageAvailableBytes = useAppSelector((state) => state.recorder.storageAvailableBytes);

  const [title, setTitle] = useState(`Meeting ${new Date().toLocaleDateString()}`);
  const [description, setDescription] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  const [isStopping, setIsStopping] = useState(false);
  const [interruptionReason, setInterruptionReason] = useState<string | null>(null);
  const [orphanedCheckpoints, setOrphanedCheckpoints] = useState<RecordingCheckpointRecord[]>([]);

  const recorderService = AudioRecorderService.getInstance();
  const db = SQLiteService.getInstance();

  useEffect(() => {
    // Check for orphaned unrecovered checkpoints on mount
    const checkOrphans = async () => {
      try {
        const unrec = await db.recordingCheckpointRepository.getUnrecovered();
        setOrphanedCheckpoints(unrec);
      } catch (e) {
        console.warn('Orphan check error:', e);
      }
    };
    checkOrphans();
  }, [db]);

  useEffect(() => {
    // Listen to real-time audio levels
    const unsubAudio = recorderService.onAudioLevel((data) => {
      dispatch(updateAudioLevels(data));
    });

    const unsubInterrupt = recorderService.onInterruption((reason) => {
      setInterruptionReason(reason);
      dispatch(setRecordingStatus('interrupted'));
    });

    return () => {
      unsubAudio();
      unsubInterrupt();
    };
  }, [dispatch, recorderService]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (recorderStatus === 'recording') {
      timer = setInterval(() => {
        dispatch(updateDuration(recorderService.getDurationSeconds()));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recorderStatus, dispatch, recorderService]);

  const handleStartRecording = async () => {
    try {
      const allowed = await recorderService.requestPermissions();
      if (!allowed) {
        setHasPermission(false);
        return;
      }
      setHasPermission(true);
      setInterruptionReason(null);

      const meetingId = `mtg_${Date.now()}`;
      await recorderService.startRecording(meetingId);
      dispatch(setRecordingStatus('recording'));
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handlePauseRecording = async () => {
    await recorderService.pauseRecording();
    dispatch(setRecordingStatus('paused'));
  };

  const handleResumeRecording = async () => {
    await recorderService.resumeRecording();
    dispatch(setRecordingStatus('recording'));
    setInterruptionReason(null);
  };

  const handleTriggerInterruptionSimulation = () => {
    recorderService.triggerInterruption('phone_call');
  };

  const handleStopRecording = async () => {
    try {
      setIsStopping(true);
      const metadata = await recorderService.stopRecording();
      dispatch(setRecordingStatus('stopped'));

      // Create meeting in SQLite
      const meetingResult = await dispatch(
        createMeeting({
          id: metadata.meetingId,
          title: title.trim() || 'Untitled Meeting',
          description: description.trim() || undefined,
          recordedAt: new Date().toISOString(),
          durationSeconds: Math.max(1, metadata.durationSeconds),
          audioUri: metadata.filePath,
          audioFileSizeBytes: metadata.fileSizeBytes,
          audioSampleRate: 16000,
          recordingStatus: 'completed',
          transcriptionStatus: 'pending',
          analysisStatus: 'pending',
          approvalStatus: 'draft',
        })
      ).unwrap();

      dispatch(resetRecorder());
      onRecordingFinished(meetingResult);
    } catch (err) {
      console.error('Failed to stop recording:', err);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRecoverCheckpoint = async (ckpt: RecordingCheckpointRecord) => {
    try {
      await db.recordingCheckpointRepository.markRecovered(ckpt.id);
      const recoveredMeeting = await dispatch(
        createMeeting({
          id: ckpt.meetingId,
          title: `Recovered Session (${new Date(ckpt.createdAt).toLocaleTimeString()})`,
          description: 'Recovered from crash checkpoint',
          recordedAt: ckpt.createdAt,
          durationSeconds: ckpt.durationSeconds,
          audioUri: ckpt.audioUri,
          audioFileSizeBytes: ckpt.durationSeconds * 32000,
          audioSampleRate: 16000,
          recordingStatus: 'completed',
          transcriptionStatus: 'pending',
          analysisStatus: 'pending',
          approvalStatus: 'draft',
        })
      ).unwrap();

      setOrphanedCheckpoints((prev) => prev.filter((c) => c.id !== ckpt.id));
      onRecordingFinished(recoveredMeeting);
    } catch (err) {
      console.error('Failed to recover checkpoint:', err);
    }
  };

  const isRecordingActive = recorderStatus === 'recording';
  const isPaused = recorderStatus === 'paused';
  const isInterrupted = recorderStatus === 'interrupted';

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
          Record Meeting
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          16kHz 16-bit mono offline capture with periodic checkpointing
        </p>
      </div>

      {/* Recoverable Recording Banner if orphaned session found */}
      {orphanedCheckpoints.length > 0 && !isRecordingActive && (
        <Card variant="accent" padding="sm" className="border-amber-500/50 bg-amber-500/10 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Unfinished Session Detected</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Found an interrupted recording checkpoint ({formatDuration(orphanedCheckpoints[0].durationSeconds)}). You can recover it into SQLite now.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleRecoverCheckpoint(orphanedCheckpoints[0])}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Recover Audio Session
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOrphanedCheckpoints([])}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Interruption Notice if phone call occurred */}
      {isInterrupted && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs space-y-1 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <PhoneCall className="w-4 h-4 text-red-400" />
            <span>Recording Interrupted ({interruptionReason || 'External Event'})</span>
          </div>
          <p className="text-[11px] text-red-300 leading-relaxed">
            Audio stream paused and emergency checkpoint saved to SQLite. Tap Resume to continue or Save to finalize.
          </p>
        </div>
      )}

      {/* Meeting metadata form */}
      {!isRecordingActive && !isPaused && !isInterrupted && (
        <Card variant="default" padding="md" className="space-y-3">
          <Input
            label="Meeting Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q4 Product Architecture Review"
          />
          <Input
            label="Agenda / Notes (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key discussion points or participant list..."
          />
        </Card>
      )}

      {/* Main Recording Console */}
      <Card variant="accent" padding="lg" className="flex flex-col items-center text-center space-y-4">
        {/* Status indicator pill */}
        <Badge
          variant={
            isRecordingActive
              ? 'danger'
              : isPaused
              ? 'warning'
              : isInterrupted
              ? 'danger'
              : 'neutral'
          }
          size="md"
          dot={isRecordingActive}
        >
          {isRecordingActive
            ? 'RECORDING LIVE'
            : isPaused
            ? 'RECORDING PAUSED'
            : isInterrupted
            ? 'INTERRUPTED'
            : 'READY TO RECORD'}
        </Badge>

        {/* Digital Timer */}
        <div className="space-y-1">
          <span className="font-mono text-4xl sm:text-5xl font-black text-slate-100 tracking-wider">
            {formatDuration(durationSeconds)}
          </span>
          <p className="text-xs text-slate-400">
            {isRecordingActive
              ? 'Streaming PCM to app storage • Auto-checkpoint active'
              : isInterrupted
              ? 'Audio buffer preserved at checkpoint'
              : 'Tap start to begin'}
          </p>
        </div>

        {/* Audio Waveform Visualizer */}
        <div className="w-full">
          <AudioWaveform
            isRecording={isRecordingActive}
            peakLevel={audioLevels.peak}
            barCount={32}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
            <span>Level: {audioLevels.decibels.toFixed(1)} dB</span>
            <span className="font-mono text-emerald-400">16,000 Hz Mono</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3 pt-2 w-full">
          {!isRecordingActive && !isPaused && !isInterrupted ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartRecording}
              leftIcon={<Mic className="w-5 h-5" />}
              className="px-8 shadow-orange-500/40 text-base flex-1"
            >
              Start Recording
            </Button>
          ) : (
            <>
              {isRecordingActive ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handlePauseRecording}
                  leftIcon={<Pause className="w-4 h-4" />}
                  className="flex-1"
                >
                  Pause
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleResumeRecording}
                  leftIcon={<Play className="w-4 h-4" />}
                  className="flex-1"
                >
                  Resume
                </Button>
              )}

              <Button
                variant="danger"
                size="md"
                onClick={handleStopRecording}
                isLoading={isStopping}
                leftIcon={<Square className="w-4 h-4" />}
                className="flex-1"
              >
                Save &amp; Finish
              </Button>
            </>
          )}
        </div>

        {/* Interruption Test Tool during active recording */}
        {isRecordingActive && (
          <div className="pt-2">
            <button
              onClick={handleTriggerInterruptionSimulation}
              className="text-[10px] text-slate-500 hover:text-orange-400 flex items-center gap-1 transition-colors underline"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Simulate phone call interruption</span>
            </button>
          </div>
        )}
      </Card>

      {/* Safety & Storage Status Card */}
      <Card variant="default" padding="sm" className="space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-orange-400" />
            <span className="font-semibold">Device Storage Safety</span>
          </div>
          <span className="font-mono text-emerald-400">
            {formatFileSize(storageAvailableBytes)} Free
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Recordings are written to sandboxed app storage. Audio is preserved across app pauses and low memory alerts with automatic checkpoints every 10 seconds.
        </p>
      </Card>

      {/* Background Recording Capability Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <span>
          Background recording uses Android Foreground Service with continuous notification and iOS Audio Background Mode (`UIBackgroundModes: ["audio"]`).
        </span>
      </div>
    </div>
  );
};
