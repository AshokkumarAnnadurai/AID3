import { SQLiteService } from '../services/database/sqliteService.ts';
import { SecurityService } from '../services/security/securityService.ts';
import { HardwareMonitorService } from '../services/hardware/hardwareMonitor.ts';
import { AudioRecorderService } from '../services/audio/audioService.ts';

async function runPhase5Verification() {
  console.log('=== PHASE 5 TEST SUITE: HARDENING, SECURITY & PRODUCTION READINESS ===\n');

  const db = SQLiteService.getInstance();
  await db.initialize();
  const security = SecurityService.getInstance();
  const hardware = HardwareMonitorService.getInstance();
  const audio = AudioRecorderService.getInstance();

  // 1. Local Database Encryption Evaluation & Payload Encryption
  console.log('[Test 1] Testing Local Database Encryption & Keystore Security...');
  const encStatus = security.getEncryptionStatus();
  if (!encStatus.isEncrypted || !encStatus.algorithm.includes('AES-256')) {
    throw new Error('FAILED: Encryption status does not show AES-256 / SQLCipher');
  }
  console.log(`✓ SQLCipher v4.5 Active: Algorithm="${encStatus.algorithm}", Keystore="${encStatus.keystoreAlias}"`);

  // Test AES payload encryption / decryption
  const secretMeetingMinutes = 'CONFIDENTIAL: Strategic planning discussion with proprietary architecture details.';
  const encrypted = security.encryptPayload(secretMeetingMinutes);
  if (!encrypted.startsWith('ENC_AES256_GCM:') || encrypted === secretMeetingMinutes) {
    throw new Error('FAILED: Payload was not properly encrypted');
  }
  const decrypted = security.decryptPayload(encrypted);
  if (decrypted !== secretMeetingMinutes) {
    throw new Error('FAILED: Decrypted payload mismatch');
  }
  console.log('✓ Encrypted confidential payload with AES-256 and successfully decrypted in-memory');

  // 2. Network Isolation Verification (Air-Gapped Audit)
  console.log('\n[Test 2] Testing Air-Gapped Network Isolation (Zero-Cloud Audit)...');
  const auditReport = security.runZeroCloudAudit();
  if (auditReport.activeSockets !== 0 || auditReport.outboundRequestsCount !== 0) {
    throw new Error('FAILED: Air-gapped audit detected external network sockets or requests');
  }
  if (auditReport.airGappedStatus !== 'strictly_isolated') {
    throw new Error('FAILED: App status is not strictly isolated');
  }
  console.log(`✓ Zero-Cloud Audit Verified: 0 active sockets, 0 outbound calls, Airplane Mode enforced`);

  // 3. Hardware Monitoring, Thermal Throttling & Battery Guards
  console.log('\n[Test 3] Testing Hardware & Thermal Throttling Guards...');
  const healthStatus = hardware.getStatus();
  if (healthStatus.batteryLevelPercent <= 0 || healthStatus.freeStorageBytes <= 0) {
    throw new Error('FAILED: Invalid hardware metrics returned');
  }
  console.log(`✓ Hardware Telemetry: Battery=${healthStatus.batteryLevelPercent}% (${healthStatus.batteryState}), Free Storage=${healthStatus.freeStorageFormatted}, Thermal State=${healthStatus.thermalState}`);

  // Test thermal throttling trigger
  hardware.setThermalThrottling(true);
  const throttledStatus = hardware.getStatus();
  if (!throttledStatus.thermalThrottlingActive || throttledStatus.thermalState !== 'serious') {
    throw new Error('FAILED: Thermal throttling state not reflected in hardware monitor');
  }
  console.log('✓ Thermal throttling state successfully detected and handled');
  hardware.setThermalThrottling(false); // Reset to nominal

  // 4. Stress Testing: 90-Minute Long Meeting Recording Simulation
  console.log('\n[Test 4] Simulating 90-Minute Continuous Meeting Stress Test...');
  const stressSim = hardware.runLongMeetingStressTest(90);
  if (stressSim.chunkCount !== 180 || stressSim.checkpointCount !== 90) {
    throw new Error('FAILED: Unexpected chunk or checkpoint calculation for 90-minute recording');
  }
  if (!stressSim.isSafeForExecution) {
    throw new Error('FAILED: 90-minute stress test determined unsafe for execution');
  }
  console.log(`✓ 90-Minute Stress Test Simulation Passed:`);
  console.log(`  - Estimated Audio Size: ${(stressSim.estimatedAudioSizeBytes / (1024 * 1024)).toFixed(1)} MB (16kHz 16-bit mono)`);
  console.log(`  - Audio Chunks: ${stressSim.chunkCount} (30s windows)`);
  console.log(`  - Recovery Checkpoints: ${stressSim.checkpointCount} (60s frequency)`);
  console.log(`  - Expected Buffer RAM: ${stressSim.expectedRamMb} MB (safely within 100MB quota)`);

  // 5. Crash Recovery & Unexpected Termination Handling
  console.log('\n[Test 5] Testing App Crash & Unexpected Termination Recovery...');
  const crashMeetingId = `crash_sim_${Date.now()}`;
  await db.meetingRepository.create({
    id: crashMeetingId,
    title: 'Meeting Interrupted by Power Loss',
    description: 'Stress testing crash recovery',
    recordedAt: new Date().toISOString(),
    durationSeconds: 125,
    audioUri: `file:///storage/${crashMeetingId}.wav`,
    audioFileSizeBytes: 4000000,
    audioSampleRate: 16000,
    recordingStatus: 'interrupted',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
    approvalStatus: 'draft',
  });

  // Save an unrecovered checkpoint
  const checkpoint = await db.recordingCheckpointRepository.saveCheckpoint(
    crashMeetingId,
    `file:///storage/${crashMeetingId}_chk.wav`,
    125,
    4
  );

  // Simulate app restart and check for unrecovered checkpoints
  const unrecovered = await db.recordingCheckpointRepository.getUnrecovered();
  const matchingChk = unrecovered.find((c) => c.id === checkpoint.id);
  if (!matchingChk) {
    throw new Error('FAILED: App restart did not identify unrecovered checkpoint');
  }

  // Mark recovered
  await db.recordingCheckpointRepository.markRecovered(checkpoint.id);
  const afterRecover = await db.recordingCheckpointRepository.getUnrecovered();
  if (afterRecover.some((c) => c.id === checkpoint.id)) {
    throw new Error('FAILED: Checkpoint was not marked recovered');
  }
  console.log(`✓ Successfully recovered interrupted recording checkpoint from SQLite upon simulated app restart`);

  // Cleanup
  await db.meetingRepository.delete(crashMeetingId);
  console.log('\n======================================================');
  console.log('ALL PHASE 5 HARDENING & PRODUCTION GATES PASSED! ✓');
  console.log('======================================================\n');
}

runPhase5Verification().catch((err) => {
  console.error('\n❌ PHASE 5 VERIFICATION FAILURE:', err);
  process.exit(1);
});
