import { TranscriptSegment } from './stt.ts';

export interface ActionItemDraft {
  id?: string;
  title: string;
  description?: string;
  owner?: string | null;     // null if not explicitly mentioned
  dueDate?: string | null;   // null if not explicitly mentioned
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  sourceSegmentIds: string[];
}

export interface DecisionDraft {
  id?: string;
  title: string;
  rationale?: string;
  consensusLevel?: 'agreed' | 'majority' | 'tentative';
  sourceSegmentIds: string[];
}

export interface RiskDraft {
  title: string;
  mitigation?: string;
  severity: 'low' | 'medium' | 'high';
  sourceSegmentIds: string[];
}

export interface MOMStructuredOutput {
  meetingTitle: string;
  executiveSummary: string;
  agendaTopics: string[];
  keyDiscussionPoints: string[];
  decisions: DecisionDraft[];
  actionItems: ActionItemDraft[];
  risksAndBlockers: RiskDraft[];
  openQuestions: string[];
  nextSteps: string[];
  unsupportedClaimsWarnings?: string[];
}

export interface LLMModelInfo {
  id: string;
  name: string; // e.g., 'Llama-3.2-1B-Instruct'
  quantization: 'Q4_K_M' | 'Q5_K_M' | 'Q8_0';
  contextLengthTokens: number;
  fileSizeBytes: number;
  isDownloaded: boolean;
  localPath?: string;
  sha256: string;
  minRamRequirementMb: number;
}

export interface LLMInferenceProgress {
  progress: number; // 0.0 to 1.0
  tokensGenerated: number;
  tokensPerSecond: number;
  currentStage: 'chunking' | 'extracting' | 'validating' | 'finalizing';
}

export type LLMProgressCallback = (update: LLMInferenceProgress) => void;

export interface ILocalLLMRuntime {
  isAvailable(): Promise<boolean>;
  getLoadedModel(): LLMModelInfo | null;
  loadModel(modelInfo: LLMModelInfo): Promise<void>;
  unloadModel(): Promise<void>;
  generateMinutesOfMeeting(
    segments: TranscriptSegment[],
    meetingContext: { title: string; date: string; participants?: string[] },
    onProgress?: LLMProgressCallback
  ): Promise<MOMStructuredOutput>;
  cancelInference(): Promise<void>;
}
