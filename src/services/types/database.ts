import { TranscriptSegment } from './stt.ts';
import { ActionItemDraft, DecisionDraft } from './llm.ts';
import { ProcessingJob, JobEvent } from './queue.ts';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'completed' | 'interrupted' | 'error';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ApprovalStatus = 'draft' | 'reviewed' | 'approved';

export interface MeetingRecord {
  id: string;
  title: string;
  description?: string;
  recordedAt: string;
  durationSeconds: number;
  audioUri?: string;
  audioFileSizeBytes?: number;
  audioSampleRate?: number;
  recordingStatus: RecordingStatus;
  transcriptionStatus: TranscriptionStatus;
  analysisStatus: AnalysisStatus;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantRecord {
  id: string;
  meetingId: string;
  name: string;
  email?: string;
  role?: string;
  createdAt: string;
}

export interface RecordingCheckpointRecord {
  id: string;
  meetingId: string;
  audioUri: string;
  chunkIndex: number;
  durationSeconds: number;
  isRecovered: boolean;
  createdAt: string;
}

export interface ActionItemRecord {
  id: string;
  meetingId: string;
  title: string;
  description?: string;
  owner?: string | null;
  dueDate?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRecord {
  id: string;
  meetingId: string;
  title: string;
  rationale?: string;
  consensusLevel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceLinkRecord {
  id: string;
  entityType: 'action_item' | 'decision' | 'risk' | 'summary';
  entityId: string;
  segmentId: string;
  relevanceScore: number;
  quote?: string;
  createdAt: string;
}

export interface MeetingArtifactRecord {
  id: string;
  meetingId: string;
  artifactType: 'mom_json' | 'mom_markdown' | 'mom_pdf' | 'mom_docx';
  version: number;
  content: string;
  createdAt: string;
}

export interface Migration {
  version: number;
  name: string;
  up: (db: IDatabaseConnection) => Promise<void>;
  down?: (db: IDatabaseConnection) => Promise<void>;
}

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
  checksum: string;
}

export interface IDatabaseConnection {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(action: (tx: IDatabaseConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface IMeetingRepository {
  create(meeting: Omit<MeetingRecord, 'createdAt' | 'updatedAt'>): Promise<MeetingRecord>;
  getById(id: string): Promise<MeetingRecord | null>;
  getAll(filter?: { search?: string; status?: string }): Promise<MeetingRecord[]>;
  update(id: string, updates: Partial<MeetingRecord>): Promise<MeetingRecord>;
  rename(id: string, newTitle: string): Promise<MeetingRecord>;
  delete(id: string): Promise<boolean>;
}

export interface ITranscriptRepository {
  insertSegments(segments: TranscriptSegment[]): Promise<void>;
  getByMeetingId(meetingId: string): Promise<TranscriptSegment[]>;
  updateSegmentText(segmentId: string, newText: string): Promise<void>;
  clearSegmentsForMeeting(meetingId: string): Promise<void>;
  deleteByMeetingId(meetingId: string): Promise<void>;
}

export interface IActionItemRepository {
  createMany(items: Omit<ActionItemRecord, 'createdAt' | 'updatedAt'>[]): Promise<ActionItemRecord[]>;
  getByMeetingId(meetingId: string): Promise<ActionItemRecord[]>;
  getAll(filter?: { status?: string; priority?: string }): Promise<ActionItemRecord[]>;
  update(id: string, updates: Partial<ActionItemRecord>): Promise<ActionItemRecord>;
  delete(id: string): Promise<boolean>;
}

export interface IDecisionRepository {
  createMany(items: Omit<DecisionRecord, 'createdAt' | 'updatedAt'>[]): Promise<DecisionRecord[]>;
  getByMeetingId(meetingId: string): Promise<DecisionRecord[]>;
}

export interface IParticipantRepository {
  add(meetingId: string, name: string, email?: string, role?: string): Promise<ParticipantRecord>;
  getByMeetingId(meetingId: string): Promise<ParticipantRecord[]>;
  delete(id: string): Promise<boolean>;
}

export interface IRecordingCheckpointRepository {
  saveCheckpoint(meetingId: string, audioUri: string, durationSeconds: number, chunkIndex: number): Promise<RecordingCheckpointRecord>;
  getUnrecovered(): Promise<RecordingCheckpointRecord[]>;
  markRecovered(id: string): Promise<void>;
}

export interface IProcessingJobRepository {
  createJob(job: ProcessingJob): Promise<ProcessingJob>;
  updateJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;
  getJob(id: string): Promise<ProcessingJob | null>;
  getByMeetingId(meetingId: string): Promise<ProcessingJob[]>;
  getRunningJobs(): Promise<ProcessingJob[]>;
  markRunningAsInterrupted(): Promise<ProcessingJob[]>;
}

export interface IEvidenceLinkRepository {
  createMany(links: Omit<EvidenceLinkRecord, 'createdAt'>[]): Promise<EvidenceLinkRecord[]>;
  getByEntity(entityType: string, entityId: string): Promise<EvidenceLinkRecord[]>;
  getByMeetingId(meetingId: string): Promise<EvidenceLinkRecord[]>;
  deleteByEntity(entityType: string, entityId: string): Promise<boolean>;
}

export interface IMeetingArtifactRepository {
  saveArtifact(meetingId: string, artifactType: 'mom_json' | 'mom_markdown' | 'mom_pdf' | 'mom_docx', content: string): Promise<MeetingArtifactRecord>;
  getByMeetingId(meetingId: string): Promise<MeetingArtifactRecord[]>;
  getLatestByType(meetingId: string, artifactType: string): Promise<MeetingArtifactRecord | null>;
}

export interface ISettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}

export interface SearchResultItem {
  id: string;
  meetingId: string;
  type: 'meeting' | 'transcript' | 'action_item' | 'decision';
  title: string;
  snippet: string;
  timestampMs?: number;
  score?: number;
}

export interface ISearchRepository {
  searchAll(query: string): Promise<SearchResultItem[]>;
}
