import { ChunkingResult } from '@/ingestion/chunking';
import { IndexingReport } from './IndexingReport';
import { IndexingOptions } from './IndexingOptions';
import { IndexingProgress } from './IndexingProgress';
import { BatchProcessor } from './BatchProcessor';
import { IEmbeddingService, EmbeddingService } from '@/ingestion/embeddings';
import { VectorStore, VectorStoreFactory } from '@/providers/vectorstore';
import { config } from '@/config';
import { logger } from '@/shared/logger';

export interface IKnowledgeIndexingService {
  indexChunks(
    chunkingResults: readonly ChunkingResult[],
    options?: IndexingOptions,
  ): Promise<IndexingReport[]>;
}

export class KnowledgeIndexingService implements IKnowledgeIndexingService {
  private readonly embeddingService: IEmbeddingService;
  private readonly vectorStore: VectorStore;

  constructor(
    embeddingService?: IEmbeddingService,
    vectorStore?: VectorStore,
  ) {
    this.embeddingService = embeddingService ?? new EmbeddingService();
    this.vectorStore = vectorStore ?? VectorStoreFactory.create();
  }

  public async indexChunks(
    chunkingResults: readonly ChunkingResult[],
    options?: IndexingOptions,
  ): Promise<IndexingReport[]> {
    const batchSize = options?.batchSize ?? config.indexing.batchSize;
    const maxRetries = options?.maxRetries ?? config.indexing.maxRetries;
    const retryDelayMs = options?.retryDelayMs ?? config.indexing.retryDelayMs;

    const batchProcessor = new BatchProcessor(
      this.embeddingService,
      this.vectorStore,
      { batchSize, maxRetries, retryDelayMs },
    );

    const reports: IndexingReport[] = [];

    for (const chunkRes of chunkingResults) {
      if (!chunkRes.success || !chunkRes.chunks || chunkRes.chunks.length === 0) {
        logger.warn(
          { courseId: chunkRes.courseId },
          'Skipping indexing for course with chunking errors or 0 chunks',
        );
        reports.push({
          courseId: chunkRes.courseId,
          courseName: chunkRes.courseName,
          totalChunks: chunkRes.totalChunksCount,
          successfulEmbeddings: 0,
          successfulUploads: 0,
          failedChunks: chunkRes.totalChunksCount,
          durationMs: 0,
          retryCount: 0,
          success: chunkRes.success,
          errors: chunkRes.errors,
        });
        continue;
      }

      logger.info(
        { courseId: chunkRes.courseId, totalChunks: chunkRes.chunks.length },
        'Indexing started for course',
      );

      const progress = new IndexingProgress(chunkRes.chunks.length);
      const batchErrors = await batchProcessor.processCourseChunks(
        chunkRes.courseId,
        chunkRes.courseName,
        chunkRes.chunks,
        progress,
      );

      const success = progress.failedChunks === 0 && batchErrors.length === 0;

      const report: IndexingReport = {
        courseId: chunkRes.courseId,
        courseName: chunkRes.courseName,
        totalChunks: progress.totalChunks,
        successfulEmbeddings: progress.successfulEmbeddings,
        successfulUploads: progress.successfulUploads,
        failedChunks: progress.failedChunks,
        durationMs: progress.elapsedMs,
        retryCount: progress.retryCount,
        success,
        errors: batchErrors,
      };

      reports.push(report);

      logger.info(
        {
          courseId: report.courseId,
          totalChunks: report.totalChunks,
          successfulUploads: report.successfulUploads,
          failedChunks: report.failedChunks,
          durationMs: report.durationMs,
          success: report.success,
        },
        'Indexing completed for course',
      );
    }

    return reports;
  }
}
