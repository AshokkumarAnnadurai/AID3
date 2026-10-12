import {
  IDatabaseConnection,
  IMeetingRepository,
  ITranscriptRepository,
  IActionItemRepository,
  IDecisionRepository,
  ISettingsRepository,
  IParticipantRepository,
  IRecordingCheckpointRepository,
  IProcessingJobRepository,
  IEvidenceLinkRepository,
  IMeetingArtifactRepository,
  ISearchRepository,
  SearchResultItem,
  MeetingRecord,
  ActionItemRecord,
  DecisionRecord,
  MigrationRecord,
  ParticipantRecord,
  RecordingCheckpointRecord,
  EvidenceLinkRecord,
  MeetingArtifactRecord,
} from '../types/database.ts';
import { TranscriptSegment } from '../types/stt.ts';
import { ProcessingJob, JobEvent } from '../types/queue.ts';
import { migrations } from './migrations.ts';

// In-Memory & LocalStorage backed SQLite table store for browser/expo-web compatibility
// and native SQLite wrapper interface
interface StoredDatabase {
  tables: Record<string, Record<string, unknown>[]>;
}

const STORAGE_KEY = 'offline_ai_meeting_db_v1';

class LocalSQLiteEngine implements IDatabaseConnection {
  private data: StoredDatabase = { tables: {} };
  private initialized = false;

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.data = JSON.parse(raw);
        }
      }
    } catch {
      // Fallback to memory
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch {
      // Ignore in non-browser env
    }
  }

  public getTable(name: string): Record<string, unknown>[] {
    if (!this.data.tables[name]) {
      this.data.tables[name] = [];
    }
    return this.data.tables[name];
  }

  public setTable(name: string, records: Record<string, unknown>[]) {
    this.data.tables[name] = records;
    this.saveToStorage();
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    this.loadFromStorage();
    const cleanSql = sql.trim();

    // Table creation
    if (cleanSql.toUpperCase().startsWith('CREATE TABLE')) {
      const match = cleanSql.match(/CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1];
        if (!this.data.tables[tableName]) {
          this.data.tables[tableName] = [];
          this.saveToStorage();
        }
      }
      return;
    }

    // Insert or replace / insert into
    if (cleanSql.toUpperCase().startsWith('INSERT')) {
      const tableMatch = cleanSql.match(/INTO ([a-zA-Z0-9_]+)/i);
      if (!tableMatch) return;
      const tableName = tableMatch[1];
      const table = this.getTable(tableName);

      // Extract column names
      const colMatch = cleanSql.match(/\(([^)]+)\)\s*VALUES/i);
      const cols = colMatch
        ? colMatch[1].split(',').map((c) => c.trim().replace(/['"`]/g, ''))
        : [];

      const record: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        record[col] = params[idx] !== undefined ? params[idx] : null;
      });

      // Handle replace/unique by id or key
      const keyField = record.id !== undefined ? 'id' : record.key !== undefined ? 'key' : record.version !== undefined ? 'version' : null;
      if (keyField) {
        const existingIdx = table.findIndex((r) => r[keyField] === record[keyField]);
        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...record };
        } else {
          table.push(record);
        }
      } else {
        table.push(record);
      }
      this.saveToStorage();
      return;
    }

    // Delete
    if (cleanSql.toUpperCase().startsWith('DELETE FROM')) {
      const tableMatch = cleanSql.match(/FROM ([a-zA-Z0-9_]+)/i);
      if (!tableMatch) return;
      const tableName = tableMatch[1];
      const table = this.getTable(tableName);

      if (cleanSql.toUpperCase().includes('WHERE ID = ?') && params.length > 0) {
        this.setTable(tableName, table.filter((r) => r.id !== params[0]));
      } else if (cleanSql.toUpperCase().includes('WHERE MEETING_ID = ?') && params.length > 0) {
        this.setTable(tableName, table.filter((r) => r.meeting_id !== params[0] && r.meetingId !== params[0]));
      } else {
        this.setTable(tableName, []);
      }
      return;
    }

    // Update
    if (cleanSql.toUpperCase().startsWith('UPDATE')) {
      const tableMatch = cleanSql.match(/UPDATE ([a-zA-Z0-9_]+)/i);
      if (!tableMatch) return;
      const tableName = tableMatch[1];
      const table = this.getTable(tableName);

      if (cleanSql.toUpperCase().includes('WHERE ID = ?')) {
        const idVal = params[params.length - 1];
        const record = table.find((r) => r.id === idVal);
        if (record) {
          // generic update
          this.saveToStorage();
        }
      }
      return;
    }
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.loadFromStorage();
    const cleanSql = sql.trim();
    const tableMatch = cleanSql.match(/FROM ([a-zA-Z0-9_]+)/i);
    if (!tableMatch) return [];
    const tableName = tableMatch[1];
    const table = this.getTable(tableName);

    // Simple where filtering
    if (cleanSql.toUpperCase().includes('WHERE ID = ?') && params.length > 0) {
      return table.filter((r) => r.id === params[0]) as unknown as T[];
    }
    if (cleanSql.toUpperCase().includes('WHERE MEETING_ID = ?') && params.length > 0) {
      return table.filter((r) => r.meeting_id === params[0] || r.meetingId === params[0]) as unknown as T[];
    }
    if (cleanSql.toUpperCase().includes('WHERE KEY = ?') && params.length > 0) {
      return table.filter((r) => r.key === params[0]) as unknown as T[];
    }

    return [...table] as unknown as T[];
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async transaction<T>(action: (tx: IDatabaseConnection) => Promise<T>): Promise<T> {
    return await action(this);
  }

  async close(): Promise<void> {
    this.saveToStorage();
  }

  public resetDatabase(): void {
    this.data = { tables: {} };
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export class SQLiteService {
  private static instance: SQLiteService;
  private db: LocalSQLiteEngine;
  private isInitialized = false;

  private constructor() {
    this.db = new LocalSQLiteEngine();
  }

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  public async initialize(): Promise<MigrationRecord[]> {
    if (this.isInitialized) {
      return this.getAppliedMigrations();
    }

    // Run migrations
    const applied = await this.runMigrations();
    this.isInitialized = true;
    return applied;
  }

  public async runMigrations(): Promise<MigrationRecord[]> {
    // 1. Ensure migrations table exists
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        checksum TEXT NOT NULL
      );
    `);

    const appliedList: MigrationRecord[] = [];

    for (const migration of migrations) {
      const existing = await this.db.queryOne<MigrationRecord>(
        'SELECT * FROM schema_migrations WHERE version = ?',
        [migration.version]
      );

      if (!existing) {
        await migration.up(this.db);
        const record: MigrationRecord = {
          version: migration.version,
          name: migration.name,
          appliedAt: new Date().toISOString(),
          checksum: `sha256_v${migration.version}`,
        };

        await this.db.execute(
          `INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)`,
          [record.version, record.name, record.appliedAt, record.checksum]
        );

        appliedList.push(record);
      } else {
        appliedList.push(existing);
      }
    }

    return appliedList;
  }

  public async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const raw = await this.db.query<Record<string, unknown>>('SELECT * FROM schema_migrations');
    return raw.map((r) => ({
      version: Number(r.version),
      name: String(r.name),
      appliedAt: String(r.applied_at || r.appliedAt),
      checksum: String(r.checksum),
    }));
  }

  public resetAllData(): void {
    this.db.resetDatabase();
    this.isInitialized = false;
  }

  // Repository implementations
  public get meetingRepository(): IMeetingRepository {
    const db = this.db;
    return {
      async create(meeting): Promise<MeetingRecord> {
        const now = new Date().toISOString();
        const record: MeetingRecord = {
          ...meeting,
          createdAt: now,
          updatedAt: now,
        };
        const table = db.getTable('meetings');
        table.unshift(record as unknown as Record<string, unknown>);
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return record;
      },
      async getById(id: string): Promise<MeetingRecord | null> {
        const table = db.getTable('meetings');
        const found = table.find((m) => m.id === id);
        return found ? (found as unknown as MeetingRecord) : null;
      },
      async getAll(filter): Promise<MeetingRecord[]> {
        const table = db.getTable('meetings');
        let records = [...table] as unknown as MeetingRecord[];

        if (filter?.search) {
          const q = filter.search.toLowerCase();
          records = records.filter(
            (m) => m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q))
          );
        }
        if (filter?.status) {
          records = records.filter((m) => m.approvalStatus === filter.status);
        }

        return records;
      },
      async update(id: string, updates: Partial<MeetingRecord>): Promise<MeetingRecord> {
        const table = db.getTable('meetings');
        const idx = table.findIndex((m) => m.id === id);
        if (idx === -1) throw new Error(`Meeting ${id} not found`);
        const updated = {
          ...table[idx],
          ...updates,
          updatedAt: new Date().toISOString(),
        } as unknown as MeetingRecord;
        table[idx] = updated as unknown as Record<string, unknown>;
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return updated;
      },
      async rename(id: string, newTitle: string): Promise<MeetingRecord> {
        const table = db.getTable('meetings');
        const idx = table.findIndex((m) => m.id === id);
        if (idx === -1) throw new Error(`Meeting ${id} not found`);
        const updated = {
          ...table[idx],
          title: newTitle.trim(),
          updatedAt: new Date().toISOString(),
        } as unknown as MeetingRecord;
        table[idx] = updated as unknown as Record<string, unknown>;
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return updated;
      },
      async delete(id: string): Promise<boolean> {
        const table = db.getTable('meetings');
        const initialLen = table.length;
        db.setTable('meetings', table.filter((m) => m.id !== id));
        // cascade delete segments, actions, participants, and checkpoints
        const segs = db.getTable('transcript_segments');
        db.setTable('transcript_segments', segs.filter((s) => s.meeting_id !== id && s.meetingId !== id));
        const actions = db.getTable('action_items');
        db.setTable('action_items', actions.filter((a) => a.meeting_id !== id && a.meetingId !== id));
        const parts = db.getTable('participants');
        db.setTable('participants', parts.filter((p) => p.meeting_id !== id && p.meetingId !== id));
        const checkpts = db.getTable('recording_checkpoints');
        db.setTable('recording_checkpoints', checkpts.filter((c) => c.meeting_id !== id && c.meetingId !== id));
        return db.getTable('meetings').length < initialLen;
      },
    };
  }

  public get transcriptRepository(): ITranscriptRepository {
    const db = this.db;
    return {
      async insertSegments(segments: TranscriptSegment[]): Promise<void> {
        const table = db.getTable('transcript_segments');
        for (const seg of segments) {
          const idx = table.findIndex((s) => s.id === seg.id);
          if (idx >= 0) {
            table[idx] = seg as unknown as Record<string, unknown>;
          } else {
            table.push(seg as unknown as Record<string, unknown>);
          }
        }
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
      },
      async getByMeetingId(meetingId: string): Promise<TranscriptSegment[]> {
        const table = db.getTable('transcript_segments');
        const records = table.filter((s) => s.meeting_id === meetingId || s.meetingId === meetingId);
        return (records as unknown as TranscriptSegment[]).sort((a, b) => a.startMs - b.startMs);
      },
      async updateSegmentText(segmentId: string, newText: string): Promise<void> {
        const table = db.getTable('transcript_segments');
        const seg = table.find((s) => s.id === segmentId) as unknown as TranscriptSegment | undefined;
        if (seg) {
          if (!seg.isEdited) {
            seg.originalText = seg.text;
          }
          seg.text = newText;
          seg.isEdited = true;
          seg.updatedAt = new Date().toISOString();
          (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        }
      },
      async clearSegmentsForMeeting(meetingId: string): Promise<void> {
        const table = db.getTable('transcript_segments');
        db.setTable('transcript_segments', table.filter((s) => s.meeting_id !== meetingId && s.meetingId !== meetingId));
      },
      async deleteByMeetingId(meetingId: string): Promise<void> {
        const table = db.getTable('transcript_segments');
        db.setTable('transcript_segments', table.filter((s) => s.meeting_id !== meetingId && s.meetingId !== meetingId));
      },
    };
  }

  public get actionItemRepository(): IActionItemRepository {
    const db = this.db;
    return {
      async createMany(items): Promise<ActionItemRecord[]> {
        const now = new Date().toISOString();
        const table = db.getTable('action_items');
        const created: ActionItemRecord[] = items.map((item) => ({
          ...item,
          createdAt: now,
          updatedAt: now,
        }));
        table.push(...(created as unknown as Record<string, unknown>[]));
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return created;
      },
      async getByMeetingId(meetingId: string): Promise<ActionItemRecord[]> {
        const table = db.getTable('action_items');
        return table.filter((a) => a.meeting_id === meetingId || a.meetingId === meetingId) as unknown as ActionItemRecord[];
      },
      async getAll(filter): Promise<ActionItemRecord[]> {
        let table = db.getTable('action_items') as unknown as ActionItemRecord[];
        if (filter?.status) {
          table = table.filter((a) => a.status === filter.status);
        }
        if (filter?.priority) {
          table = table.filter((a) => a.priority === filter.priority);
        }
        return table;
      },
      async update(id: string, updates: Partial<ActionItemRecord>): Promise<ActionItemRecord> {
        const table = db.getTable('action_items');
        const idx = table.findIndex((a) => a.id === id);
        if (idx === -1) throw new Error(`Action item ${id} not found`);
        const updated = {
          ...table[idx],
          ...updates,
          updatedAt: new Date().toISOString(),
        } as unknown as ActionItemRecord;
        table[idx] = updated as unknown as Record<string, unknown>;
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return updated;
      },
      async delete(id: string): Promise<boolean> {
        const table = db.getTable('action_items');
        const len = table.length;
        db.setTable('action_items', table.filter((a) => a.id !== id));
        return db.getTable('action_items').length < len;
      },
    };
  }

  public get decisionRepository(): IDecisionRepository {
    const db = this.db;
    return {
      async createMany(items): Promise<DecisionRecord[]> {
        const now = new Date().toISOString();
        const table = db.getTable('decisions');
        const created: DecisionRecord[] = items.map((item) => ({
          ...item,
          createdAt: now,
          updatedAt: now,
        }));
        table.push(...(created as unknown as Record<string, unknown>[]));
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return created;
      },
      async getByMeetingId(meetingId: string): Promise<DecisionRecord[]> {
        const table = db.getTable('decisions');
        return table.filter((d) => d.meeting_id === meetingId || d.meetingId === meetingId) as unknown as DecisionRecord[];
      },
    };
  }

  public get settingsRepository(): ISettingsRepository {
    const db = this.db;
    return {
      async get(key: string): Promise<string | null> {
        const table = db.getTable('application_settings');
        const found = table.find((s) => s.key === key);
        return found ? String(found.value) : null;
      },
      async set(key: string, value: string): Promise<void> {
        const table = db.getTable('application_settings');
        const idx = table.findIndex((s) => s.key === key);
        const record = { key, value, updated_at: new Date().toISOString() };
        if (idx >= 0) {
          table[idx] = record;
        } else {
          table.push(record);
        }
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
      },
      async getAll(): Promise<Record<string, string>> {
        const table = db.getTable('application_settings');
        const result: Record<string, string> = {};
        for (const item of table) {
          if (item.key) {
            result[String(item.key)] = String(item.value);
          }
        }
        return result;
      },
    };
  }

  public get participantRepository(): IParticipantRepository {
    const db = this.db;
    return {
      async add(meetingId: string, name: string, email?: string, role?: string): Promise<ParticipantRecord> {
        const table = db.getTable('participants');
        const record: ParticipantRecord = {
          id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          meetingId,
          name: name.trim(),
          email: email?.trim(),
          role: role?.trim(),
          createdAt: new Date().toISOString(),
        };
        table.push(record as unknown as Record<string, unknown>);
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return record;
      },
      async getByMeetingId(meetingId: string): Promise<ParticipantRecord[]> {
        const table = db.getTable('participants');
        return table.filter((p) => p.meetingId === meetingId || p.meeting_id === meetingId) as unknown as ParticipantRecord[];
      },
      async delete(id: string): Promise<boolean> {
        const table = db.getTable('participants');
        const len = table.length;
        db.setTable('participants', table.filter((p) => p.id !== id));
        return db.getTable('participants').length < len;
      },
    };
  }

  public get recordingCheckpointRepository(): IRecordingCheckpointRepository {
    const db = this.db;
    return {
      async saveCheckpoint(meetingId: string, audioUri: string, durationSeconds: number, chunkIndex: number): Promise<RecordingCheckpointRecord> {
        const table = db.getTable('recording_checkpoints');
        const record: RecordingCheckpointRecord = {
          id: `ckpt_${meetingId}_${chunkIndex}`,
          meetingId,
          audioUri,
          chunkIndex,
          durationSeconds,
          isRecovered: false,
          createdAt: new Date().toISOString(),
        };
        const idx = table.findIndex((c) => c.meetingId === meetingId && c.chunkIndex === chunkIndex);
        if (idx >= 0) {
          table[idx] = record as unknown as Record<string, unknown>;
        } else {
          table.push(record as unknown as Record<string, unknown>);
        }
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return record;
      },
      async getUnrecovered(): Promise<RecordingCheckpointRecord[]> {
        const table = db.getTable('recording_checkpoints');
        return table.filter((c) => !c.isRecovered && !c.is_recovered) as unknown as RecordingCheckpointRecord[];
      },
      async markRecovered(id: string): Promise<void> {
        const table = db.getTable('recording_checkpoints');
        const found = table.find((c) => c.id === id);
        if (found) {
          found.isRecovered = true;
          found.is_recovered = 1;
          (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        }
      },
    };
  }

  public get processingJobRepository(): IProcessingJobRepository {
    const db = this.db;
    return {
      async createJob(job: ProcessingJob): Promise<ProcessingJob> {
        const table = db.getTable('processing_jobs');
        table.push(job as unknown as Record<string, unknown>);
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return job;
      },
      async updateJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
        const table = db.getTable('processing_jobs');
        const idx = table.findIndex((j) => j.id === id);
        if (idx === -1) throw new Error(`Job ${id} not found`);
        const updated = {
          ...table[idx],
          ...updates,
          updatedAt: new Date().toISOString(),
        } as unknown as ProcessingJob;
        table[idx] = updated as unknown as Record<string, unknown>;
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return updated;
      },
      async getJob(id: string): Promise<ProcessingJob | null> {
        const table = db.getTable('processing_jobs');
        const found = table.find((j) => j.id === id);
        return found ? (found as unknown as ProcessingJob) : null;
      },
      async getByMeetingId(meetingId: string): Promise<ProcessingJob[]> {
        const table = db.getTable('processing_jobs');
        return table.filter((j) => j.meetingId === meetingId || j.meeting_id === meetingId) as unknown as ProcessingJob[];
      },
      async getRunningJobs(): Promise<ProcessingJob[]> {
        const table = db.getTable('processing_jobs');
        return table.filter((j) => j.status === 'running') as unknown as ProcessingJob[];
      },
      async markRunningAsInterrupted(): Promise<ProcessingJob[]> {
        const table = db.getTable('processing_jobs');
        const interrupted: ProcessingJob[] = [];
        for (const job of table) {
          if (job.status === 'running') {
            job.status = 'interrupted';
            job.stageName = 'Interrupted by application restart';
            job.updatedAt = new Date().toISOString();
            interrupted.push(job as unknown as ProcessingJob);
          }
        }
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return interrupted;
      },
    };
  }

  public get evidenceLinkRepository(): IEvidenceLinkRepository {
    const db = this.db;
    return {
      async createMany(links): Promise<EvidenceLinkRecord[]> {
        const now = new Date().toISOString();
        const table = db.getTable('evidence_links');
        const created: EvidenceLinkRecord[] = links.map((l) => ({
          ...l,
          createdAt: now,
        }));
        table.push(...(created as unknown as Record<string, unknown>[]));
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return created;
      },
      async getByEntity(entityType: string, entityId: string): Promise<EvidenceLinkRecord[]> {
        const table = db.getTable('evidence_links');
        return table.filter(
          (l) => (l.entityType === entityType || l.entity_type === entityType) && (l.entityId === entityId || l.entity_id === entityId)
        ) as unknown as EvidenceLinkRecord[];
      },
      async getByMeetingId(meetingId: string): Promise<EvidenceLinkRecord[]> {
        // Link to segments belonging to meetingId
        const segs = db.getTable('transcript_segments').filter(
          (s) => s.meeting_id === meetingId || s.meetingId === meetingId
        );
        const segIds = new Set(segs.map((s) => s.id));
        const table = db.getTable('evidence_links');
        return table.filter((l) => segIds.has(String(l.segmentId || l.segment_id))) as unknown as EvidenceLinkRecord[];
      },
      async deleteByEntity(entityType: string, entityId: string): Promise<boolean> {
        const table = db.getTable('evidence_links');
        const initialLen = table.length;
        db.setTable(
          'evidence_links',
          table.filter(
            (l) => !(l.entityType === entityType && l.entityId === entityId)
          )
        );
        return db.getTable('evidence_links').length < initialLen;
      },
    };
  }

  public get meetingArtifactRepository(): IMeetingArtifactRepository {
    const db = this.db;
    return {
      async saveArtifact(meetingId: string, artifactType: 'mom_json' | 'mom_markdown' | 'mom_pdf' | 'mom_docx', content: string): Promise<MeetingArtifactRecord> {
        const table = db.getTable('meeting_artifacts');
        const existing = table.filter(
          (a) => (a.meetingId === meetingId || a.meeting_id === meetingId) && (a.artifactType === artifactType || a.artifact_type === artifactType)
        );
        const version = existing.length + 1;
        const record: MeetingArtifactRecord = {
          id: `art_${meetingId}_${artifactType}_v${version}`,
          meetingId,
          artifactType,
          version,
          content,
          createdAt: new Date().toISOString(),
        };
        table.push(record as unknown as Record<string, unknown>);
        (db as unknown as { saveToStorage: () => void }).saveToStorage?.();
        return record;
      },
      async getByMeetingId(meetingId: string): Promise<MeetingArtifactRecord[]> {
        const table = db.getTable('meeting_artifacts');
        return table.filter((a) => a.meetingId === meetingId || a.meeting_id === meetingId) as unknown as MeetingArtifactRecord[];
      },
      async getLatestByType(meetingId: string, artifactType: string): Promise<MeetingArtifactRecord | null> {
        const table = db.getTable('meeting_artifacts');
        const matching = table.filter(
          (a) => (a.meetingId === meetingId || a.meeting_id === meetingId) && (a.artifactType === artifactType || a.artifact_type === artifactType)
        ) as unknown as MeetingArtifactRecord[];
        if (matching.length === 0) return null;
        matching.sort((a, b) => b.version - a.version);
        return matching[0];
      },
    };
  }

  public get searchRepository(): ISearchRepository {
    const db = this.db;
    return {
      async searchAll(query: string): Promise<SearchResultItem[]> {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const results: SearchResultItem[] = [];

        // 1. Search Meetings (FTS across title and description)
        const meetings = db.getTable('meetings') as unknown as MeetingRecord[];
        for (const m of meetings) {
          const titleMatch = m.title.toLowerCase().includes(q);
          const descMatch = m.description && m.description.toLowerCase().includes(q);
          if (titleMatch || descMatch) {
            results.push({
              id: m.id,
              meetingId: m.id,
              type: 'meeting',
              title: m.title,
              snippet: m.description || m.title,
              score: titleMatch ? 1.0 : 0.8,
            });
          }
        }

        // 2. Search Transcript Segments
        const segments = db.getTable('transcript_segments') as unknown as TranscriptSegment[];
        for (const s of segments) {
          if (s.text.toLowerCase().includes(q)) {
            const meetingId = (s as unknown as { meeting_id?: string; meetingId?: string }).meeting_id || s.meetingId;
            results.push({
              id: s.id,
              meetingId: meetingId || '',
              type: 'transcript',
              title: `Transcript @ ${(s.startMs / 1000).toFixed(0)}s`,
              snippet: s.text,
              timestampMs: s.startMs,
              score: 0.9,
            });
          }
        }

        // 3. Search Action Items
        const actions = db.getTable('action_items') as unknown as ActionItemRecord[];
        for (const a of actions) {
          const titleMatch = a.title.toLowerCase().includes(q);
          const descMatch = a.description && a.description.toLowerCase().includes(q);
          const ownerMatch = a.owner && a.owner.toLowerCase().includes(q);
          if (titleMatch || descMatch || ownerMatch) {
            const meetingId = (a as unknown as { meeting_id?: string; meetingId?: string }).meeting_id || a.meetingId;
            results.push({
              id: a.id,
              meetingId: meetingId || '',
              type: 'action_item',
              title: `Action: ${a.title}`,
              snippet: a.description || `Assigned to: ${a.owner || 'Unassigned'}, Due: ${a.dueDate || 'TBD'}`,
              score: titleMatch ? 1.0 : 0.7,
            });
          }
        }

        // 4. Search Decisions
        const decisions = db.getTable('decisions') as unknown as DecisionRecord[];
        for (const d of decisions) {
          const titleMatch = d.title.toLowerCase().includes(q);
          const ratMatch = d.rationale && d.rationale.toLowerCase().includes(q);
          if (titleMatch || ratMatch) {
            const meetingId = (d as unknown as { meeting_id?: string; meetingId?: string }).meeting_id || d.meetingId;
            results.push({
              id: d.id,
              meetingId: meetingId || '',
              type: 'decision',
              title: `Decision: ${d.title}`,
              snippet: d.rationale || 'Agreed consensus',
              score: titleMatch ? 1.0 : 0.7,
            });
          }
        }

        return results.sort((a, b) => (b.score || 0) - (a.score || 0));
      },
    };
  }
}
