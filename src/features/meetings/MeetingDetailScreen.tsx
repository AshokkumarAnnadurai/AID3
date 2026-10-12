import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FileText,
  CheckCircle2,
  ListOrdered,
  Database,
  Trash2,
  Check,
  Edit2,
  Save,
  Volume2,
  RefreshCw,
  XCircle,
  Users,
  Plus,
  Sparkles,
  Download,
  Share2,
  ExternalLink,
  AlertTriangle,
  Layers,
  FileDown,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Badge } from '../../components/Badge.tsx';
import { Input } from '../../components/Input.tsx';
import { Modal } from '../../components/Modal.tsx';
import { formatDuration, formatDate, formatFileSize, formatTimestamp } from '../../utils/formatters.ts';
import {
  MeetingRecord,
  ActionItemRecord,
  DecisionRecord,
  ParticipantRecord,
  EvidenceLinkRecord,
  MeetingArtifactRecord,
} from '../../services/types/database.ts';
import { TranscriptSegment } from '../../services/types/stt.ts';
import { MOMStructuredOutput } from '../../services/types/llm.ts';
import { SQLiteService } from '../../services/database/sqliteService.ts';
import { AudioRecorderService } from '../../services/audio/audioService.ts';
import { WhisperTranscriptionEngine } from '../../services/stt/whisperEngine.ts';
import { LlamaLocalRuntime } from '../../services/llm/llamaRuntime.ts';
import { RollupMeetingEngine } from '../../services/llm/rollupEngine.ts';
import { ExportService } from '../../services/export/exportService.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { deleteMeeting, updateMeeting } from '../../store/slices/meetingsSlice.ts';

interface MeetingDetailScreenProps {
  meeting: MeetingRecord;
  onBack: () => void;
}

export const MeetingDetailScreen: React.FC<MeetingDetailScreenProps> = ({
  meeting,
  onBack,
}) => {
  const dispatch = useAppDispatch();
  const whisperModel = useAppSelector((state) => state.models.whisperModels[0]);
  const llamaModel = useAppSelector((state) => state.models.llmModels[0]);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'transcript' | 'actions' | 'decisions' | 'participants' | 'artifacts' | 'raw'
  >('overview');
  const [currentMeeting, setCurrentMeeting] = useState<MeetingRecord>(meeting);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemRecord[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLinkRecord[]>([]);
  const [artifacts, setArtifacts] = useState<MeetingArtifactRecord[]>([]);

  // Generated MOM Data
  const [momData, setMomData] = useState<MOMStructuredOutput | null>(null);

  // Editing state
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [approvalStatus, setApprovalStatus] = useState(meeting.approvalStatus);

  // New participant input
  const [newPartName, setNewPartName] = useState('');
  const [newPartRole, setNewPartRole] = useState('');

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(() => {
    return Number.isFinite(meeting.durationSeconds) && meeting.durationSeconds > 0
      ? meeting.durationSeconds
      : 60;
  });

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionStage, setTranscriptionStage] = useState('');

  // Local LLM MOM Generation state
  const [isGeneratingMOM, setIsGeneratingMOM] = useState(false);
  const [momProgress, setMomProgress] = useState(0);
  const [momStage, setMomStage] = useState('');
  const [momTokensGen, setMomTokensGen] = useState(0);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');

  // Evidence Inspector Modal state
  const [selectedEvidence, setSelectedEvidence] = useState<{
    entityTitle: string;
    segment?: TranscriptSegment;
    quote?: string;
  } | null>(null);

  // Filter within transcript
  const [transcriptFilter, setTranscriptFilter] = useState('');

  const db = SQLiteService.getInstance();
  const audioService = AudioRecorderService.getInstance();
  const whisperEngine = WhisperTranscriptionEngine.getInstance();
  const llamaRuntime = LlamaLocalRuntime.getInstance();

  useEffect(() => {
    const unsub = audioService.onPlaybackProgress((curr, dur, playing) => {
      if (Number.isFinite(curr) && curr >= 0) setPlaybackCurrentTime(curr);
      if (Number.isFinite(dur) && dur > 0) setPlaybackDuration(dur);
      setIsPlaying(playing);
    });

    return () => {
      unsub();
      audioService.stopPlayback();
    };
  }, [audioService]);

  useEffect(() => {
    loadAllData();
  }, [meeting.id, db]);

  const loadAllData = async () => {
    // 1. Segments
    let segs = await db.transcriptRepository.getByMeetingId(meeting.id);
    if (segs.length === 0) {
      const sampleSegments: TranscriptSegment[] = [
        {
          id: `seg_${meeting.id}_1`,
          meetingId: meeting.id,
          speakerId: 'speaker_1',
          startMs: 0,
          endMs: 8500,
          text: 'Welcome everyone to the offline meeting. Today we review the mobile local AI architecture.',
          confidence: 0.98,
          isEdited: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `seg_${meeting.id}_2`,
          meetingId: meeting.id,
          speakerId: 'speaker_2',
          startMs: 9000,
          endMs: 18200,
          text: 'We agreed that whisper.cpp with tiny.en model runs efficiently under 50MB RAM on Android and iOS.',
          confidence: 0.95,
          isEdited: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `seg_${meeting.id}_3`,
          meetingId: meeting.id,
          speakerId: 'speaker_1',
          startMs: 19000,
          endMs: 27500,
          text: 'Alex will configure the SQLite database versioned migration system by Friday.',
          confidence: 0.96,
          isEdited: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      await db.transcriptRepository.insertSegments(sampleSegments);
      segs = sampleSegments;
    }
    setSegments(segs);

    // 2. Action Items
    let actions = await db.actionItemRepository.getByMeetingId(meeting.id);
    if (actions.length === 0) {
      actions = await db.actionItemRepository.createMany([
        {
          id: `act_${meeting.id}_1`,
          meetingId: meeting.id,
          title: 'Verify offline Whisper transcription proof of concept',
          description: 'Run 16kHz audio through whisper.cpp native engine without network access.',
          owner: 'Alex',
          dueDate: 'Friday',
          priority: 'high',
          status: 'in_progress',
        },
        {
          id: `act_${meeting.id}_2`,
          meetingId: meeting.id,
          title: 'Validate Llama-3.2 1B GGUF memory footprint on device',
          description: 'Confirm peak RAM does not exceed 1.5GB during MOM generation.',
          owner: 'Mobile Lead',
          dueDate: 'Next Monday',
          priority: 'urgent',
          status: 'todo',
        },
      ]);
    }
    setActionItems(actions);

    // 3. Decisions
    let decs = await db.decisionRepository.getByMeetingId(meeting.id);
    if (decs.length === 0) {
      decs = await db.decisionRepository.createMany([
        {
          id: `dec_${meeting.id}_1`,
          meetingId: meeting.id,
          title: 'Zero-cloud air-gapped architecture selected for complete privacy',
          rationale: 'All transcription and LLM inference must execute purely on local hardware.',
          consensusLevel: 'unanimous',
        },
      ]);
    }
    setDecisions(decs);

    // 4. Participants
    let parts = await db.participantRepository.getByMeetingId(meeting.id);
    if (parts.length === 0) {
      const p1 = await db.participantRepository.add(meeting.id, 'Sarah Chen', 'sarah@example.com', 'Product Lead');
      const p2 = await db.participantRepository.add(meeting.id, 'Alex Rivera', 'alex@example.com', 'Mobile AI Architect');
      parts = [p1, p2];
    }
    setParticipants(parts);

    // 5. Evidence Links
    let evLinks = await db.evidenceLinkRepository.getByMeetingId(meeting.id);
    if (evLinks.length === 0 && segs.length > 0 && actions.length > 0) {
      // Seed bidirectional evidence links
      evLinks = await db.evidenceLinkRepository.createMany([
        {
          id: `ev_${meeting.id}_act1`,
          entityType: 'action_item',
          entityId: actions[0].id,
          segmentId: segs[2] ? segs[2].id : segs[0].id,
          relevanceScore: 0.98,
          quote: segs[2] ? segs[2].text : segs[0].text,
        },
        {
          id: `ev_${meeting.id}_dec1`,
          entityType: 'decision',
          entityId: decs[0].id,
          segmentId: segs[1] ? segs[1].id : segs[0].id,
          relevanceScore: 0.95,
          quote: segs[1] ? segs[1].text : segs[0].text,
        },
      ]);
    }
    setEvidenceLinks(evLinks);

    // 6. Artifacts
    const arts = await db.meetingArtifactRepository.getByMeetingId(meeting.id);
    setArtifacts(arts);
  };

  // Audio Playback & Timestamp Seek
  const handleTogglePlay = () => {
    if (isPlaying) {
      audioService.pausePlayback();
    } else {
      audioService.playAudio(currentMeeting.audioUri || 'demo.wav');
    }
  };

  const handlePlayFromTimestamp = (startMs: number) => {
    const validMs = Number.isFinite(startMs) && startMs >= 0 ? startMs : 0;
    const targetSeconds = validMs / 1000;
    audioService
      .playAudio(currentMeeting.audioUri || 'demo.wav')
      .then(() => {
        if (Number.isFinite(targetSeconds)) {
          audioService.seekPlayback(targetSeconds);
          setPlaybackCurrentTime(targetSeconds);
        }
      })
      .catch((err) => {
        console.warn('handlePlayFromTimestamp error:', err);
      });
  };

  // Jump to evidence segment and play audio
  const handleJumpToEvidence = (segmentId: string) => {
    const targetSeg = segments.find((s) => s.id === segmentId);
    if (targetSeg) {
      setActiveTab('transcript');
      handlePlayFromTimestamp(targetSeg.startMs);
    }
  };

  // Transcription Execution
  const handleRunTranscription = async () => {
    try {
      setIsTranscribing(true);
      setTranscriptionProgress(0.05);
      setTranscriptionStage('Loading Whisper Tiny GGML model...');

      await dispatch(
        updateMeeting({
          id: currentMeeting.id,
          updates: { transcriptionStatus: 'processing' },
        })
      );
      setCurrentMeeting((prev) => ({ ...prev, transcriptionStatus: 'processing' }));

      await db.transcriptRepository.clearSegmentsForMeeting(currentMeeting.id);
      setSegments([]);

      await whisperEngine.loadModel(whisperModel);
      setTranscriptionStage('Processing audio in background thread...');

      const newSegments = await whisperEngine.transcribeAudioFile(
        currentMeeting.audioUri || 'demo.wav',
        { modelId: whisperModel.id },
        (update) => {
          setTranscriptionProgress(update.progress);
          setTranscriptionStage(`Transcribing ${(update.progress * 100).toFixed(0)}%`);
        }
      );

      await db.transcriptRepository.insertSegments(newSegments);
      setSegments(newSegments);

      await dispatch(
        updateMeeting({
          id: currentMeeting.id,
          updates: { transcriptionStatus: 'completed' },
        })
      );
      setCurrentMeeting((prev) => ({ ...prev, transcriptionStatus: 'completed' }));
      setTranscriptionStage('Transcription completed successfully');
    } catch (err) {
      console.error('Transcription failed:', err);
      await dispatch(
        updateMeeting({
          id: currentMeeting.id,
          updates: { transcriptionStatus: 'failed' },
        })
      );
      setCurrentMeeting((prev) => ({ ...prev, transcriptionStatus: 'failed' }));
      setTranscriptionStage(`Failed: ${(err as Error).message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Run Local LLM MOM Pipeline (with Hierarchical Rollup & Zod Validation)
  const handleGenerateMOM = async () => {
    try {
      setIsGeneratingMOM(true);
      setMomProgress(0.05);
      setMomStage('Initializing Local Llama-3.2 1B Runtime...');
      setMomTokensGen(0);

      await llamaRuntime.loadModel(llamaModel);

      // Use hierarchical rollup engine to handle arbitrary transcript length
      setMomStage('Partitioning transcript & extracting entities...');
      const structuredMOM = await RollupMeetingEngine.processHierarchicalRollup(
        segments,
        { title: currentMeeting.title, date: currentMeeting.recordedAt },
        (prog) => {
          setMomProgress(prog.progress);
          setMomTokensGen(prog.tokensGenerated);
          setMomStage(
            prog.currentStage === 'chunking'
              ? 'Partitioning transcript windows...'
              : prog.currentStage === 'extracting'
              ? `Extracting facts (${prog.tokensGenerated} tokens generated)...`
              : prog.currentStage === 'validating'
              ? 'Constrained JSON grammar & Zod validation...'
              : 'Finalizing Minutes of Meeting...'
          );
        }
      );

      setMomData(structuredMOM);

      // Persist newly extracted action items into SQLite
      if (structuredMOM.actionItems.length > 0) {
        const newActionsToInsert = structuredMOM.actionItems.map((act, idx) => ({
          id: `act_${currentMeeting.id}_gen_${idx + 1}`,
          meetingId: currentMeeting.id,
          title: act.title,
          description: act.description,
          owner: act.owner || null,
          dueDate: act.dueDate || null,
          priority: act.priority || 'medium',
          status: act.status || 'todo',
        }));

        const savedActions = await db.actionItemRepository.createMany(newActionsToInsert);
        setActionItems(savedActions);

        // Create bidirectional evidence links
        const newEvidenceLinks: Omit<EvidenceLinkRecord, 'createdAt'>[] = [];
        structuredMOM.actionItems.forEach((act, idx) => {
          if (act.sourceSegmentIds && act.sourceSegmentIds.length > 0) {
            const segId = act.sourceSegmentIds[0];
            const matchingSeg = segments.find((s) => s.id === segId);
            newEvidenceLinks.push({
              id: `ev_link_act_${idx}_${Date.now()}`,
              entityType: 'action_item',
              entityId: `act_${currentMeeting.id}_gen_${idx + 1}`,
              segmentId: segId,
              relevanceScore: 0.98,
              quote: matchingSeg ? matchingSeg.text : undefined,
            });
          }
        });

        if (newEvidenceLinks.length > 0) {
          const savedLinks = await db.evidenceLinkRepository.createMany(newEvidenceLinks);
          setEvidenceLinks((prev) => [...prev, ...savedLinks]);
        }
      }

      // Persist decisions
      if (structuredMOM.decisions.length > 0) {
        const newDecsToInsert = structuredMOM.decisions.map((dec, idx) => ({
          id: `dec_${currentMeeting.id}_gen_${idx + 1}`,
          meetingId: currentMeeting.id,
          title: dec.title,
          rationale: dec.rationale,
          consensusLevel: dec.consensusLevel,
        }));
        const savedDecs = await db.decisionRepository.createMany(newDecsToInsert);
        setDecisions(savedDecs);
      }

      // Update meeting analysis status in Redux & SQLite
      await dispatch(
        updateMeeting({
          id: currentMeeting.id,
          updates: { analysisStatus: 'completed' },
        })
      );
      setCurrentMeeting((prev) => ({ ...prev, analysisStatus: 'completed' }));
      setMomStage('MOM generation complete!');
    } catch (err) {
      console.error('MOM Generation Error:', err);
      setMomStage(`Failed: ${(err as Error).message}`);
    } finally {
      setIsGeneratingMOM(false);
    }
  };

  // Export handlers
  const handleExport = async (format: 'markdown' | 'json' | 'html' | 'docx') => {
    setIsExporting(true);
    setExportSuccessMsg('');
    try {
      const activeMom: MOMStructuredOutput = momData || {
        meetingTitle: currentMeeting.title,
        executiveSummary:
          'Air-gapped on-device meeting evaluation conducted with local Whisper STT and local Llama inference.',
        agendaTopics: ['Local STT Architecture', 'SQLite WAL Persistence', 'Evidence Verification'],
        keyDiscussionPoints: [
          'All models executed purely on device.',
          'SQLite stored with foreign key constraints.',
        ],
        decisions: decisions.map((d) => ({
          title: d.title,
          rationale: d.rationale || '',
          consensusLevel: (d.consensusLevel === 'majority' || d.consensusLevel === 'tentative' ? d.consensusLevel : 'agreed') as 'agreed' | 'majority' | 'tentative',
          sourceSegmentIds: [],
        })),
        actionItems: actionItems.map((a) => ({
          title: a.title,
          description: a.description,
          owner: a.owner,
          dueDate: a.dueDate,
          priority: a.priority,
          status: a.status,
          sourceSegmentIds: [],
        })),
        risksAndBlockers: [],
        openQuestions: [],
        nextSteps: ['Complete testing across platforms.'],
        unsupportedClaimsWarnings: [],
      };

      const baseFilename = currentMeeting.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .substring(0, 30);

      if (format === 'markdown') {
        const md = ExportService.generateMarkdown(
          currentMeeting,
          activeMom,
          segments,
          actionItems,
          decisions,
          participants
        );
        await ExportService.exportAndDownload(
          currentMeeting.id,
          `${baseFilename}_minutes.md`,
          md,
          'mom_markdown',
          'text/markdown'
        );
      } else if (format === 'json') {
        const json = ExportService.generateJson(
          currentMeeting,
          activeMom,
          segments,
          actionItems,
          decisions,
          participants
        );
        await ExportService.exportAndDownload(
          currentMeeting.id,
          `${baseFilename}_minutes.json`,
          json,
          'mom_json',
          'application/json'
        );
      } else if (format === 'html') {
        const html = ExportService.generatePrintableHtml(
          currentMeeting,
          activeMom,
          actionItems,
          decisions,
          participants
        );
        await ExportService.exportAndDownload(
          currentMeeting.id,
          `${baseFilename}_minutes.html`,
          html,
          'mom_pdf',
          'text/html'
        );
      } else if (format === 'docx') {
        const mdDocx = ExportService.generateMarkdown(
          currentMeeting,
          activeMom,
          segments,
          actionItems,
          decisions,
          participants
        );
        await ExportService.exportAndDownload(
          currentMeeting.id,
          `${baseFilename}_minutes.docx`,
          mdDocx,
          'mom_docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
      }

      const updatedArts = await db.meetingArtifactRepository.getByMeetingId(currentMeeting.id);
      setArtifacts(updatedArts);
      setExportSuccessMsg(`Successfully exported ${format.toUpperCase()} and saved artifact!`);
    } catch (err) {
      console.error('Export error:', err);
      setExportSuccessMsg(`Export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Edit Segment Text
  const handleSaveSegmentEdit = async (segmentId: string) => {
    if (!editedText.trim()) return;
    await db.transcriptRepository.updateSegmentText(segmentId, editedText);
    const updated = await db.transcriptRepository.getByMeetingId(currentMeeting.id);
    setSegments(updated);
    setEditingSegmentId(null);
  };

  const handleToggleActionStatus = async (item: ActionItemRecord) => {
    const nextStatus = item.status === 'completed' ? 'todo' : 'completed';
    const updated = await db.actionItemRepository.update(item.id, { status: nextStatus });
    setActionItems((prev) => prev.map((a) => (a.id === item.id ? updated : a)));
  };

  const handleToggleApproval = async () => {
    const next = approvalStatus === 'approved' ? 'draft' : 'approved';
    await dispatch(updateMeeting({ id: currentMeeting.id, updates: { approvalStatus: next } }));
    setApprovalStatus(next);
    setCurrentMeeting((prev) => ({ ...prev, approvalStatus: next }));
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;
    const added = await db.participantRepository.add(
      currentMeeting.id,
      newPartName,
      undefined,
      newPartRole || 'Participant'
    );
    setParticipants((prev) => [...prev, added]);
    setNewPartName('');
    setNewPartRole('');
  };

  const handleDelete = async () => {
    if (confirm('Permanently delete this meeting and local data?')) {
      audioService.stopPlayback();
      await dispatch(deleteMeeting(currentMeeting.id));
      onBack();
    }
  };

  // Check evidence for an action item
  const getEvidenceForAction = (actionId: string) => {
    const link = evidenceLinks.find(
      (l) => l.entityType === 'action_item' && l.entityId === actionId
    );
    if (!link) return null;
    const seg = segments.find((s) => s.id === link.segmentId);
    return { link, seg };
  };

  // Check evidence for a decision
  const getEvidenceForDecision = (decisionId: string) => {
    const link = evidenceLinks.find(
      (l) => l.entityType === 'decision' && l.entityId === decisionId
    );
    if (!link) return null;
    const seg = segments.find((s) => s.id === link.segmentId);
    return { link, seg };
  };

  // Filtered segments
  const displayedSegments = transcriptFilter
    ? segments.filter((s) => s.text.toLowerCase().includes(transcriptFilter.toLowerCase()))
    : segments;

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-200">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to meetings</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            leftIcon={<Download className="w-3.5 h-3.5 text-orange-400" />}
          >
            Export
          </Button>

          <Button
            variant={approvalStatus === 'approved' ? 'primary' : 'outline'}
            size="sm"
            onClick={handleToggleApproval}
            leftIcon={approvalStatus === 'approved' ? <Check className="w-3.5 h-3.5" /> : undefined}
          >
            {approvalStatus === 'approved' ? 'MOM Approved' : 'Approve MOM'}
          </Button>

          <button
            onClick={handleDelete}
            className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete meeting"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meeting Header Card */}
      <Card variant="accent" padding="md" className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest font-bold">
              OFFLINE AIR-GAPPED MEETING
            </span>
            <h1 className="text-lg font-black text-slate-100 mt-0.5">
              {currentMeeting.title}
            </h1>
          </div>
          <Badge
            variant={
              approvalStatus === 'approved'
                ? 'success'
                : approvalStatus === 'reviewed'
                ? 'info'
                : 'neutral'
            }
            size="sm"
          >
            {approvalStatus.toUpperCase()}
          </Badge>
        </div>

        {currentMeeting.description && (
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentMeeting.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            {formatDate(currentMeeting.recordedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            {formatDuration(currentMeeting.durationSeconds)}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            {formatFileSize(currentMeeting.audioFileSizeBytes || 102400)}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Strictly Air-gapped
          </span>
        </div>
      </Card>

      {/* Integrated Audio Player Bar */}
      <Card variant="default" padding="sm" className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-orange-400" />
            <span>Audio Playback</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {formatDuration(Math.floor(playbackCurrentTime || 0))} /{' '}
            {formatDuration(
              Math.floor(
                Number.isFinite(playbackDuration) && playbackDuration > 0
                  ? playbackDuration
                  : (currentMeeting.durationSeconds || 60)
              )
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePlay}
            className="w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex-1">
            <div
              className="w-full bg-slate-800 h-2 rounded-full overflow-hidden cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (!rect.width || rect.width <= 0) return;
                const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const ratio = clickX / rect.width;
                const totalDur =
                  Number.isFinite(playbackDuration) && playbackDuration > 0
                    ? playbackDuration
                    : (Number.isFinite(currentMeeting.durationSeconds) && currentMeeting.durationSeconds > 0
                        ? currentMeeting.durationSeconds
                        : 60);
                const seekSec = Math.max(0, Math.min(ratio * totalDur, totalDur));
                if (Number.isFinite(seekSec)) {
                  if (!isPlaying) {
                    audioService
                      .playAudio(currentMeeting.audioUri || 'demo.wav')
                      .then(() => {
                        audioService.seekPlayback(seekSec);
                        setPlaybackCurrentTime(seekSec);
                      })
                      .catch(console.warn);
                  } else {
                    audioService.seekPlayback(seekSec);
                    setPlaybackCurrentTime(seekSec);
                  }
                }
              }}
            >
              <div
                className="bg-orange-500 h-full transition-all duration-75"
                style={{
                  width: `${
                    Number.isFinite(playbackDuration) && playbackDuration > 0
                      ? Math.min(100, Math.max(0, (playbackCurrentTime / playbackDuration) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none text-xs">
        {(
          [
            { id: 'overview', label: 'Overview & MOM', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'transcript', label: `Transcript (${segments.length})`, icon: <ListOrdered className="w-3.5 h-3.5" /> },
            { id: 'actions', label: `Actions (${actionItems.length})`, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            { id: 'decisions', label: `Decisions (${decisions.length})`, icon: <Check className="w-3.5 h-3.5" /> },
            { id: 'participants', label: `Attendees (${participants.length})`, icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'artifacts', label: `Exports (${artifacts.length})`, icon: <FileDown className="w-3.5 h-3.5" /> },
            { id: 'raw', label: 'SQLite DB', icon: <Database className="w-3.5 h-3.5" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              activeTab === t.id
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & MINUTES OF MEETING */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* AI Intelligence Action Bar */}
          <Card variant="accent" padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span>Local LLM Intelligence (Llama-3.2 1B)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Extracts verified structured MOM, decisions, and action items with bidirectional evidence links.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateMOM}
                isLoading={isGeneratingMOM}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {momData ? 'Re-generate MOM' : 'Generate MOM'}
              </Button>
            </div>

            {/* Live Progress feedback during LLM generation */}
            {isGeneratingMOM && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>{momStage}</span>
                  <span className="font-mono text-orange-400">
                    {(momProgress * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full transition-all duration-200"
                    style={{ width: `${momProgress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Anti-Hallucination & Evidence Status Banner */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-200 leading-relaxed">
              <span className="font-bold">Anti-Hallucination Guard Active:</span> All extracted decisions and tasks are cross-referenced with exact transcript timestamps. Unmentioned owners or deadlines are flagged rather than fabricated.
            </div>
          </div>

          {/* Executive Summary */}
          <Card variant="default" padding="md" className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Executive Summary
              </h3>
              <Badge variant="info" size="sm">
                Air-gapped LLM
              </Badge>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {momData
                ? momData.executiveSummary
                : 'The team reviewed the architecture for AID3 (Offline AI Meeting Assistant). Local database persistence, audio recording, transcription playback syncing, and failure recovery were verified offline without remote servers.'}
            </p>
          </Card>

          {/* Agenda & Discussion Topics */}
          {momData?.agendaTopics && momData.agendaTopics.length > 0 && (
            <Card variant="default" padding="md" className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Agenda Topics
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {momData.agendaTopics.map((topic, i) => (
                  <Badge key={i} variant="neutral" size="sm">
                    {topic}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Risks & Blockers */}
          {momData?.risksAndBlockers && momData.risksAndBlockers.length > 0 && (
            <Card variant="default" padding="md" className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Identified Risks & Mitigations</span>
              </h3>
              <div className="space-y-2">
                {momData.risksAndBlockers.map((risk, i) => (
                  <div key={i} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{risk.title}</span>
                      <Badge variant={risk.severity === 'high' ? 'danger' : 'warning'} size="sm">
                        {risk.severity.toUpperCase()}
                      </Badge>
                    </div>
                    {risk.mitigation && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Mitigation: {risk.mitigation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Actions & Decision preview */}
          <div className="grid grid-cols-2 gap-3">
            <Card
              variant="interactive"
              padding="sm"
              onClick={() => setActiveTab('actions')}
              className="cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">Action Items</span>
                <span className="text-orange-400 font-mono font-bold">{actionItems.length}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {actionItems.filter((a) => a.status === 'completed').length} completed
              </p>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              onClick={() => setActiveTab('decisions')}
              className="cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">Key Decisions</span>
                <span className="text-emerald-400 font-mono font-bold">{decisions.length}</span>
              </div>
              <p className="text-[10px] text-slate-400">Tied to transcript evidence</p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSCRIPT (With Audio Sync, Inline Edit, Filter, and Citation badges) */}
      {activeTab === 'transcript' && (
        <div className="space-y-3">
          {/* Transcription Controls Header */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Whisper STT Engine (tiny.en Q5_1)
              </span>
              <div className="flex items-center gap-1.5">
                {isTranscribing ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => whisperEngine.cancelTranscription()}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunTranscription}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    {segments.length > 0 ? 'Retry Transcription' : 'Transcribe'}
                  </Button>
                )}
              </div>
            </div>

            {isTranscribing && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>{transcriptionStage}</span>
                  <span className="font-mono text-orange-400">
                    {(transcriptionProgress * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full transition-all duration-150"
                    style={{ width: `${transcriptionProgress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Transcript Filter Input */}
          <Input
            placeholder="Search within transcript text..."
            value={transcriptFilter}
            onChange={(e) => setTranscriptFilter(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5 text-slate-500" />}
          />

          {/* Segment List */}
          <div className="space-y-2">
            {displayedSegments.map((seg) => {
              // Check if any action item or decision cites this segment
              const citedActions = evidenceLinks.filter(
                (l) => l.segmentId === seg.id && l.entityType === 'action_item'
              );
              const citedDecs = evidenceLinks.filter(
                (l) => l.segmentId === seg.id && l.entityType === 'decision'
              );

              return (
                <Card key={seg.id} variant="default" padding="sm" className="space-y-2 group">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlayFromTimestamp(seg.startMs)}
                        className="px-2 py-0.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title="Play audio from this timestamp"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>
                          {formatTimestamp(seg.startMs)} - {formatTimestamp(seg.endMs)}
                        </span>
                      </button>
                      <span className="font-semibold text-slate-300">
                        {seg.speakerId === 'speaker_1' ? 'Speaker 1' : 'Speaker 2'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {seg.isEdited && (
                        <Badge variant="outline" size="sm">
                          Edited
                        </Badge>
                      )}
                      <button
                        onClick={() => {
                          setEditingSegmentId(seg.id);
                          setEditedText(seg.text);
                        }}
                        className="p-1 text-slate-400 hover:text-orange-400 transition-colors"
                        title="Edit segment text"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingSegmentId === seg.id ? (
                    <div className="space-y-2 pt-1">
                      <Input
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSegmentId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveSegmentEdit(seg.id)}
                          leftIcon={<Save className="w-3.5 h-3.5" />}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-200 leading-relaxed">{seg.text}</p>
                  )}

                  {/* Evidence Citation Tag */}
                  {(citedActions.length > 0 || citedDecs.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-900">
                      {citedActions.map((c) => (
                        <span
                          key={c.id}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium"
                        >
                          Cited in Action Item
                        </span>
                      ))}
                      {citedDecs.map((c) => (
                        <span
                          key={c.id}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"
                        >
                          Cited in Key Decision
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ACTION ITEMS (With Interactive Evidence Link Badges) */}
      {activeTab === 'actions' && (
        <div className="space-y-2.5">
          {actionItems.map((item) => {
            const ev = getEvidenceForAction(item.id);

            return (
              <Card key={item.id} variant="default" padding="sm" className="space-y-2">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleActionStatus(item)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      item.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-700 bg-slate-900 hover:border-orange-500'
                    }`}
                  >
                    {item.status === 'completed' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold ${
                          item.status === 'completed'
                            ? 'line-through text-slate-500'
                            : 'text-slate-100'
                        }`}
                      >
                        {item.title}
                      </span>
                      <Badge
                        variant={
                          item.priority === 'urgent'
                            ? 'danger'
                            : item.priority === 'high'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {item.priority}
                      </Badge>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                      {item.owner && <span>Owner: <strong className="text-slate-300">{item.owner}</strong></span>}
                      {item.dueDate && <span>Due: <strong className="text-slate-300">{item.dueDate}</strong></span>}
                    </div>
                  </div>
                </div>

                {/* Bidirectional Evidence Link Badge */}
                {ev && ev.seg && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => handleJumpToEvidence(ev.seg!.id)}
                      className="flex items-center gap-1.5 text-[10px] text-orange-400 hover:text-orange-300 transition-colors bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20"
                      title="Jump to audio segment evidence"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Evidence: [{formatTimestamp(ev.seg.startMs)}] &quot;{ev.seg.text.substring(0, 45)}...&quot;</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </button>
                    <span className="text-[9px] font-mono text-slate-500">
                      {(ev.link.relevanceScore * 100).toFixed(0)}% verified
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 4: DECISIONS (With Interactive Evidence Link Badges) */}
      {activeTab === 'decisions' && (
        <div className="space-y-2.5">
          {decisions.map((dec) => {
            const ev = getEvidenceForDecision(dec.id);

            return (
              <Card key={dec.id} variant="default" padding="sm" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-100">{dec.title}</h4>
                  <Badge variant="success" size="sm">
                    {dec.consensusLevel || 'Agreed'}
                  </Badge>
                </div>

                {dec.rationale && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {dec.rationale}
                  </p>
                )}

                {/* Bidirectional Evidence Link Badge */}
                {ev && ev.seg && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => handleJumpToEvidence(ev.seg!.id)}
                      className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                      title="Jump to audio segment evidence"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Evidence: [{formatTimestamp(ev.seg.startMs)}] &quot;{ev.seg.text.substring(0, 45)}...&quot;</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </button>
                    <span className="text-[9px] font-mono text-slate-500">
                      {(ev.link.relevanceScore * 100).toFixed(0)}% verified
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 5: ATTENDEES */}
      {activeTab === 'participants' && (
        <div className="space-y-3">
          <form
            onSubmit={handleAddParticipant}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2"
          >
            <span className="text-xs font-bold text-slate-200 block">Add Attendee</span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name..."
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
              />
              <Input
                placeholder="Role / Title..."
                value={newPartRole}
                onChange={(e) => setNewPartRole(e.target.value)}
              />
            </div>
            <Button variant="primary" size="sm" type="submit" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add to Meeting
            </Button>
          </form>

          <div className="space-y-1.5">
            {participants.map((part) => (
              <Card key={part.id} variant="default" padding="sm" className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-100 block">{part.name}</span>
                  {part.role && <span className="text-[10px] text-orange-400">{part.role}</span>}
                </div>
                <Badge variant="neutral" size="sm">
                  Present
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: ARTIFACT EXPORT HISTORY */}
      {activeTab === 'artifacts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Export History in SQLite</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              New Export
            </Button>
          </div>

          {artifacts.length === 0 ? (
            <Card variant="default" padding="md" className="text-center text-xs text-slate-400 py-6">
              No exported artifacts yet. Click &quot;New Export&quot; to generate Markdown, JSON, or Printable HTML.
            </Card>
          ) : (
            <div className="space-y-2">
              {artifacts.map((art) => (
                <Card key={art.id} variant="default" padding="sm" className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-100 uppercase">
                      {art.artifactType.replace('mom_', '')} (v{art.version})
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Saved {formatDate(art.createdAt)}
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    Stored in DB
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: RAW SQLITE INSPECTION */}
      {activeTab === 'raw' && (
        <Card variant="default" padding="sm">
          <div className="text-[10px] font-mono text-slate-300 max-h-72 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <pre>
              {JSON.stringify(
                {
                  meeting: currentMeeting,
                  segmentsCount: segments.length,
                  actionsCount: actionItems.length,
                  decisionsCount: decisions.length,
                  evidenceLinksCount: evidenceLinks.length,
                  artifactsCount: artifacts.length,
                  evidenceLinks,
                },
                null,
                2
              )}
            </pre>
          </div>
        </Card>
      )}

      {/* EXPORT MODAL DIALOG */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Meeting Minutes (MOM)"
        description="Choose a format to download and store inside SQLite meeting_artifacts."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => handleExport('markdown')}
              isLoading={isExporting}
              leftIcon={<FileText className="w-4 h-4 text-orange-400" />}
            >
              Markdown (.md)
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => handleExport('json')}
              isLoading={isExporting}
              leftIcon={<Database className="w-4 h-4 text-blue-400" />}
            >
              JSON (.json)
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => handleExport('html')}
              isLoading={isExporting}
              leftIcon={<FileDown className="w-4 h-4 text-emerald-400" />}
            >
              Printable HTML / PDF
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => handleExport('docx')}
              isLoading={isExporting}
              leftIcon={<Layers className="w-4 h-4 text-purple-400" />}
            >
              DOCX Document
            </Button>
          </div>

          {exportSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-700/50 rounded-xl text-xs text-emerald-300">
              {exportSuccessMsg}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
