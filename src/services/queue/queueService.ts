import {
  IProcessingQueue,
  ProcessingJob,
  JobType,
  JobStatus,
  JobProgressListener,
} from '../types/queue.ts';
import { SQLiteService } from '../database/sqliteService.ts';

export class ProcessingQueueService implements IProcessingQueue {
  private static instance: ProcessingQueueService;
  private jobs: Map<string, ProcessingJob> = new Map();
  private listeners: Set<JobProgressListener> = new Set();

  private constructor() {}

  public static getInstance(): ProcessingQueueService {
    if (!ProcessingQueueService.instance) {
      ProcessingQueueService.instance = new ProcessingQueueService();
    }
    return ProcessingQueueService.instance;
  }

  async enqueueJob(
    meetingId: string,
    jobType: JobType,
    payload?: Record<string, unknown>
  ): Promise<ProcessingJob> {
    const now = new Date().toISOString();
    const job: ProcessingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      meetingId,
      jobType,
      status: 'queued',
      progress: 0.0,
      stageName: 'Queued for offline processing',
      attemptCount: 1,
      maxAttempts: 3,
      payload,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.id, job);

    // Persist to SQLite
    try {
      const db = SQLiteService.getInstance();
      await db.processingJobRepository.createJob(job);
    } catch (e) {
      console.warn('Queue SQLite persist warning:', e);
    }

    this.notify(job);
    return job;
  }

  async updateJob(
    jobId: string,
    updates: Partial<ProcessingJob>
  ): Promise<ProcessingJob> {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);

    const updated: ProcessingJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);

    try {
      const db = SQLiteService.getInstance();
      await db.processingJobRepository.updateJob(jobId, updates);
    } catch (e) {
      console.warn('Queue SQLite update warning:', e);
    }

    this.notify(updated);
    return updated;
  }

  async getJob(jobId: string): Promise<ProcessingJob | null> {
    if (this.jobs.has(jobId)) {
      return this.jobs.get(jobId)!;
    }
    try {
      const db = SQLiteService.getInstance();
      return await db.processingJobRepository.getJob(jobId);
    } catch {
      return null;
    }
  }

  async getActiveJobs(): Promise<ProcessingJob[]> {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === 'queued' || j.status === 'running'
    );
  }

  async getJobsForMeeting(meetingId: string): Promise<ProcessingJob[]> {
    const memJobs = Array.from(this.jobs.values()).filter((j) => j.meetingId === meetingId);
    if (memJobs.length > 0) return memJobs;
    try {
      const db = SQLiteService.getInstance();
      return await db.processingJobRepository.getByMeetingId(meetingId);
    } catch {
      return [];
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.updateJob(jobId, {
      status: 'cancelled',
      stageName: 'Cancelled by user',
    });
  }

  async retryJob(jobId: string): Promise<ProcessingJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    return await this.updateJob(jobId, {
      status: 'queued',
      attemptCount: job.attemptCount + 1,
      progress: 0.0,
      stageName: 'Retrying offline processing',
      errorMessage: undefined,
    });
  }

  async recoverInterruptedJobs(): Promise<ProcessingJob[]> {
    const recovered: ProcessingJob[] = [];

    // Check memory jobs
    for (const job of this.jobs.values()) {
      if (job.status === 'running') {
        job.status = 'interrupted';
        job.stageName = 'Interrupted by application restart';
        job.updatedAt = new Date().toISOString();
        recovered.push(job);
        this.notify(job);
      }
    }

    // Check SQLite persistence
    try {
      const db = SQLiteService.getInstance();
      const dbInterrupted = await db.processingJobRepository.markRunningAsInterrupted();
      for (const j of dbInterrupted) {
        this.jobs.set(j.id, j);
        if (!recovered.find((r) => r.id === j.id)) {
          recovered.push(j);
        }
      }
    } catch (e) {
      console.warn('Queue SQLite recovery warning:', e);
    }

    return recovered;
  }

  subscribe(listener: JobProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(job: ProcessingJob) {
    this.listeners.forEach((listener) => listener(job));
  }
}
