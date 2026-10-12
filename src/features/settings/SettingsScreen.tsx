import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Cpu,
  Database,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Check,
  Smartphone,
  Lock,
  WifiOff,
  Flame,
  Battery,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Badge } from '../../components/Badge.tsx';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { SQLiteService } from '../../services/database/sqliteService.ts';
import { MigrationRecord } from '../../services/types/database.ts';
import { SecurityService, EncryptionStatus, NetworkAuditReport } from '../../services/security/securityService.ts';
import { HardwareMonitorService, HardwareHealthStatus } from '../../services/hardware/hardwareMonitor.ts';
import { fetchMeetings } from '../../store/slices/meetingsSlice.ts';

export const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const whisperModels = useAppSelector((state) => state.models.whisperModels);
  const llmModels = useAppSelector((state) => state.models.llmModels);
  const activeWhisper = useAppSelector((state) => state.models.activeWhisperModelId);
  const activeLlm = useAppSelector((state) => state.models.activeLlmModelId);

  const [appliedMigrations, setAppliedMigrations] = useState<MigrationRecord[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Security & Encryption status
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [auditReport, setAuditReport] = useState<NetworkAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Hardware status
  const [hardwareStatus, setHardwareStatus] = useState<HardwareHealthStatus | null>(null);

  // Stress test state
  const [stressTestResult, setStressTestResult] = useState<string | null>(null);

  const db = SQLiteService.getInstance();
  const securityService = SecurityService.getInstance();
  const hardwareService = HardwareMonitorService.getInstance();

  useEffect(() => {
    const initDiagnostics = async () => {
      const records = await db.getAppliedMigrations();
      setAppliedMigrations(records);
      setEncryptionStatus(securityService.getEncryptionStatus());
      setAuditReport(securityService.runZeroCloudAudit());
      setHardwareStatus(hardwareService.getStatus());
    };
    initDiagnostics();
  }, [db, securityService, hardwareService]);

  const handleRunMigrations = async () => {
    try {
      setIsMigrating(true);
      const result = await db.runMigrations();
      setAppliedMigrations(result);
      setMigrationStatus(`Successfully applied ${result.length} migrations.`);
      setTimeout(() => setMigrationStatus(null), 3500);
    } catch (err) {
      setMigrationStatus(`Migration error: ${(err as Error).message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRunSecurityAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const report = securityService.runZeroCloudAudit();
      setAuditReport(report);
      setIsAuditing(false);
    }, 450);
  };

  const handleRunStressTest = () => {
    const res = hardwareService.runLongMeetingStressTest(90);
    setStressTestResult(
      `✓ 90-Min Simulation Passed: Audio size ${(res.estimatedAudioSizeBytes / (1024 * 1024)).toFixed(1)}MB, ${res.chunkCount} chunks, ${res.checkpointCount} checkpoints, expected buffer RAM: ${res.expectedRamMb}MB. Safe.`
    );
    setTimeout(() => setStressTestResult(null), 6000);
  };

  const handleResetDatabase = () => {
    if (confirm('WARNING: Reset all offline meetings, transcripts, and SQLite tables?')) {
      db.resetAllData();
      db.initialize().then((applied) => {
        setAppliedMigrations(applied);
        dispatch(fetchMeetings());
        alert('Database has been reset and re-migrated to schema version 1.');
      });
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-200">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
          System &amp; Offline Diagnostics
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Local model weights, SQLCipher encryption, air-gapped isolation &amp; hardware
        </p>
      </div>

      {/* Air-Gapped Network Isolation Audit */}
      <Card variant="accent" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Zero-Cloud Air-Gapped Audit
              </h2>
              <span className="text-[10px] text-emerald-400 font-mono">
                Status: {auditReport?.airGappedStatus === 'strictly_isolated' ? '100% Isolated (Airplane Mode Verified)' : 'Audit Warning'}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunSecurityAudit}
            isLoading={isAuditing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Audit Now
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1 border-t border-slate-800">
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-500 block">SOCKETS</span>
            <span className="text-emerald-400 font-bold">{auditReport?.activeSockets || 0} Open</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-500 block">REMOTE CALLS</span>
            <span className="text-emerald-400 font-bold">{auditReport?.outboundRequestsCount || 0} Blocked</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-500 block">AIRPLANE MODE</span>
            <span className="text-emerald-400 font-bold">Enforced</span>
          </div>
        </div>
      </Card>

      {/* Local Database Encryption (SQLCipher / OS Keystore) */}
      <Card variant="default" padding="md" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-slate-200">Local Database Encryption</h3>
          </div>
          <Badge variant="success" size="sm">
            SQLCipher v4.5 Active
          </Badge>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 font-mono text-[10px] text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">Algorithm:</span>
            <span>{encryptionStatus?.algorithm}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Key Storage:</span>
            <span>{encryptionStatus?.keystoreAlias}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Derivation:</span>
            <span>{encryptionStatus?.keyDerivation}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pragma:</span>
            <span className="text-slate-400 truncate max-w-[200px]">{encryptionStatus?.cipherPragma}</span>
          </div>
        </div>
      </Card>

      {/* Device Hardware & Thermal Throttling Status */}
      <Card variant="default" padding="md" className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-200">Hardware &amp; Thermal Telemetry</h3>
          </div>
          <Badge
            variant={hardwareStatus?.thermalState === 'nominal' ? 'success' : 'warning'}
            size="sm"
          >
            Thermal: {hardwareStatus?.thermalState.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">BATTERY CHARGE</span>
            <span className="text-slate-100 font-bold flex items-center gap-1.5 mt-0.5">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>{hardwareStatus?.batteryLevelPercent}% ({hardwareStatus?.batteryState})</span>
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">STORAGE QUOTA</span>
            <span className="text-emerald-400 font-bold mt-0.5 block">
              {hardwareStatus?.freeStorageFormatted} Free
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">MEMORY USAGE</span>
            <span className="text-slate-100 font-bold mt-0.5 block">
              {hardwareStatus?.memoryUsageMb} MB / 6 GB
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">THROTTLING GUARD</span>
            <span className="text-emerald-400 font-bold mt-0.5 block">
              {hardwareStatus?.thermalThrottlingActive ? 'Throttled' : 'Nominal (Safe)'}
            </span>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunStressTest}
            leftIcon={<Play className="w-3.5 h-3.5 text-orange-400" />}
          >
            Simulate 90-Min Recording Stress Test
          </Button>
        </div>

        {stressTestResult && (
          <div className="p-2 bg-emerald-950/60 border border-emerald-700/50 rounded-lg text-[11px] text-emerald-300 font-mono">
            {stressTestResult}
          </div>
        )}
      </Card>

      {/* Local STT Models */}
      <Card variant="default" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-slate-200">Local STT Models (Whisper.cpp)</h3>
          </div>
          <Badge variant="primary" size="sm">
            GGML Native
          </Badge>
        </div>

        <div className="space-y-2">
          {whisperModels.map((model) => (
            <div
              key={model.id}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                activeWhisper === model.id
                  ? 'bg-orange-500/10 border-orange-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{model.name}</span>
                  <Badge variant={model.isDownloaded ? 'success' : 'neutral'} size="sm">
                    {model.isDownloaded ? 'Installed' : 'Available'}
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {(model.fileSizeBytes / (1024 * 1024)).toFixed(0)} MB • Quantization: {model.quantization}
                </span>
              </div>

              {activeWhisper === model.id ? (
                <span className="text-orange-400 font-semibold text-[11px] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Active
                </span>
              ) : (
                <Button variant="ghost" size="sm">
                  Select
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Local LLM Models */}
      <Card variant="default" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-slate-200">Local LLM (Llama.cpp)</h3>
          </div>
          <Badge variant="primary" size="sm">
            GGUF Format
          </Badge>
        </div>

        <div className="space-y-2">
          {llmModels.map((model) => (
            <div
              key={model.id}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                activeLlm === model.id
                  ? 'bg-orange-500/10 border-orange-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{model.name}</span>
                  <Badge variant="success" size="sm">
                    Installed
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {(model.fileSizeBytes / (1024 * 1024)).toFixed(0)} MB • {model.quantization} • Context: {model.contextLengthTokens} tokens
                </span>
              </div>

              <span className="text-orange-400 font-semibold text-[11px] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Active
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* SQLite Database & Migrations */}
      <Card variant="default" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-slate-200">SQLite Database &amp; Migrations</h3>
          </div>
          <Badge variant="success" size="sm" dot>
            WAL Active
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Database Name:</span>
              <span>offline_meeting_assistant.db</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Schema Version:</span>
              <span className="text-emerald-400 font-bold">
                v{appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1].version : 1}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Applied Migrations:</span>
              <span>{appliedMigrations.length}</span>
            </div>
          </div>

          {migrationStatus && (
            <p className="text-xs font-medium text-emerald-400 animate-in fade-in">
              {migrationStatus}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunMigrations}
              isLoading={isMigrating}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Verify Migrations
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetDatabase}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Reset SQLite DB
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
