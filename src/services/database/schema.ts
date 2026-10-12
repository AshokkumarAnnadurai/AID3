export const INITIAL_SCHEMA_SQL = `
-- Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  checksum TEXT NOT NULL
);

-- Meetings Table
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

-- Transcript Segments Table
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

-- Speakers Table
CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT,
  name TEXT NOT NULL,
  color_hex TEXT DEFAULT '#F97316',
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Decisions Table
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

-- Action Items Table
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

-- Evidence Links Table
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

-- Meeting Artifacts Table
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

-- Processing Jobs Table
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

CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);

-- Processing Job Events Table
CREATE TABLE IF NOT EXISTS processing_job_events (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES processing_jobs(id) ON DELETE CASCADE
);

-- Model Registry Table
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

-- Application Settings Table
CREATE TABLE IF NOT EXISTS application_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
