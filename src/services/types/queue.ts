export type JobType = 'transcription' | 'mom_generation' | 'action_extraction' | 'audio_export';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface ProcessingJob {
  id: string;
  meetingId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number; // 0.0 to 1.0
  stageName?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  payload?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  id: string;
  jobId: string;
  eventType: 'started' | 'progress' | 'retry' | 'completed' | 'failed' | 'interrupted';
  message: string;
  createdAt: string;
}

export type JobProgressListener = (job: ProcessingJob) => void;

export interface IProcessingQueue {
  enqueueJob(meetingId: string, jobType: JobType, payload?: Record<string, unknown>): Promise<ProcessingJob>;
  getJob(jobId: string): Promise<ProcessingJob | null>;
  getActiveJobs(): Promise<ProcessingJob[]>;
  getJobsForMeeting(meetingId: string): Promise<ProcessingJob[]>;
  cancelJob(jobId: string): Promise<void>;
  retryJob(jobId: string): Promise<ProcessingJob>;
  recoverInterruptedJobs(): Promise<ProcessingJob[]>;
  subscribe(listener: JobProgressListener): () => void;
}
