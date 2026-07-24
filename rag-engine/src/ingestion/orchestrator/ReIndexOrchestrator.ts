
import { ISourceRepository, INotebookRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { VectorStore, VectorStoreFactory } from '@/providers/vectorstore';
import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';
import { logger } from '@/shared/logger';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors';
import { config } from '@/config';

export class ReIndexOrchestrator {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly vectorStore: VectorStore = VectorStoreFactory.create(),
    private readonly queue: IngestionQueue = new IngestionQueue(),
  ) {}

  /**
   * Orchestrates the re-indexing of a source. Deletes existing vectors,
   * resets the status, and queues a new ingestion job.
   */
  async reindexSource(sourceId: string, userId: string): Promise<any> {
    logger.info({ sourceId, userId }, 'Starting ReIndexOrchestrator workflow');

    // 1. Validation & Security Checks
    const source = await this.sourceRepository.findById(sourceId, userId);
    if (!source) {
      throw new NotFoundError(`Source '${sourceId}' not found for user '${userId}'`);
    }

    const notebook = await this.notebookRepository.findById(source.notebookId, userId);
    if (!notebook) {
      throw new UnauthorizedError(`User '${userId}' does not own notebook '${source.notebookId}'`);
    }

    if (!source.storagePath && !source.fileUrl && (!source.metadata || (!(source.metadata as any).url && !(source.metadata as any).rawText))) {
      throw new ValidationError(`Source '${sourceId}' cannot be re-indexed as it lacks original file or content`);
    }

    // 2. Delete Existing Vectors
    try {
      const collectionName = config.vectorStore.userKnowledgeCollection;
      if (typeof this.vectorStore.deleteVectorsByFilter === 'function') {
        await this.vectorStore.deleteVectorsByFilter(collectionName, {
          should: [
            { key: 'sourceId', match: { value: sourceId } },
            { key: 'lessonId', match: { value: sourceId } },
          ],
        });
      }
      logger.info({ sourceId, collectionName }, 'Cleaned up previous vector embeddings for re-indexing');
    } catch (err) {
      logger.warn({ sourceId, err }, 'Failed to delete vector embeddings or none existed during re-indexing');
    }

    // 3. Reset Status and Process metadata
    const { chunksCount, embeddingsCount, error, failedAt, ...restMetadata } = (source.metadata as Record<string, any>) || {};
    
    const updatedMetadata = {
      ...restMetadata,
      reindexedAt: new Date().toISOString(),
    };

    const updatedSource = await this.sourceRepository.update(sourceId, userId, {
      status: 'Queued' as any,
      metadata: updatedMetadata,
    });
    logger.info({ sourceId }, 'Reset source status to Queued');

    // 4. Queue Ingestion Job
    try {
      await this.queue.enqueueJob({
        sourceId: source.id,
        notebookId: source.notebookId,
        userId,
      });
      logger.info({ sourceId }, 'Queued new ingestion job for re-indexing');
    } catch (queueErr) {
      logger.warn({ queueErr, sourceId: source.id }, 'Failed to enqueue re-indexing job');
      throw queueErr;
    }

    return updatedSource;
  }
}
