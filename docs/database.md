# Offline AI Meeting Assistant — Database Schema Documentation

## 1. Overview

The application utilizes an embedded SQLite relational database with strict foreign key constraints (`PRAGMA foreign_keys = ON;`) and Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) for maximum concurrency and write durability.

Audio recordings are stored separately on the sandboxed mobile filesystem (`app_storage/recordings/{meeting_id}.wav`), with their file paths referenced in the `meetings` table.

---

## 2. Entity Relationship Diagram (Textual)

```
[meetings] 1 ────< * [transcript_segments]
    │                     │
    │ 1                   │ 1
    │                     │
    ├────< * [decisions]  └────< * [evidence_links]
    │             ^                    ^
    │ 1           │                    │
    ├────< * [action_items] ───────────┘
    │
    ├────< * [meeting_artifacts]
    │
    └────< * [processing_jobs] 1 ────< * [processing_job_events]

[speakers] (global or per-meeting voice profiles)
[model_registry] (installed on-device GGUF / GGML models)
[application_settings] (key-value configuration)
[schema_migrations] (version tracking)
```

---

## 3. Detailed Table Definitions

### 3.1 `schema_migrations`
Tracks applied database schema versions.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  checksum TEXT NOT NULL
);
```

### 3.2 `meetings`
Represents an in-person or recorded meeting session.

```sql
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recorded_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  audio_uri TEXT,
  audio_file_size_bytes INTEGER DEFAULT 0,
  audio_sample_rate INTEGER DEFAULT 16000,
  recording_status TEXT NOT NULL CHECK(recording_status IN ('idle', 'recording', 'paused', 'completed', 'interrupted', 'error')),
  transcription_status TEXT NOT NULL CHECK(transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  analysis_status TEXT NOT NULL CHECK(analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  approval_status TEXT NOT NULL CHECK(approval_status IN ('draft', 'reviewed', 'approved')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_recorded_at ON meetings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(recording_status, transcription_status);
```

### 3.3 `transcript_segments`
Fine-grained timestamped speech recognition segments.

```sql
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL,
  speaker_id TEXT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  is_edited INTEGER NOT NULL DEFAULT 0,
  original_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segments_meeting_start ON transcript_segments(meeting_id, start_ms);
```

### 3.4 `speakers`
Enables optional speaker diarization tags.

```sql
CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT,
  name TEXT NOT NULL,
  color_hex TEXT DEFAULT '#F97316',
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
```

### 3.5 `decisions`
Key decisions agreed upon during the meeting.

```sql
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT,
  consensus_level TEXT DEFAULT 'agreed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON decisions(meeting_id);
```

### 3.6 `action_items`
Deliverables and tasks identified in the meeting.

```sql
CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  due_date TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
```

### 3.7 `evidence_links`
Traceability links binding decisions/action items back to original transcript segments.

```sql
CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('action_item', 'decision', 'risk', 'summary')),
  entity_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  relevance_score REAL DEFAULT 1.0,
  quote TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (segment_id) REFERENCES transcript_segments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence_links(entity_type, entity_id);
```

### 3.8 `meeting_artifacts`
Structured minutes documents, summaries, and versioned exports.

```sql
CREATE TABLE IF NOT EXISTS meeting_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('mom_json', 'mom_markdown', 'mom_pdf', 'mom_docx')),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_meeting ON meeting_artifacts(meeting_id, artifact_type);
```

### 3.9 `processing_jobs` & `processing_job_events`
Persistent job queue ensuring tasks survive app restarts and OS memory reclamation.

```sql
CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK(job_type IN ('transcription', 'mom_generation', 'action_extraction', 'audio_export')),
  status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted')),
  progress REAL NOT NULL DEFAULT 0.0,
  stage_name TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processing_job_events (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES processing_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
```

### 3.10 `model_registry`
Tracks downloaded on-device weights, checksums, and hardware readiness.

```sql
CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY NOT NULL,
  model_type TEXT NOT NULL CHECK(model_type IN ('stt_whisper', 'llm_llama')),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  quantization TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### 3.11 `application_settings`
```sql
CREATE TABLE IF NOT EXISTS application_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
