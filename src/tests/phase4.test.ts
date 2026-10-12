import { SQLiteService } from '../services/database/sqliteService.ts';
import { RollupMeetingEngine } from '../services/llm/rollupEngine.ts';
import { LlamaLocalRuntime } from '../services/llm/llamaRuntime.ts';
import { ExportService } from '../services/export/exportService.ts';
import { MOMStructuredOutputSchema } from '../utils/validation.ts';
import { TranscriptSegment } from '../services/types/stt.ts';

async function runPhase4Verification() {
  console.log('=== PHASE 4 TEST SUITE: MEETING INTELLIGENCE & MOM PIPELINE ===\n');

  const db = SQLiteService.getInstance();
  await db.initialize();

  const testMeetingId = `phase4_mtg_${Date.now()}`;

  // 1. Setup Test Meeting and Timestamped Transcript Segments
  console.log('[Test 1] Seeding Test Meeting with Timestamped Transcript...');
  const meeting = await db.meetingRepository.create({
    id: testMeetingId,
    title: 'Executive AI Strategy Sync',
    description: 'Phase 4 meeting intelligence and hierarchical rollup testing',
    recordedAt: new Date().toISOString(),
    durationSeconds: 1800,
    audioUri: `file:///recordings/${testMeetingId}.wav`,
    audioFileSizeBytes: 57600000,
    audioSampleRate: 16000,
    recordingStatus: 'completed',
    transcriptionStatus: 'completed',
    analysisStatus: 'pending',
    approvalStatus: 'draft',
  });

  const testSegments: TranscriptSegment[] = [
    {
      id: `seg_${testMeetingId}_1`,
      meetingId: testMeetingId,
      speakerId: 'speaker_1',
      startMs: 0,
      endMs: 6500,
      text: 'Good morning team. Today we decide our on-device offline LLM strategy.',
      confidence: 0.98,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_2`,
      meetingId: testMeetingId,
      speakerId: 'speaker_2',
      startMs: 7000,
      endMs: 16200,
      text: 'We agreed to deploy Llama-3.2 1B Instruct with 4-bit Q4_K_M quantization to stay under 1GB RAM.',
      confidence: 0.96,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_3`,
      meetingId: testMeetingId,
      speakerId: 'speaker_1',
      startMs: 17000,
      endMs: 25400,
      text: 'Alex will deliver the bidirectional evidence link implementation by Friday.',
      confidence: 0.97,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_4`,
      meetingId: testMeetingId,
      speakerId: 'speaker_2',
      startMs: 26000,
      endMs: 34000,
      text: 'Sarah will finalize the air-gapped export templates by Monday.',
      confidence: 0.95,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `seg_${testMeetingId}_5`,
      meetingId: testMeetingId,
      speakerId: 'speaker_1',
      startMs: 35000,
      endMs: 44000,
      text: 'We confirmed SQLite WAL mode with strict foreign key constraints for all local tables.',
      confidence: 0.99,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.transcriptRepository.insertSegments(testSegments);
  console.log(`✓ Seeded ${testSegments.length} timestamped transcript segments in SQLite`);

  // 2. Test Constrained Local LLM MOM Pipeline & Zod Schema Validation
  console.log('\n[Test 2] Testing Local LLM MOM Pipeline & Schema Validation...');
  const llama = LlamaLocalRuntime.getInstance();
  await llama.loadModel({
    id: 'llama-3.2-1b-q4',
    name: 'Llama-3.2-1B-Instruct',
    fileSizeBytes: 700 * 1024 * 1024,
    sha256: 'sha256_mock_llama32',
    quantization: 'Q4_K_M',
    contextLengthTokens: 4096,
    minRamRequirementMb: 1200,
    isDownloaded: true,
  });

  const momOutput = await llama.generateMinutesOfMeeting(
    testSegments,
    { title: meeting.title, date: meeting.recordedAt }
  );

  const parsedMOM = MOMStructuredOutputSchema.safeParse(momOutput);
  if (!parsedMOM.success) {
    throw new Error(`FAILED: MOM output failed Zod schema validation: ${parsedMOM.error.message}`);
  }
  console.log('✓ Local LLM generated schema-compliant MOM:');
  console.log(`  - Executive Summary: "${momOutput.executiveSummary.substring(0, 60)}..."`);
  console.log(`  - Decisions Extracted: ${momOutput.decisions.length}`);
  console.log(`  - Action Items Extracted: ${momOutput.actionItems.length}`);
  console.log(`  - Agenda Topics: ${momOutput.agendaTopics.length}`);

  // 3. Anti-Hallucination Guard Verification
  console.log('\n[Test 3] Testing Anti-Hallucination Guards...');
  // Feed segment with no owner mentioned: "We need to run performance benchmarks."
  const unassignedSegment: TranscriptSegment[] = [
    {
      id: `seg_unassigned_1`,
      meetingId: testMeetingId,
      speakerId: 'speaker_3',
      startMs: 50000,
      endMs: 55000,
      text: 'We must run battery benchmark tests before release.',
      confidence: 0.95,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const unassignedRollup = await RollupMeetingEngine.processHierarchicalRollup(
    unassignedSegment,
    { title: 'Benchmark Review', date: new Date().toISOString() }
  );

  // In unassigned segment, owner should not be hallucinated
  for (const act of unassignedRollup.actionItems) {
    if (act.description && act.description.includes('battery') && act.owner !== null && act.owner !== 'Meeting Assignee') {
      throw new Error(`FAILED: Hallucinated owner detected when none was spoken: ${act.owner}`);
    }
  }
  console.log('✓ Anti-hallucination guard verified: Unmentioned owners are not fabricated');

  // 4. Hierarchical Rollup Engine for Long Transcripts (> 30 segments)
  console.log('\n[Test 4] Testing Hierarchical Rollup Engine on Long Meeting (36 Segments)...');
  const longTranscript: TranscriptSegment[] = [];
  for (let i = 0; i < 36; i++) {
    longTranscript.push({
      id: `long_seg_${i + 1}`,
      meetingId: testMeetingId,
      speakerId: i % 2 === 0 ? 'speaker_1' : 'speaker_2',
      startMs: i * 30000,
      endMs: (i + 1) * 30000,
      text:
        i === 5
          ? 'Alex will complete the security audit by Friday.'
          : i === 15
          ? 'We agreed on SQLCipher database encryption for local storage.'
          : i === 25
          ? 'Sarah will optimize audio buffer memory by Monday.'
          : `Segment ${i + 1}: ongoing technical review and mobile architectural sync discussion.`,
      confidence: 0.96,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const rollupResult = await RollupMeetingEngine.processHierarchicalRollup(
    longTranscript,
    { title: 'Long Architecture Session', date: new Date().toISOString() },
    undefined,
    { maxSegmentsPerChunk: 6, overlapSegments: 1 }
  );

  if (rollupResult.decisions.length === 0 || rollupResult.actionItems.length === 0) {
    throw new Error('FAILED: Long meeting rollup failed to extract decisions or actions');
  }
  console.log(`✓ Hierarchical rollup processed 36 segments across overlapping chunks`);
  console.log(`  - Synthesized Decisions: ${rollupResult.decisions.length}`);
  console.log(`  - Synthesized Action Items: ${rollupResult.actionItems.length}`);

  // 5. Bidirectional Evidence Linking in SQLite
  console.log('\n[Test 5] Testing Bidirectional Evidence Linking in SQLite...');
  const actionRecord = await db.actionItemRepository.createMany([
    {
      id: `act_ev_test_1`,
      meetingId: testMeetingId,
      title: 'Deliver bidirectional evidence link implementation',
      description: 'Link action items directly to audio segment timestamps',
      owner: 'Alex',
      dueDate: 'Friday',
      priority: 'high',
      status: 'todo',
    },
  ]);

  const evidenceLink = await db.evidenceLinkRepository.createMany([
    {
      id: `ev_link_test_1`,
      entityType: 'action_item',
      entityId: actionRecord[0].id,
      segmentId: testSegments[2].id, // "Alex will deliver..."
      relevanceScore: 0.99,
      quote: testSegments[2].text,
    },
  ]);

  // Traversal test 1: Action Item -> Evidence Link
  const retrievedLinks = await db.evidenceLinkRepository.getByEntity('action_item', actionRecord[0].id);
  if (retrievedLinks.length === 0) {
    throw new Error('FAILED: Could not retrieve evidence link by entity ID');
  }

  // Traversal test 2: Evidence Link -> Source Segment Timestamp
  const linkedSegId = retrievedLinks[0].segmentId;
  const allMeetingSegs = await db.transcriptRepository.getByMeetingId(testMeetingId);
  const matchedSeg = allMeetingSegs.find((s) => s.id === linkedSegId);

  if (!matchedSeg || matchedSeg.startMs !== 17000) {
    throw new Error(`FAILED: Evidence link does not resolve to target segment timestamp`);
  }
  console.log(`✓ Bidirectional evidence verified: Action Item "${actionRecord[0].title}" links to Segment @ ${matchedSeg.startMs / 1000}s`);
  console.log(`  - Verified Quote: "${retrievedLinks[0].quote}"`);

  // 6. Local Export Generator (Markdown, JSON, Printable HTML, DOCX)
  console.log('\n[Test 6] Testing Local Export Generator & Artifact Persistence...');
  const mdExport = ExportService.generateMarkdown(
    meeting,
    momOutput,
    testSegments,
    actionRecord,
    [],
    []
  );

  if (!mdExport.includes('# Executive AI Strategy Sync') || !mdExport.includes('## Executive Summary')) {
    throw new Error('FAILED: Markdown export missing key sections');
  }

  const jsonExport = ExportService.generateJson(
    meeting,
    momOutput,
    testSegments,
    actionRecord,
    [],
    []
  );
  const parsedJson = JSON.parse(jsonExport);
  if (parsedJson.metadata.title !== meeting.title || parsedJson.transcriptSegments.length !== 5) {
    throw new Error('FAILED: JSON export structure invalid');
  }

  const htmlExport = ExportService.generatePrintableHtml(
    meeting,
    momOutput,
    actionRecord,
    [],
    []
  );
  if (!htmlExport.includes('<!DOCTYPE html>') || !htmlExport.includes('Executive Summary')) {
    throw new Error('FAILED: HTML printable export missing HTML5 elements');
  }

  // Persist artifact in SQLite
  const savedArtifact = await db.meetingArtifactRepository.saveArtifact(
    testMeetingId,
    'mom_markdown',
    mdExport
  );
  if (!savedArtifact.id.includes('mom_markdown') || savedArtifact.version !== 1) {
    throw new Error('FAILED: Artifact save to SQLite failed');
  }
  console.log(`✓ Generated and validated Markdown, JSON, and HTML exports`);
  console.log(`✓ Stored artifact in SQLite meeting_artifacts (ID: ${savedArtifact.id}, v${savedArtifact.version})`);

  // 7. SQLite FTS5 Full-Text Search across Meetings, Transcripts, and Actions
  console.log('\n[Test 7] Testing SQLite Full-Text Search...');
  const searchForAlex = await db.searchRepository.searchAll('Alex');
  if (searchForAlex.length === 0) {
    throw new Error('FAILED: FTS search did not return hits for keyword "Alex"');
  }
  console.log(`✓ FTS search for "Alex" returned ${searchForAlex.length} hits across entities:`);
  searchForAlex.forEach((hit) => {
    console.log(`  - [${hit.type.toUpperCase()}] ${hit.title}: "${hit.snippet.substring(0, 50)}..."`);
  });

  const searchForWAL = await db.searchRepository.searchAll('SQLite WAL');
  if (searchForWAL.length === 0) {
    throw new Error('FAILED: FTS search did not find transcript hit for "SQLite WAL"');
  }
  console.log(`✓ FTS search for "SQLite WAL" successfully matched transcript segment @ ${(searchForWAL[0].timestampMs || 0) / 1000}s`);

  // Cleanup
  await db.meetingRepository.delete(testMeetingId);
  console.log('\n======================================================');
  console.log('ALL PHASE 4 MEETING INTELLIGENCE GATES PASSED! ✓');
  console.log('======================================================\n');
}

runPhase4Verification().catch((err) => {
  console.error('\n❌ PHASE 4 VERIFICATION FAILURE:', err);
  process.exit(1);
});
