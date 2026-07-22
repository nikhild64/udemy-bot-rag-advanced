import { getRedisClient } from '@/shared/redis/redis';
import { logger } from '@/shared/logger';
import { config } from '@/config';
import Redis from 'ioredis';

export type IngestionStage =
  | 'Queued'
  | 'Downloading'
  | 'Extracting'
  | 'Normalizing'
  | 'Chunking'
  | 'Embedding'
  | 'Indexing'
  | 'Completed'
  | 'Failed';

export interface IngestionJobData {
  jobId: string;
  sourceId: string;
  notebookId: string;
  userId: string;
  storagePath?: string;
  mimeType?: string;
  attempt?: number;
  maxRetries?: number;
  createdAt?: string;
}

export interface IngestionJobProgress {
  jobId: string;
  sourceId: string;
  notebookId: string;
  status: 'Queued' | 'Processing' | 'Indexed' | 'Failed';
  currentStage: IngestionStage;
  progress: number;
  error?: string | null;
  attempt: number;
  updatedAt: string;
}

const QUEUE_KEY = 'ingestion:queue';
const JOB_STATUS_PREFIX = 'ingestion:job:';

export class IngestionQueue {
  private redis: Redis | null = null;
  private static memoryQueue: IngestionJobData[] = [];
  private static memoryStatus: Map<string, IngestionJobProgress> = new Map();

  constructor(redisClient?: Redis) {
    if (redisClient) {
      this.redis = redisClient;
    } else {
      try {
        this.redis = getRedisClient();
      } catch (err) {
        this.redis = null;
      }
    }
  }

  private isRedisReady(): boolean {
    return !!(this.redis && (this.redis.status === 'ready' || this.redis.status === 'connect'));
  }

  /**
   * Queue a new ingestion job.
   */
  async enqueueJob(data: Omit<IngestionJobData, 'jobId'> & { jobId?: string; attempt?: number }): Promise<IngestionJobProgress> {
    const jobId = data.jobId || `job_${data.sourceId}_${Date.now()}`;
    const attempt = data.attempt ?? 1;
    const jobPayload: IngestionJobData = {
      ...data,
      jobId,
      attempt,
      maxRetries: data.maxRetries ?? config.ingestion.retryCount,
      createdAt: new Date().toISOString(),
    };

    const initialProgress: IngestionJobProgress = {
      jobId,
      sourceId: data.sourceId,
      notebookId: data.notebookId,
      status: 'Queued',
      currentStage: 'Queued',
      progress: 0,
      error: null,
      attempt,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (this.redis && this.isRedisReady()) {
        await this.redis.rpush(QUEUE_KEY, JSON.stringify(jobPayload));
        await this.redis.set(
          `${JOB_STATUS_PREFIX}${data.sourceId}`,
          JSON.stringify(initialProgress),
          'EX',
          86400 * 7, // 7 days expiration
        );
      } else {
        // Fallback to in-memory queue
        IngestionQueue.memoryQueue.push(jobPayload);
        IngestionQueue.memoryStatus.set(data.sourceId, initialProgress);
      }

      logger.info({ jobId, sourceId: data.sourceId }, 'Enqueued ingestion job');
      return initialProgress;
    } catch (error) {
      logger.warn({ error, sourceId: data.sourceId }, 'Redis enqueue failed, using in-memory queue');
      IngestionQueue.memoryQueue.push(jobPayload);
      IngestionQueue.memoryStatus.set(data.sourceId, initialProgress);
      return initialProgress;
    }
  }

  /**
   * Pop next job from queue for processing.
   */
  async popJob(): Promise<IngestionJobData | null> {
    try {
      if (this.redis && this.isRedisReady()) {
        const raw = await this.redis.lpop(QUEUE_KEY);
        if (raw) {
          return JSON.parse(raw) as IngestionJobData;
        }
      } else {
        const job = IngestionQueue.memoryQueue.shift();
        if (job) return job;
      }
      return null;
    } catch (error) {
      logger.warn({ error }, 'Redis popJob failed, falling back to memory queue');
      return IngestionQueue.memoryQueue.shift() || null;
    }
  }

  /**
   * Update progress status of a job.
   */
  async updateProgress(
    sourceId: string,
    currentStage: IngestionStage,
    progressPercent: number,
    statusOverride?: 'Queued' | 'Processing' | 'Indexed' | 'Failed',
    error?: string | null,
  ): Promise<IngestionJobProgress | null> {
    let status: 'Queued' | 'Processing' | 'Indexed' | 'Failed' = 'Processing';
    if (statusOverride) {
      status = statusOverride;
    } else if (currentStage === 'Completed' || (currentStage === 'Indexing' && progressPercent === 100)) {
      status = 'Indexed';
    } else if (currentStage === 'Failed') {
      status = 'Failed';
    } else if (currentStage === 'Queued') {
      status = 'Queued';
    }

    const currentProgress = await this.getJobStatus(sourceId);

    const updated: IngestionJobProgress = {
      jobId: currentProgress?.jobId || `job_${sourceId}`,
      sourceId,
      notebookId: currentProgress?.notebookId || 'unknown',
      status,
      currentStage,
      progress: Math.min(100, Math.max(0, progressPercent)),
      error: error !== undefined ? error : currentProgress?.error || null,
      attempt: currentProgress?.attempt || 1,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (this.redis && this.isRedisReady()) {
        await this.redis.set(
          `${JOB_STATUS_PREFIX}${sourceId}`,
          JSON.stringify(updated),
          'EX',
          86400 * 7,
        );
      } else {
        IngestionQueue.memoryStatus.set(sourceId, updated);
      }
    } catch (err) {
      IngestionQueue.memoryStatus.set(sourceId, updated);
    }

    return updated;
  }

  /**
   * Get progress/status for a given source ID.
   */
  async getJobStatus(sourceId: string): Promise<IngestionJobProgress | null> {
    try {
      if (this.redis && this.isRedisReady()) {
        const raw = await this.redis.get(`${JOB_STATUS_PREFIX}${sourceId}`);
        if (raw) {
          return JSON.parse(raw) as IngestionJobProgress;
        }
      }
      return IngestionQueue.memoryStatus.get(sourceId) || null;
    } catch (err) {
      return IngestionQueue.memoryStatus.get(sourceId) || null;
    }
  }

  /**
   * Clear all queue memory/redis data (for testing purposes).
   */
  async clear(): Promise<void> {
    IngestionQueue.memoryQueue = [];
    IngestionQueue.memoryStatus.clear();
    try {
      if (this.redis && this.isRedisReady()) {
        const keys = await this.redis.keys(`${JOB_STATUS_PREFIX}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        await this.redis.del(QUEUE_KEY);
      }
    } catch (err) {
      // ignore clear errors
    }
  }
}
