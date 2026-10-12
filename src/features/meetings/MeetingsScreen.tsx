import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  FolderClock,
  Clock,
  Calendar,
  ChevronRight,
  Edit2,
  Play,
  Pause,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Badge } from '../../components/Badge.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { Input } from '../../components/Input.tsx';
import { Modal } from '../../components/Modal.tsx';
import { formatDuration, formatDate } from '../../utils/formatters.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { deleteMeeting, renameMeeting } from '../../store/slices/meetingsSlice.ts';
import { MeetingRecord, SearchResultItem } from '../../services/types/database.ts';
import { SQLiteService } from '../../services/database/sqliteService.ts';
import { AudioRecorderService } from '../../services/audio/audioService.ts';

interface MeetingsScreenProps {
  onStartRecording: () => void;
  onOpenMeeting: (meeting: MeetingRecord) => void;
}

export const MeetingsScreen: React.FC<MeetingsScreenProps> = ({
  onStartRecording,
  onOpenMeeting,
}) => {
  const dispatch = useAppDispatch();
  const meetings = useAppSelector((state) => state.meetings.items);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'approved' | 'draft' | 'interrupted'>('all');

  // Rename modal state
  const [renamingMeeting, setRenamingMeeting] = useState<MeetingRecord | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Audio preview playback state
  const [playingMeetingId, setPlayingMeetingId] = useState<string | null>(null);
  const audioService = AudioRecorderService.getInstance();

  useEffect(() => {
    const unsub = audioService.onPlaybackProgress((_curr, _dur, isPlaying) => {
      if (!isPlaying) {
        setPlayingMeetingId(null);
      }
    });
    return () => {
      unsub();
      audioService.stopPlayback();
    };
  }, [audioService]);

  // FTS Global Search state
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResultItem[]>([]);
  const [searchMode, setSearchMode] = useState<'meetings' | 'global'>('meetings');
  const db = SQLiteService.getInstance();

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      db.searchRepository.searchAll(searchQuery.trim()).then((res: SearchResultItem[]) => {
        setGlobalSearchResults(res);
      });
    } else {
      setGlobalSearchResults([]);
    }
  }, [searchQuery, db]);

  // Filter meetings
  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'approved') return m.approvalStatus === 'approved';
    if (activeFilter === 'draft') return m.approvalStatus === 'draft';
    if (activeFilter === 'interrupted') return m.recordingStatus === 'interrupted';
    return true;
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this meeting and all its local transcripts?')) {
      dispatch(deleteMeeting(id));
      if (playingMeetingId === id) {
        audioService.stopPlayback();
        setPlayingMeetingId(null);
      }
    }
  };

  const handleOpenRename = (e: React.MouseEvent, meeting: MeetingRecord) => {
    e.stopPropagation();
    setRenamingMeeting(meeting);
    setNewTitle(meeting.title);
  };

  const handleSaveRename = async () => {
    if (renamingMeeting && newTitle.trim()) {
      await dispatch(renameMeeting({ id: renamingMeeting.id, title: newTitle.trim() }));
      setRenamingMeeting(null);
    }
  };

  const handleTogglePlay = (e: React.MouseEvent, meeting: MeetingRecord) => {
    e.stopPropagation();
    if (playingMeetingId === meeting.id) {
      audioService.pausePlayback();
      setPlayingMeetingId(null);
    } else {
      audioService.playAudio(meeting.audioUri || 'demo.wav');
      setPlayingMeetingId(meeting.id);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
            Meeting History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {meetings.length} recorded offline sessions
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onStartRecording}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Record
        </Button>
      </div>

      {/* Search Input */}
      <Input
        placeholder="Search meetings by title or topic..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftIcon={<Search className="w-4 h-4 text-slate-400" />}
      />

      {/* Search Mode Toggle */}
      {searchQuery.trim().length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setSearchMode('meetings')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              searchMode === 'meetings'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Meetings ({filteredMeetings.length})
          </button>
          <button
            onClick={() => setSearchMode('global')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              searchMode === 'global'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SQLite FTS5 Hits ({globalSearchResults.length})</span>
          </button>
        </div>
      )}

      {/* Global FTS Results View */}
      {searchMode === 'global' && searchQuery.trim().length > 0 ? (
        <div className="space-y-2">
          {globalSearchResults.length === 0 ? (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
              No full-text search matches found across transcripts, actions, or decisions for &quot;{searchQuery}&quot;.
            </div>
          ) : (
            globalSearchResults.map((res) => {
              const targetMeeting = meetings.find((m) => m.id === res.meetingId);

              return (
                <Card
                  key={`${res.type}_${res.id}`}
                  variant="interactive"
                  padding="sm"
                  onClick={() => {
                    if (targetMeeting) onOpenMeeting(targetMeeting);
                  }}
                  className="space-y-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-200">{res.title}</span>
                    <Badge
                      variant={
                        res.type === 'transcript'
                          ? 'primary'
                          : res.type === 'action_item'
                          ? 'warning'
                          : res.type === 'decision'
                          ? 'success'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {res.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {res.snippet}
                  </p>
                  {targetMeeting && (
                    <div className="text-[10px] text-orange-400 pt-0.5">
                      In meeting: &quot;{targetMeeting.title}&quot; &rarr;
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <>
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              All ({meetings.length})
            </button>
            <button
              onClick={() => setActiveFilter('approved')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
                activeFilter === 'approved'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              Approved MOM
            </button>
            <button
              onClick={() => setActiveFilter('draft')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
                activeFilter === 'draft'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              Drafts
            </button>
            <button
              onClick={() => setActiveFilter('interrupted')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
                activeFilter === 'interrupted'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              Interrupted Checkpoints
            </button>
          </div>
        </>
      )}

      {/* List of Meetings */}
      {filteredMeetings.length === 0 ? (
        <EmptyState
          icon={<FolderClock className="w-6 h-6" />}
          title={searchQuery ? 'No matching meetings' : 'No meetings stored yet'}
          description={
            searchQuery
              ? `No meetings match "${searchQuery}". Clear search to view all.`
              : 'Record a meeting locally. Your recordings and AI transcripts are saved to SQLite on this device.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'Start Recording'}
          onAction={searchQuery ? () => setSearchQuery('') : onStartRecording}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredMeetings.map((meeting) => (
            <Card
              key={meeting.id}
              variant="interactive"
              padding="md"
              onClick={() => onOpenMeeting(meeting)}
              className="relative group space-y-2"
            >
              {/* Header Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={
                    meeting.approvalStatus === 'approved'
                      ? 'success'
                      : meeting.approvalStatus === 'reviewed'
                      ? 'info'
                      : 'neutral'
                  }
                  size="sm"
                >
                  MOM: {meeting.approvalStatus.toUpperCase()}
                </Badge>

                <Badge
                  variant={
                    meeting.transcriptionStatus === 'completed'
                      ? 'primary'
                      : meeting.transcriptionStatus === 'processing'
                      ? 'warning'
                      : 'outline'
                  }
                  size="sm"
                >
                  STT: {meeting.transcriptionStatus}
                </Badge>

                <Badge
                  variant={
                    meeting.analysisStatus === 'completed'
                      ? 'success'
                      : meeting.analysisStatus === 'processing'
                      ? 'warning'
                      : 'outline'
                  }
                  size="sm"
                >
                  AI: {meeting.analysisStatus}
                </Badge>

                {meeting.recordingStatus === 'interrupted' && (
                  <Badge variant="danger" size="sm" dot>
                    Interrupted
                  </Badge>
                )}
              </div>

              {/* Title & Description */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-orange-400 transition-colors">
                    {meeting.title}
                  </h3>
                  {meeting.description && (
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {meeting.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleTogglePlay(e, meeting)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-800 transition-colors"
                    title={playingMeetingId === meeting.id ? 'Pause audio' : 'Play audio preview'}
                  >
                    {playingMeetingId === meeting.id ? (
                      <Pause className="w-4 h-4 text-orange-400" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={(e) => handleOpenRename(e, meeting)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Rename meeting"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, meeting.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDate(meeting.recordedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    {formatDuration(meeting.durationSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span>Open details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Rename Dialog Modal */}
      <Modal
        isOpen={!!renamingMeeting}
        onClose={() => setRenamingMeeting(null)}
        title="Rename Meeting"
        description="Update meeting title in local SQLite database"
      >
        <div className="space-y-4">
          <Input
            label="Meeting Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new meeting title..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRenamingMeeting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveRename}
            >
              Save Rename
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
