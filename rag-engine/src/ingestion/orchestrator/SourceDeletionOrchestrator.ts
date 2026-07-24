
import { ISourceRepository, INotebookRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { StorageService } from '@/services/StorageService';
import { VectorStore, VectorStoreFactory } from '@/providers/vectorstore';
import { logger } from '@/shared/logger';
import { NotFoundError, UnauthorizedError } from '@/shared/errors';
import { config } from '@/config';

export class SourceDeletionOrchestrator {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly storageService: StorageService = new StorageService(),
    private readonly vectorStore: VectorStore = VectorStoreFactory.create(),
  ) {}

  /**
   * Orchestrates the complete deletion of a source, including vector embeddings,
   * storage files, database records, and notebook statistics.
   */
  async deleteSource(sourceId: string, userId: string): Promise<boolean> {
    logger.info({ sourceId, userId }, 'Starting SourceDeletionOrchestrator workflow');

    // 1. Validation & Security Checks
    const source = await this.sourceRepository.findById(sourceId, userId);
    if (!source) {
      throw new NotFoundError(`Source '${sourceId}' not found for user '${userId}'`);
    }

    const notebook = await this.notebookRepository.findById(source.notebookId, userId);
    if (!notebook) {
      throw new UnauthorizedError(`User '${userId}' does not own notebook '${source.notebookId}'`);
    }

    // 2. Mark Source as Deleting
    await this.sourceRepository.updateStatus(sourceId, 'Deleting' as any);

    // 3. Delete Vector Embeddings
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
      logger.info({ sourceId, collectionName }, 'Deleted vector embeddings successfully');
    } catch (err) {
      logger.warn({ sourceId, err }, 'Failed to delete vector embeddings or none existed');
    }

    // 4. Delete Storage
    if (source.storagePath) {
      try {
        await this.storageService.deleteFile(source.storagePath);
        logger.info({ sourceId, storagePath: source.storagePath }, 'Deleted storage file successfully');
      } catch (err) {
        logger.warn({ sourceId, err }, 'Failed to delete storage file or it did not exist');
      }
    }

    // 5. Delete Database Record
    const deleted = await this.sourceRepository.delete(sourceId, userId);
    logger.info({ sourceId, userId, deleted }, 'Deleted source database record successfully');

    // 6. Update Notebook Statistics
    try {
      // Re-calculate statistics for the notebook
      const sources = await this.sourceRepository.findMany({ notebookId: source.notebookId, userId, limit: 10000 });
      let totalSources = 0;
      let indexedSources = 0;
      let failedSources = 0;
      let totalChunks = 0;
      let totalVectors = 0;
      let storageUsage = 0;

      for (const s of sources.data) {
        totalSources++;
        if (s.status === 'Ready') indexedSources++;
        if (s.status === 'Failed') failedSources++;
        
        const meta = (s.metadata as any) || {};
        totalChunks += (meta.chunksCount || 0);
        totalVectors += (meta.embeddingsCount || 0);
        storageUsage += (s.size || 0);
      }

      const stats = {
        totalSources,
        indexedSources,
        failedSources,
        totalChunks,
        totalVectors,
        storageUsage,
      };

      await this.notebookRepository.update(source.notebookId, userId, { stats } as any);
      logger.info({ notebookId: source.notebookId, stats }, 'Updated notebook statistics successfully');
    } catch (err) {
      logger.warn({ notebookId: source.notebookId, err }, 'Failed to update notebook statistics');
    }

    return deleted;
  }
}
