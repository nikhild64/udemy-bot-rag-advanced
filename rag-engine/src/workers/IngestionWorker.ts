import { IngestionQueue, IngestionJobData } from '@/infrastructure/queue/IngestionQueue';
import { SourceIngestionOrchestrator } from '@/ingestion/orchestrator/SourceIngestionOrchestrator';
import { logger } from '@/shared/logger';
import { config } from '@/config';

export class IngestionWorker {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: IngestionQueue = new IngestionQueue(),
    private readonly orchestrator: SourceIngestionOrchestrator = new SourceIngestionOrchestrator(),
  ) {}

  /**
   * Start worker loop.
   */
  start(pollIntervalMs: number = 500): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ pollIntervalMs }, 'IngestionWorker started');

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        await this.processNextJob();
      } catch (err) {
        logger.error({ err }, 'Error in IngestionWorker loop execution');
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(loop, pollIntervalMs);
        }
      }
    };

    loop();
  }

  /**
   * Stop worker loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('IngestionWorker stopped');
  }

  /**
   * Process single next job from the queue.
   */
  async processNextJob(): Promise<boolean> {
    const job = await this.queue.popJob();
    if (!job) {
      return false;
    }

    await this.processJob(job);
    return true;
  }

  /**
   * Process specific job data with retry logic.
   */
  async processJob(job: IngestionJobData): Promise<void> {
    logger.info(
      { jobId: job.jobId, sourceId: job.sourceId, attempt: job.attempt ?? 1 },
      'Processing ingestion worker job',
    );

    const result = await this.orchestrator.ingestSource(
      job.sourceId,
      job.notebookId,
      job.userId,
      job.jobId,
    );

    if (!result.success) {
      const maxRetries = job.maxRetries ?? config.ingestion.retryCount;
      const currentAttempt = job.attempt ?? 1;

      if (currentAttempt < maxRetries) {
        const nextAttempt = currentAttempt + 1;
        const baseDelay = config.ingestion.retryDelayMs ?? 1000;
        const backoffMs = baseDelay * Math.pow(2, currentAttempt - 1);

        logger.warn(
          {
            jobId: job.jobId,
            sourceId: job.sourceId,
            attempt: currentAttempt,
            nextAttempt,
            maxRetries,
            backoffMs,
            error: result.error,
          },
          'Ingestion job failed, scheduling retry with backoff',
        );

        // Re-enqueue with incremented attempt after backoff
        setTimeout(async () => {
          await this.queue.enqueueJob({
            ...job,
            attempt: nextAttempt,
          });
        }, backoffMs);
      } else {
        logger.error(
          { jobId: job.jobId, sourceId: job.sourceId, attempts: currentAttempt, error: result.error },
          'Ingestion job failed permanently after reaching max retries',
        );
      }
    } else {
      logger.info({ jobId: job.jobId, sourceId: job.sourceId }, 'Ingestion job completed successfully');
    }
  }
}
