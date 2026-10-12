import React from 'react';
import {
  Mic,
  Calendar,
  Clock,
  CheckCircle2,
  Cpu,
  HardDrive,
  Plus,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Badge } from '../../components/Badge.tsx';
import { formatDuration, formatDate } from '../../utils/formatters.ts';
import { useAppSelector } from '../../store/hooks.ts';
import { MeetingRecord } from '../../services/types/database.ts';

interface DashboardScreenProps {
  onStartRecording: () => void;
  onOpenMeeting: (meeting: MeetingRecord) => void;
  onViewAllMeetings: () => void;
  onViewActions: () => void;
  onOpenPoc?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onStartRecording,
  onOpenMeeting,
  onViewAllMeetings,
  onViewActions,
  onOpenPoc,
}) => {
  const meetings = useAppSelector((state) => state.meetings.items);
  const activeWhisperModelId = useAppSelector((state) => state.models.activeWhisperModelId);
  const activeLlmModelId = useAppSelector((state) => state.models.activeLlmModelId);
  const recorderStatus = useAppSelector((state) => state.recorder.status);

  // Computed metrics
  const totalMeetings = meetings.length;
  const totalDurationSeconds = meetings.reduce((acc, m) => acc + (m.durationSeconds || 0), 0);
  const approvedMinutes = meetings.filter((m) => m.approvalStatus === 'approved').length;

  const recentMeetings = meetings.slice(0, 3);

  return (
    <div className="p-4 space-y-5 animate-in fade-in duration-200">
      {/* Header Profile & Quick Action */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Air-Gapped Privacy</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight mt-0.5">
            AID3
          </h1>
          <p className="text-[11px] text-slate-400">Offline AI Meeting Assistant</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onStartRecording}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-orange-500/30"
        >
          New Meeting
        </Button>
      </div>

      {/* Recording in progress notification banner if active */}
      {recorderStatus === 'recording' && (
        <Card
          variant="accent"
          padding="sm"
          className="border-red-500/40 bg-red-500/10 cursor-pointer"
          onClick={onStartRecording}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <div>
                <p className="text-xs font-bold text-red-200">Active Meeting Recording</p>
                <p className="text-[11px] text-red-300">Tap to view live audio waveform</p>
              </div>
            </div>
            <Button variant="danger" size="sm">
              View
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Launch Hero Banner */}
      <Card variant="accent" padding="lg" className="relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-semibold w-fit border border-orange-500/30">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>On-Device Whisper &amp; Llama</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-snug">
              Instant Private Minutes
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Record live discussions. Transcribe and extract action items completely offline without cloud servers.
            </p>
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={onStartRecording}
              leftIcon={<Mic className="w-4 h-4" />}
            >
              Start Recording
            </Button>
            {onOpenPoc && (
              <Button
                variant="outline"
                size="md"
                onClick={onOpenPoc}
                leftIcon={<Sparkles className="w-4 h-4" />}
                className="bg-orange-500/20 text-orange-300 border-orange-500/50"
              >
                Local AI PoC (Phase 2)
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={onViewAllMeetings}>
              History
            </Button>
          </div>
        </div>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card variant="default" padding="sm" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Meetings
            </span>
            <Calendar className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-2xl font-black text-slate-100">{totalMeetings}</span>
          <span className="text-[10px] text-slate-400">Saved in SQLite</span>
        </Card>

        <Card variant="default" padding="sm" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Recorded
            </span>
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-2xl font-black text-slate-100">
            {formatDuration(totalDurationSeconds)}
          </span>
          <span className="text-[10px] text-slate-400">Audio hours stored</span>
        </Card>

        <Card
          variant="interactive"
          padding="sm"
          className="flex flex-col gap-1.5"
          onClick={onViewActions}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Action Items
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-black text-slate-100">8</span>
          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
            <span>Tracked deliverables</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </Card>

        <Card variant="default" padding="sm" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              MOM Approved
            </span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-black text-slate-100">{approvedMinutes}</span>
          <span className="text-[10px] text-slate-400">Ready for export</span>
        </Card>
      </div>

      {/* On-Device AI Hardware Status */}
      <Card variant="default" padding="md" className="border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-slate-200">Local AI Engine Diagnostics</h3>
          </div>
          <Badge variant="success" size="sm" dot>
            Engine Idle
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Speech-to-Text:</span>
            <span className="font-semibold text-slate-200 truncate block mt-0.5">
              Whisper Tiny (31 MB)
            </span>
            <span className="text-[9px] text-emerald-400">quantized Q5_1</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Local LLM:</span>
            <span className="font-semibold text-slate-200 truncate block mt-0.5">
              Llama-3.2 1B (700 MB)
            </span>
            <span className="text-[9px] text-emerald-400">quantized Q4_K_M</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>SQLite WAL Mode: Active</span>
          </div>
          <span className="font-mono text-emerald-400 font-semibold">
            34.2 GB Storage Free
          </span>
        </div>
      </Card>

      {/* Recent Meetings Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Recent Meetings</h2>
          {meetings.length > 0 && (
            <button
              onClick={onViewAllMeetings}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-0.5"
            >
              <span>See all ({meetings.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentMeetings.length === 0 ? (
          <Card variant="default" padding="md" className="text-center py-6">
            <Mic className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">No meetings recorded yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
              Start your first offline session to test audio recording and local database storage.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onStartRecording}>
                Record Now
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentMeetings.map((meeting) => (
              <Card
                key={meeting.id}
                variant="interactive"
                padding="sm"
                onClick={() => onOpenMeeting(meeting)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-orange-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-100 truncate">
                      {meeting.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span>{formatDate(meeting.recordedAt)}</span>
                      <span>•</span>
                      <span>{formatDuration(meeting.durationSeconds)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      meeting.transcriptionStatus === 'completed'
                        ? 'success'
                        : meeting.transcriptionStatus === 'processing'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {meeting.transcriptionStatus}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
