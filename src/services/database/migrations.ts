import { Migration, IDatabaseConnection } from '../types/database.ts';
import { INITIAL_SCHEMA_SQL } from './schema.ts';

export const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_offline_schema',
    up: async (db: IDatabaseConnection) => {
      // Split SQL statements and execute them sequentially
      const statements = INITIAL_SCHEMA_SQL
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const sql of statements) {
        await db.execute(sql + ';');
      }

      // Seed default application settings
      const defaultSettings = [
        { key: 'theme', value: 'dark' },
        { key: 'auto_transcribe', value: 'true' },
        { key: 'active_stt_model', value: 'whisper-tiny-en-q5_1' },
        { key: 'active_llm_model', value: 'llama-3.2-1b-instruct-q4_k_m' },
        { key: 'evidence_strict_mode', value: 'true' },
        { key: 'sample_rate', value: '16000' },
        { key: 'app_version', value: '1.0.0-phase1' },
      ];

      for (const setting of defaultSettings) {
        await db.execute(
          `INSERT OR REPLACE INTO application_settings (key, value, updated_at) VALUES (?, ?, ?);`,
          [setting.key, setting.value, new Date().toISOString()]
        );
      }

      // Seed default model registry records
      const defaultModels = [
        {
          id: 'model-whisper-tiny',
          model_type: 'stt_whisper',
          name: 'Whisper Tiny.en',
          version: '1.0',
          file_path: 'models/whisper/ggml-tiny.en-q5_1.bin',
          file_size_bytes: 32505856, // ~31 MB
          sha256: 'be07e048b1e59e33aa46fdf38737851e6d929272345825d730d75db957f10b0c',
          quantization: 'q5_1',
          is_active: 1,
          created_at: new Date().toISOString(),
        },
        {
          id: 'model-whisper-base',
          model_type: 'stt_whisper',
          name: 'Whisper Base.en',
          version: '1.0',
          file_path: 'models/whisper/ggml-base.en-q5_1.bin',
          file_size_bytes: 59768832, // ~57 MB
          sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf00e087302fb9432d033f0f',
          quantization: 'q5_1',
          is_active: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'model-llama-3.2-1b',
          model_type: 'llm_llama',
          name: 'Llama-3.2 1B Instruct',
          version: '3.2',
          file_path: 'models/llm/llama-3.2-1b-instruct-q4_k_m.gguf',
          file_size_bytes: 734003200, // ~700 MB
          sha256: '5a2b1f893e4811a2f90119b9d3111f8e65e495208b5e9b7245b780ea3b5b19c2',
          quantization: 'Q4_K_M',
          is_active: 1,
          created_at: new Date().toISOString(),
        },
      ];

      for (const m of defaultModels) {
        await db.execute(
          `INSERT OR REPLACE INTO model_registry (id, model_type, name, version, file_path, file_size_bytes, sha256, quantization, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            m.id,
            m.model_type,
            m.name,
            m.version,
            m.file_path,
            m.file_size_bytes,
            m.sha256,
            m.quantization,
            m.is_active,
            m.created_at,
          ]
        );
      }
    },
  },
  {
    version: 2,
    name: '002_participants_and_recovery_checkpoints',
    up: async (db: IDatabaseConnection) => {
      // Create participants table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS participants (
          id TEXT PRIMARY KEY NOT NULL,
          meeting_id TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT,
          role TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        );
      `);

      // Create recording_checkpoints table for crash recovery
      await db.execute(`
        CREATE TABLE IF NOT EXISTS recording_checkpoints (
          id TEXT PRIMARY KEY NOT NULL,
          meeting_id TEXT NOT NULL,
          audio_uri TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          duration_seconds INTEGER NOT NULL,
          is_recovered INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        );
      `);

      await db.execute(`
        INSERT OR REPLACE INTO application_settings (key, value, updated_at) VALUES ('app_version', '1.0.0-phase3', ?);
      `, [new Date().toISOString()]);
    },
  },
];
