import { SQLiteService } from '../services/database/sqliteService.ts';
import { AudioRecorderService } from '../services/audio/audioService.ts';
import { ProcessingQueueService } from '../services/queue/queueService.ts';
import { store } from '../store/index.ts';
import {
  setRecordingStatus,
  setActiveMeeting,
  updateDuration,
  resetRecorder,
} from '../store/slices/recorderSlice.ts';
import {
  MeetingCreateSchema,
  ActionItemSchema,
  MOMStructuredOutputSchema,
} from '../utils/validation.ts';

async function runPhase1Verification() {
  console.log('=== PHASE 1 TEST SUITE: OFFLINE AI MEETING ASSISTANT ===\n');

  // 1. Test SQLite Initialization and Migration 1
  console.log('[Test 1] Testing SQLite initialization and versioned migrations...');
  const db = SQLiteService.getInstance();
  const appliedMigrations = await db.initialize();

  if (appliedMigrations.length < 1) {
    throw new Error('FAILED: Expected at least 1 applied migration');
  }
  console.log(`✓ Migration 1 applied successfully: ${appliedMigrations[0].name} (version: ${appliedMigrations[0].version})`);

  // 2. Test Meeting Repository CRUD
  console.log('\n[Test 2] Testing Meeting Repository CRUD...');
  const testMeetingId = `test_mtg_${Date.now()}`;
  const createdMeeting = await db.meetingRepository.create({
    id: testMeetingId,
    title: 'Executive Architecture Sync',
    description: 'Test offline meeting for Phase 1 verification',
    recordedAt: new Date().toISOString(),
    durationSeconds: 300,
    audioUri: `file:///recordings/${testMeetingId}.wav`,
    audioFileSizeBytes: 9600000,
    audioSampleRate: 16000,
    recordingStatus: 'completed',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
    approvalStatus: 'draft',
  });

  if (createdMeeting.id !== testMeetingId) {
    throw new Error('FAILED: Meeting ID mismatch');
  }
  console.log(`✓ Created meeting: "${createdMeeting.title}" [ID: ${createdMeeting.id}]`);

  const fetchedMeeting = await db.meetingRepository.getById(testMeetingId);
  if (!fetchedMeeting || fetchedMeeting.title !== 'Executive Architecture Sync') {
    throw new Error('FAILED: Failed to fetch meeting by ID');
  }
  console.log('✓ Fetched meeting by ID successfully');

  const updatedMeeting = await db.meetingRepository.update(testMeetingId, {
    approvalStatus: 'approved',
    title: 'Executive Architecture Sync (Approved)',
  });
  if (updatedMeeting.approvalStatus !== 'approved') {
    throw new Error('FAILED: Meeting update failed');
  }
  console.log(`✓ Updated meeting approval status to: ${updatedMeeting.approvalStatus}`);

  // 3. Test Transcript Repository
  console.log('\n[Test 3] Testing Transcript Repository & Segment Edits...');
  const testSegments = [
    {
      id: `seg_${testMeetingId}_1`,
      meetingId: testMeetingId,
      speakerId: 'spk_1',
      startMs: 0,
      endMs: 4000,
      text: 'Good morning, starting the offline architecture review.',
      confidence: 0.99,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_2`,
      meetingId: testMeetingId,
      speakerId: 'spk_2',
      startMs: 4100,
      endMs: 9500,
      text: 'We are verifying SQLite WAL mode and local whisper.cpp bindings.',
      confidence: 0.97,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.transcriptRepository.insertSegments(testSegments);
  const fetchedSegments = await db.transcriptRepository.getByMeetingId(testMeetingId);
  if (fetchedSegments.length !== 2) {
    throw new Error(`FAILED: Expected 2 segments, got ${fetchedSegments.length}`);
  }
  console.log(`✓ Inserted and retrieved ${fetchedSegments.length} timestamped transcript segments`);

  await db.transcriptRepository.updateSegmentText(
    `seg_${testMeetingId}_1`,
    'Good morning everyone, starting the offline architecture review.'
  );
  const afterEdit = await db.transcriptRepository.getByMeetingId(testMeetingId);
  const editedSeg = afterEdit.find((s) => s.id === `seg_${testMeetingId}_1`);
  if (!editedSeg?.isEdited || !editedSeg?.originalText) {
    throw new Error('FAILED: Segment edit flag or original text was not preserved');
  }
  console.log('✓ Transcript inline editing preserved originalText and marked isEdited: true');

  // 4. Test Action Items Repository
  console.log('\n[Test 4] Testing Action Items Repository...');
  const createdActions = await db.actionItemRepository.createMany([
    {
      id: `act_${testMeetingId}_1`,
      meetingId: testMeetingId,
      title: 'Setup whisper.cpp local bindings',
      owner: 'Lead Mobile Engineer',
      dueDate: 'Friday',
      priority: 'high',
      status: 'in_progress',
    },
    {
      id: `act_${testMeetingId}_2`,
      meetingId: testMeetingId,
      title: 'Evaluate llama.cpp GGUF 1B inference',
      owner: 'AI Engineer',
      dueDate: 'Monday',
      priority: 'urgent',
      status: 'todo',
    },
  ]);
  if (createdActions.length !== 2) {
    throw new Error('FAILED: Failed to create action items');
  }
  console.log(`✓ Created ${createdActions.length} action items with owners and priorities`);

  const updatedAction = await db.actionItemRepository.update(`act_${testMeetingId}_1`, {
    status: 'completed',
  });
  if (updatedAction.status !== 'completed') {
    throw new Error('FAILED: Action item status update failed');
  }
  console.log(`✓ Toggled action item status to: ${updatedAction.status}`);

  // 5. Test Zod Validation Schemas
  console.log('\n[Test 5] Testing Zod Validation Schemas...');
  const validMeeting = MeetingCreateSchema.safeParse({
    title: 'Valid Meeting Title',
    description: 'Valid optional description',
  });
  if (!validMeeting.success) {
    throw new Error('FAILED: Valid meeting rejected by schema');
  }
  console.log('✓ Valid meeting payload accepted by Zod schema');

  const invalidMeeting = MeetingCreateSchema.safeParse({
    title: 'X', // Too short (< 2)
  });
  if (invalidMeeting.success) {
    throw new Error('FAILED: Invalid meeting accepted by schema');
  }
  console.log('✓ Invalid meeting payload correctly rejected by Zod schema (min length enforced)');

  const validMOM = MOMStructuredOutputSchema.safeParse({
    meetingTitle: 'Phase 1 Review',
    executiveSummary: 'This is a valid executive summary with more than ten characters.',
    agendaTopics: ['Local STT', 'Local LLM'],
    keyDiscussionPoints: ['Air-gapped mobile setup'],
    decisions: [
      {
        title: 'Use whisper.cpp',
        rationale: 'Runs locally under 50MB RAM',
        consensusLevel: 'agreed',
        sourceSegmentIds: [],
      },
    ],
    actionItems: [
      {
        title: 'Run test on device',
        owner: 'Tester',
        dueDate: 'Today',
        priority: 'high',
        status: 'todo',
        sourceSegmentIds: [],
      },
    ],
    risksAndBlockers: [
      {
        title: 'Thermal throttling on older devices',
        severity: 'medium',
        sourceSegmentIds: [],
      },
    ],
    openQuestions: ['Battery consumption rate?'],
    nextSteps: ['Start Phase 2 PoC'],
  });
  if (!validMOM.success) {
    throw new Error(`FAILED: MOM schema validation error: ${validMOM.error.message}`);
  }
  console.log('✓ Structured MOM schema validation passed');

  // 6. Test Redux Toolkit Store
  console.log('\n[Test 6] Testing Redux Toolkit Store & Slices...');
  store.dispatch(setActiveMeeting({ id: 'redux_mtg_1', title: 'Redux Test Meeting' }));
  store.dispatch(setRecordingStatus('recording'));
  store.dispatch(updateDuration(42));

  const state1 = store.getState().recorder;
  if (state1.status !== 'recording' || state1.durationSeconds !== 42) {
    throw new Error('FAILED: Redux recorder state mismatch');
  }
  console.log(`✓ Redux recorder slice updated (status: ${state1.status}, duration: ${state1.durationSeconds}s)`);

  store.dispatch(resetRecorder());
  const state2 = store.getState().recorder;
  if (state2.status !== 'idle' || state2.durationSeconds !== 0) {
    throw new Error('FAILED: Redux resetRecorder failed');
  }
  console.log('✓ Redux recorder slice reset successfully');

  // 7. Test Processing Queue
  console.log('\n[Test 7] Testing Processing Queue State Machine...');
  const queue = ProcessingQueueService.getInstance();
  const job = await queue.enqueueJob(testMeetingId, 'transcription');
  if (job.status !== 'queued') {
    throw new Error('FAILED: Job status not queued');
  }
  console.log(`✓ Enqueued job [ID: ${job.id}] with status: ${job.status}`);

  await queue.cancelJob(job.id);
  const cancelledJob = await queue.getJob(job.id);
  if (cancelledJob?.status !== 'cancelled') {
    throw new Error('FAILED: Job cancellation failed');
  }
  console.log(`✓ Cancelled job successfully [status: ${cancelledJob.status}]`);

  // Cleanup test meeting
  await db.meetingRepository.delete(testMeetingId);
  console.log('✓ Cleaned up test meeting and cascaded foreign keys');

  console.log('\n======================================================');
  console.log('ALL PHASE 1 CHECKS AND ACCEPTANCE CRITERIA PASSED! ✓');
  console.log('======================================================\n');
}

runPhase1Verification().catch((err) => {
  console.error('\n❌ PHASE 1 TEST FAILED:', err);
  process.exit(1);
});
