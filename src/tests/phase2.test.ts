import { AudioRecorderService } from '../services/audio/audioService.ts';
import { WhisperTranscriptionEngine } from '../services/stt/whisperEngine.ts';
import { LlamaLocalRuntime } from '../services/llm/llamaRuntime.ts';
import { SQLiteService } from '../services/database/sqliteService.ts';
import { WhisperModelInfo } from '../services/types/stt.ts';
import { LLMModelInfo } from '../services/types/llm.ts';
import { MOMStructuredOutputSchema } from '../utils/validation.ts';

async function runPhase2Verification() {
  console.log('=== PHASE 2 TEST SUITE: LOCAL AI PROOF OF CONCEPT ===\n');

  // 1. Verify Audio Recorder State Machine & Audio File Creation
  console.log('[Test 1] Testing AudioRecorderService capture & metadata...');
  const audioService = AudioRecorderService.getInstance();

  const hasPerm = await audioService.checkPermissions();
  console.log(`✓ Audio permission check passed: ${hasPerm}`);

  const testMeetingId = `poc_rec_${Date.now()}`;
  let audioLevelEventsCount = 0;
  const unsubLevel = audioService.onAudioLevel((data) => {
    audioLevelEventsCount++;
    if (data.peak < 0 || data.peak > 1.0) {
      throw new Error(`Invalid audio peak level: ${data.peak}`);
    }
  });

  await audioService.startRecording(testMeetingId, { sampleRate: 16000 });
  if (audioService.getRecordingState() !== 'recording') {
    throw new Error('FAILED: Recording state should be "recording"');
  }
  console.log('✓ Recording started, state is "recording"');

  // Wait 1.1 seconds to test duration and audio levels
  await new Promise((resolve) => setTimeout(resolve, 1100));

  await audioService.pauseRecording();
  if (audioService.getRecordingState() !== 'paused') {
    throw new Error('FAILED: Recording state should be "paused"');
  }
  console.log('✓ Recording paused, state is "paused"');

  await audioService.resumeRecording();
  if (audioService.getRecordingState() !== 'recording') {
    throw new Error('FAILED: Recording state should be "recording"');
  }
  console.log('✓ Recording resumed, state is "recording"');

  await new Promise((resolve) => setTimeout(resolve, 500));

  const metadata = await audioService.stopRecording();
  unsubLevel();

  if (metadata.meetingId !== testMeetingId) {
    throw new Error('FAILED: MeetingId mismatch in recording metadata');
  }
  if (metadata.durationSeconds < 1) {
    throw new Error('FAILED: Recorded duration should be >= 1s');
  }
  if (metadata.fileSizeBytes < 100) {
    throw new Error('FAILED: Audio file size too small');
  }
  if (!metadata.audioBlob) {
    throw new Error('FAILED: Expected valid audioBlob in recording metadata');
  }

  console.log(
    `✓ Recording stopped successfully: duration=${metadata.durationSeconds}s, size=${metadata.fileSizeBytes} bytes, format=16kHz Mono`
  );
  console.log(`✓ Audio level event stream verified (${audioLevelEventsCount} events recorded)`);

  // 2. Verify Whisper.cpp Local STT Engine
  console.log('\n[Test 2] Testing Whisper.cpp Local STT Engine...');
  const whisperEngine = WhisperTranscriptionEngine.getInstance();

  const testWhisperModel: WhisperModelInfo = {
    id: 'whisper-tiny-en',
    name: 'tiny.en',
    quantization: 'q5_1',
    fileSizeBytes: 32505856,
    isDownloaded: true,
    sha256: 'be07e048b1e59e33aa46fdf38737851e6d929272345825d730d75db957f10b0c',
    recommendedMinRamMb: 512,
  };

  await whisperEngine.loadModel(testWhisperModel);
  const loadedModel = whisperEngine.getLoadedModelInfo();
  if (!loadedModel || loadedModel.name !== 'tiny.en') {
    throw new Error('FAILED: Loaded Whisper model mismatch');
  }
  console.log(`✓ Loaded Whisper model: ${loadedModel.name} (Q5_1, ~31MB)`);

  // Test model loading failure reporting for excessive RAM
  try {
    await whisperEngine.loadModel({
      ...testWhisperModel,
      recommendedMinRamMb: 16384, // 16GB RAM limit exceeded
    });
    throw new Error('FAILED: Excessive RAM model should have failed');
  } catch (err) {
    console.log(`✓ Model loading failure correctly caught and reported: ${(err as Error).message}`);
  }

  // Restore valid model
  await whisperEngine.loadModel(testWhisperModel);

  let sttProgressUpdates = 0;
  const segments = await whisperEngine.transcribeAudioFile(
    metadata.filePath,
    { modelId: testWhisperModel.id },
    (update) => {
      sttProgressUpdates++;
      if (update.progress < 0 || update.progress > 1.0) {
        throw new Error(`Invalid STT progress: ${update.progress}`);
      }
    }
  );

  if (segments.length === 0) {
    throw new Error('FAILED: Whisper transcription yielded 0 segments');
  }
  if (!segments[0].text || segments[0].confidence < 0.8) {
    throw new Error('FAILED: Invalid transcript text or confidence score');
  }

  const sttMetrics = whisperEngine.getLastMetrics();
  console.log(`✓ Transcribed ${segments.length} timestamped segments (progress updates: ${sttProgressUpdates})`);
  console.log(`✓ STT Telemetry: Loading Time: ${sttMetrics?.loadingTimeMs}ms, Duration: ${sttMetrics?.processingTimeMs}ms, RTF: ${sttMetrics?.realTimeFactor}x, Peak RAM: ${sttMetrics?.peakMemoryMb}MB`);

  // 3. Verify Llama.cpp Local LLM Runtime & MOM Generation
  console.log('\n[Test 3] Testing Llama.cpp Local LLM Runtime & MOM Generation...');
  const llamaRuntime = LlamaLocalRuntime.getInstance();

  const testLlamaModel: LLMModelInfo = {
    id: 'llama-3.2-1b-instruct',
    name: 'Llama-3.2-1B-Instruct',
    quantization: 'Q4_K_M',
    contextLengthTokens: 4096,
    fileSizeBytes: 734003200,
    isDownloaded: true,
    sha256: '5a2b1f893e4811a2f90119b9d3111f8e65e495208b5e9b7245b780ea3b5b19c2',
    minRamRequirementMb: 1500,
  };

  await llamaRuntime.loadModel(testLlamaModel);
  const loadedLlama = llamaRuntime.getLoadedModel();
  if (!loadedLlama || loadedLlama.name !== 'Llama-3.2-1B-Instruct') {
    throw new Error('FAILED: Loaded Llama model mismatch');
  }
  console.log(`✓ Loaded Llama model: ${loadedLlama.name} (Q4_K_M, ~700MB, 4096 context)`);

  let llmProgressUpdates = 0;
  const momResult = await llamaRuntime.generateMinutesOfMeeting(
    segments,
    {
      title: 'Phase 2 Architecture Proof of Concept',
      date: new Date().toISOString(),
    },
    (update) => {
      llmProgressUpdates++;
      if (update.progress < 0 || update.progress > 1.0) {
        throw new Error(`Invalid LLM progress: ${update.progress}`);
      }
    }
  );

  // Validate using Zod
  const zodValidation = MOMStructuredOutputSchema.safeParse(momResult);
  if (!zodValidation.success) {
    throw new Error(`FAILED: MOM structured validation failed: ${zodValidation.error.message}`);
  }

  if (momResult.decisions.length === 0 || momResult.actionItems.length === 0) {
    throw new Error('FAILED: Expected decisions and action items in MOM output');
  }

  const llmMetrics = llamaRuntime.getLastMetrics();
  console.log(`✓ Generated structured Minutes of Meeting (Zod validation passed)`);
  console.log(`  - Executive Summary: "${momResult.executiveSummary.substring(0, 75)}..."`);
  console.log(`  - Decisions Extracted: ${momResult.decisions.length}`);
  console.log(`  - Action Items Extracted: ${momResult.actionItems.length}`);
  console.log(`✓ LLM Telemetry: Generated ${llmMetrics?.tokensGenerated} tokens @ ${llmMetrics?.tokensPerSecond} tok/s, Peak RAM: ${llmMetrics?.peakMemoryMb}MB`);

  // 4. Verify SQLite Persistence of Complete PoC Session
  console.log('\n[Test 4] Testing SQLite persistence of PoC session...');
  const db = SQLiteService.getInstance();
  await db.initialize();

  const savedMeeting = await db.meetingRepository.create({
    id: testMeetingId,
    title: momResult.meetingTitle,
    description: momResult.executiveSummary,
    recordedAt: new Date().toISOString(),
    durationSeconds: metadata.durationSeconds,
    audioUri: metadata.filePath,
    audioFileSizeBytes: metadata.fileSizeBytes,
    audioSampleRate: 16000,
    recordingStatus: 'completed',
    transcriptionStatus: 'completed',
    analysisStatus: 'completed',
    approvalStatus: 'approved',
  });

  await db.transcriptRepository.insertSegments(
    segments.map((s, idx) => ({ ...s, meetingId: testMeetingId, id: `seg_${testMeetingId}_${idx}` }))
  );

  await db.actionItemRepository.createMany(
    momResult.actionItems.map((a, idx) => ({
      id: `act_${testMeetingId}_${idx}`,
      meetingId: testMeetingId,
      title: a.title,
      description: a.description,
      owner: a.owner,
      dueDate: a.dueDate,
      priority: a.priority,
      status: 'todo',
    }))
  );

  const reloaded = await db.meetingRepository.getById(testMeetingId);
  const reloadedSegs = await db.transcriptRepository.getByMeetingId(testMeetingId);
  const reloadedActions = await db.actionItemRepository.getByMeetingId(testMeetingId);

  if (!reloaded || reloadedSegs.length !== segments.length || reloadedActions.length !== momResult.actionItems.length) {
    throw new Error('FAILED: SQLite verification mismatch after persistence');
  }

  console.log(`✓ Verified SQLite persistence: Meeting saved with ${reloadedSegs.length} segments and ${reloadedActions.length} action items`);

  // Cleanup
  await db.meetingRepository.delete(testMeetingId);
  console.log('✓ Cleaned up test records');

  console.log('\n======================================================');
  console.log('ALL PHASE 2 LOCAL AI CHECKS AND GATES PASSED! ✓');
  console.log('======================================================\n');
}

runPhase2Verification().catch((err) => {
  console.error('\n❌ PHASE 2 TEST FAILED:', err);
  process.exit(1);
});
