import { SQLiteService } from '../services/database/sqliteService.ts';
import { AudioRecorderService } from '../services/audio/audioService.ts';
import { ProcessingQueueService } from '../services/queue/queueService.ts';
import { TranscriptSegment } from '../services/types/stt.ts';

async function runPhase3Verification() {
  console.log('=== PHASE 3 TEST SUITE: CORE APPLICATION & STORAGE WORKFLOW ===\n');

  const db = SQLiteService.getInstance();
  await db.initialize();

  const testMeetingId = `phase3_mtg_${Date.now()}`;

  // 1. Verify Meeting Persistence, Search & Rename
  console.log('[Test 1] Testing Meeting Creation, Rename & Search...');
  const meeting = await db.meetingRepository.create({
    id: testMeetingId,
    title: 'Initial Sprint Planning',
    description: 'Phase 3 core application database and transcription testing',
    recordedAt: new Date().toISOString(),
    durationSeconds: 480,
    audioUri: `file:///recordings/${testMeetingId}.wav`,
    audioFileSizeBytes: 15360000,
    audioSampleRate: 16000,
    recordingStatus: 'completed',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
    approvalStatus: 'draft',
  });

  if (meeting.title !== 'Initial Sprint Planning') {
    throw new Error('FAILED: Meeting title mismatch');
  }
  console.log(`✓ Meeting created: "${meeting.title}" (ID: ${meeting.id})`);

  // Rename meeting
  const renamed = await db.meetingRepository.rename(testMeetingId, 'Sprint Planning (Renamed)');
  if (renamed.title !== 'Sprint Planning (Renamed)') {
    throw new Error('FAILED: Meeting rename failed');
  }
  console.log(`✓ Meeting renamed to: "${renamed.title}" in SQLite`);

  // Search meetings
  const searchResults = await db.meetingRepository.getAll({ search: 'Sprint Planning' });
  if (searchResults.length === 0 || !searchResults.some((m) => m.id === testMeetingId)) {
    throw new Error('FAILED: Meeting search query did not return expected meeting');
  }
  console.log(`✓ Meeting search returned matching record successfully`);

  // 2. Verify Participants Repository
  console.log('\n[Test 2] Testing Participants Repository...');
  const part1 = await db.participantRepository.add(testMeetingId, 'Marcus Brody', 'marcus@example.com', 'Tech Lead');
  const part2 = await db.participantRepository.add(testMeetingId, 'Elena Rostova', 'elena@example.com', 'Mobile Engineer');

  const parts = await db.participantRepository.getByMeetingId(testMeetingId);
  if (parts.length !== 2) {
    throw new Error(`FAILED: Expected 2 participants, found ${parts.length}`);
  }
  console.log(`✓ Saved and retrieved ${parts.length} participants: ${parts.map((p) => p.name).join(', ')}`);

  // 3. Verify Audio Recording Interruption & Recovery Checkpoints
  console.log('\n[Test 3] Testing Audio Interruption Handling & Checkpoint Recovery...');
  const audioService = AudioRecorderService.getInstance();

  // Test periodic checkpoint saving
  await db.recordingCheckpointRepository.saveCheckpoint(
    testMeetingId,
    `file:///recordings/${testMeetingId}.wav`,
    120,
    1
  );
  await db.recordingCheckpointRepository.saveCheckpoint(
    testMeetingId,
    `file:///recordings/${testMeetingId}.wav`,
    240,
    2
  );

  const unrecovered = await db.recordingCheckpointRepository.getUnrecovered();
  const testCheckpoint = unrecovered.find((c) => c.meetingId === testMeetingId);
  if (!testCheckpoint) {
    throw new Error('FAILED: Expected unrecovered checkpoint in SQLite');
  }
  console.log(`✓ Checkpoints saved: Found unrecovered checkpoint with duration ${testCheckpoint.durationSeconds}s`);

  // Test interruption trigger simulation
  let interruptionFired = false;
  const unsubInterrupt = audioService.onInterruption((reason) => {
    interruptionFired = true;
    console.log(`✓ Interruption event callback triggered: reason="${reason}"`);
  });

  await audioService.startRecording(testMeetingId);
  audioService.triggerInterruption('phone_call');

  if (audioService.getRecordingState() !== 'interrupted') {
    throw new Error('FAILED: Expected audioService state to be "interrupted"');
  }
  if (!interruptionFired) {
    throw new Error('FAILED: Interruption listener did not fire');
  }
  unsubInterrupt();

  // Recover checkpoint
  await db.recordingCheckpointRepository.markRecovered(testCheckpoint.id);
  const afterRecover = await db.recordingCheckpointRepository.getUnrecovered();
  if (afterRecover.some((c) => c.id === testCheckpoint.id)) {
    throw new Error('FAILED: Checkpoint was not marked as recovered');
  }
  console.log(`✓ Checkpoint marked as recovered successfully`);
  await audioService.stopRecording();

  // 4. Verify Transcription Pipeline, Inline Edits & Zero-Duplicate Retry
  console.log('\n[Test 4] Testing Transcription Pipeline & Zero-Duplicate Retries...');
  const initialSegments: TranscriptSegment[] = [
    {
      id: `seg_${testMeetingId}_1`,
      meetingId: testMeetingId,
      speakerId: 'spk_1',
      startMs: 0,
      endMs: 4000,
      text: 'First sprint segment text.',
      confidence: 0.96,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_2`,
      meetingId: testMeetingId,
      speakerId: 'spk_2',
      startMs: 4500,
      endMs: 8900,
      text: 'Second sprint segment text.',
      confidence: 0.94,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.transcriptRepository.insertSegments(initialSegments);
  const loadedSegments = await db.transcriptRepository.getByMeetingId(testMeetingId);
  if (loadedSegments.length !== 2) {
    throw new Error(`FAILED: Expected 2 segments, found ${loadedSegments.length}`);
  }
  console.log(`✓ Inserted and retrieved ${loadedSegments.length} timestamped transcript segments`);

  // Test inline edit and retention of original text
  await db.transcriptRepository.updateSegmentText(
    `seg_${testMeetingId}_1`,
    'First sprint segment text with manual user correction.'
  );
  const editedSegments = await db.transcriptRepository.getByMeetingId(testMeetingId);
  const edited = editedSegments.find((s) => s.id === `seg_${testMeetingId}_1`);
  if (!edited?.isEdited || edited.originalText !== 'First sprint segment text.') {
    throw new Error('FAILED: Manual correction did not preserve originalText or set isEdited: true');
  }
  console.log(`✓ Inline editing preserved originalText and marked isEdited: true`);

  // Test Retry without duplicate segments
  console.log('Testing retry cleanup (clearing old segments before re-run)...');
  await db.transcriptRepository.clearSegmentsForMeeting(testMeetingId);
  const cleared = await db.transcriptRepository.getByMeetingId(testMeetingId);
  if (cleared.length !== 0) {
    throw new Error('FAILED: Segments were not cleared before retry');
  }

  // Re-insert 2 fresh segments (simulating fresh Whisper run)
  await db.transcriptRepository.insertSegments([
    {
      id: `seg_${testMeetingId}_retry_1`,
      meetingId: testMeetingId,
      speakerId: 'spk_1',
      startMs: 0,
      endMs: 4000,
      text: 'Retried first segment.',
      confidence: 0.98,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_retry_2`,
      meetingId: testMeetingId,
      speakerId: 'spk_2',
      startMs: 4500,
      endMs: 8900,
      text: 'Retried second segment.',
      confidence: 0.97,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const afterRetry = await db.transcriptRepository.getByMeetingId(testMeetingId);
  if (afterRetry.length !== 2) {
    throw new Error(`FAILED: Duplicate segments detected after retry! Expected 2, got ${afterRetry.length}`);
  }
  console.log(`✓ Verified zero duplicate segments on retry (count: ${afterRetry.length})`);

  // 5. Verify Persistent Processing Queue & App Interruption Recovery
  console.log('\n[Test 5] Testing Persistent Processing Queue & Restart Recovery...');
  const queue = ProcessingQueueService.getInstance();

  const job = await queue.enqueueJob(testMeetingId, 'transcription');
  if (job.status !== 'queued') {
    throw new Error('FAILED: Enqueued job status should be "queued"');
  }
  console.log(`✓ Job enqueued in SQLite: ${job.id}`);

  // Mark job as running with 50% progress
  await queue.updateJob(job.id, {
    status: 'running',
    progress: 0.5,
    stageName: 'Transcribing chunk 2 of 4',
  });
  console.log(`✓ Job transitioned to "running" with checkpoint progress 50%`);

  // Simulate unexpected app kill & restart recovery
  console.log('Simulating app crash and running recoverInterruptedJobs()...');
  const recoveredJobs = await queue.recoverInterruptedJobs();
  const recovered = recoveredJobs.find((j) => j.id === job.id);
  if (!recovered || recovered.status !== 'interrupted') {
    throw new Error('FAILED: Job was not recovered as "interrupted"');
  }
  console.log(`✓ Successfully recovered interrupted job upon app restart: status="${recovered.status}"`);

  // Retry recovered job
  const retriedJob = await queue.retryJob(job.id);
  if (retriedJob.status !== 'queued' || retriedJob.attemptCount !== 2) {
    throw new Error('FAILED: Retried job status or attempt count mismatch');
  }
  console.log(`✓ Retried job successfully: status="${retriedJob.status}", attemptCount=${retriedJob.attemptCount}`);

  // Clean up
  await db.meetingRepository.delete(testMeetingId);
  console.log('✓ Cleaned up test meeting and cascaded foreign keys');

  console.log('\n======================================================');
  console.log('ALL PHASE 3 CHECKS AND ACCEPTANCE CRITERIA PASSED! ✓');
  console.log('======================================================\n');
}

runPhase3Verification().catch((err) => {
  console.error('\n❌ PHASE 3 TEST FAILED:', err);
  process.exit(1);
});
