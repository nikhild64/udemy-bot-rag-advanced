import { Chunk } from '@/core/models';
import { IEmbeddingService } from '@/ingestion/embeddings';
import { VectorStore } from '@/providers/vectorstore';
import { IndexingProgress } from './IndexingProgress';
import { logger } from '@/shared/logger';

export interface BatchProcessorOptions {
  readonly batchSize: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

export class BatchProcessor {
  private readonly embeddingService: IEmbeddingService;
  private readonly vectorStore: VectorStore;
  private readonly options: BatchProcessorOptions;

  constructor(
    embeddingService: IEmbeddingService,
    vectorStore: VectorStore,
    options: BatchProcessorOptions,
  ) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.options = options;
  }

  public async processCourseChunks(
    courseId: string,
    courseName: string,
    chunks: readonly Chunk[],
    progress: IndexingProgress,
  ): Promise<string[]> {
    const errors: string[] = [];
    const batches: Chunk[][] = [];

    for (let i = 0; i < chunks.length; i += this.options.batchSize) {
      batches.push(chunks.slice(i, i + this.options.batchSize) as Chunk[]);
    }

    logger.info(
      { courseId, totalChunks: chunks.length, totalBatches: batches.length },
      'Batch processing started',
    );

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex] ?? [];
      if (batch.length === 0) continue;

      logger.info(
        { courseId, batchIndex: batchIndex + 1, totalBatches: batches.length, batchSize: batch.length },
        'Processing batch',
      );

      let batchErrors: string[] = [];
      let batchSuccessfulEmbeddings = 0;
      let batchSuccessfulUploads = 0;
      let batchFailedChunks = 0;

      try {
        await this.withRetry(async () => {
          batchErrors = [];
          batchSuccessfulEmbeddings = 0;
          batchSuccessfulUploads = 0;
          batchFailedChunks = 0;

          // 1. Generate embeddings for the batch
          const embedRes = await this.embeddingService.embedChunks(batch, {
            courseId,
            courseName,
          });

          if (!embedRes.success) {
            batchErrors.push(...embedRes.errors);
          }

          batchSuccessfulEmbeddings = embedRes.embeddingsGeneratedCount;
          batchFailedChunks = embedRes.failedChunksCount;

          // 2. Upload successfully embedded chunks to VectorStore
          if (embedRes.embeddedChunks.length > 0) {
            const rawVectors = embedRes.embeddedChunks.map((c) => c.embedding!);
            // Base chunks without the 'embedding' property
            const baseChunks: Chunk[] = embedRes.embeddedChunks.map((c) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { embedding, embeddingModel, embeddingDimension, providerName, provider, ...rest } = c;
              return rest as Chunk;
            });

            await this.vectorStore.upsert(baseChunks, rawVectors);
            batchSuccessfulUploads = embedRes.embeddedChunks.length;
          }
        }, progress, courseId, batchIndex);
        
        errors.push(...batchErrors);
        progress.addSuccessfulEmbeddings(batchSuccessfulEmbeddings);
        if (batchSuccessfulUploads > 0) {
          progress.addSuccessfulUploads(batchSuccessfulUploads);
        }
        if (batchFailedChunks > 0) {
          progress.addFailedChunks(batchFailedChunks);
        }

        logger.info(
          { courseId, batchIndex: batchIndex + 1, totalBatches: batches.length },
          'Batch completed',
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          { courseId, batchIndex: batchIndex + 1, err: errorMessage },
          'Batch processing failed after retries',
        );
        errors.push(`Batch ${batchIndex + 1} failed: ${errorMessage}`);
        
        // If the whole batch fails, record all chunks in this batch as failed
        progress.addFailedChunks(batch.length);
      }
    }

    return errors;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    progress: IndexingProgress,
    courseId: string,
    batchIndex: number,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        if (attempt > this.options.maxRetries) {
          throw error;
        }
        
        progress.incrementRetryCount();
        const delay = this.options.retryDelayMs;
        
        logger.warn(
          { courseId, batchIndex: batchIndex + 1, attempt, maxRetries: this.options.maxRetries, delay },
          'Retry performed due to error',
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
