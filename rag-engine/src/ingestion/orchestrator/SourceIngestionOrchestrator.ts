import { SourceStatus } from '@prisma/client';
import { ISourceRepository, INotebookRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { StorageService } from '@/services/StorageService';
import { SourceLoaderFactory } from '../loaders/SourceLoaderFactory';
import { ExtractorFactory } from '../extraction/extractors/ExtractorFactory';
import { DocumentNormalizer } from '../normalization/DocumentNormalizer';
import { SourceChunker } from '../chunking/SourceChunker';
import { IEmbeddingService, EmbeddingService } from '../embeddings';
import { VectorStore, VectorStoreFactory } from '@/providers/vectorstore';
import { IngestionQueue, IngestionStage } from '@/infrastructure/queue/IngestionQueue';
import { ingestionEvents } from '../events/IngestionEvents';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { NotFoundError, ValidationError, UnauthorizedError, IngestionError } from '@/shared/errors';
import { Chunk } from '@/core/models';

export interface SourceIngestionResult {
  sourceId: string;
  notebookId: string;
  status: SourceStatus;
  chunksCount: number;
  embeddingsCount: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export class SourceIngestionOrchestrator {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly storageService: StorageService = new StorageService(),
    private readonly embeddingService: IEmbeddingService = new EmbeddingService(),
    private readonly vectorStore: VectorStore = VectorStoreFactory.create(),
    private readonly queue: IngestionQueue = new IngestionQueue(),
  ) {}

  /**
   * Executes the full asynchronous ingestion workflow for a Knowledge Source document.
   */
  async ingestSource(
    sourceId: string,
    notebookId: string,
    userId: string,
    jobId?: string,
  ): Promise<SourceIngestionResult> {
    const startTime = Date.now();
    const currentJobId = jobId || `job_${sourceId}`;

    logger.info({ jobId: currentJobId, sourceId, notebookId, userId }, 'Starting Source Ingestion Orchestration workflow');
    ingestionEvents.publish('Job Started', { jobId: currentJobId, sourceId, notebookId, stage: 'Job Started' });

    try {
      // 1. Validation & Security Checks
      await this.updateProgress(sourceId, 'Queued', 5, 'Processing', currentJobId, notebookId);

      const source = await this.sourceRepository.findById(sourceId);
      if (!source) {
        throw new NotFoundError(`Source '${sourceId}' not found`);
      }

      if (source.notebookId !== notebookId) {
        throw new ValidationError(`Source '${sourceId}' does not belong to notebook '${notebookId}'`);
      }

      const notebook = await this.notebookRepository.findById(notebookId, userId);
      if (!notebook) {
        throw new NotFoundError(`Notebook '${notebookId}' not found for user '${userId}'`);
      }

      if (notebook.userId !== userId) {
        throw new UnauthorizedError(`User '${userId}' does not own notebook '${notebookId}'`);
      }

      if (!source.storagePath && !source.fileUrl && (!source.metadata || !(source.metadata as any).url)) {
        throw new ValidationError(`Source '${sourceId}' does not have a storagePath or fileUrl`);
      }

      // Update Source status in DB to Processing
      await this.sourceRepository.updateStatus(sourceId, SourceStatus.Processing);

      // 2. Download / Load Stage via SourceLoaderFactory
      await this.updateProgress(sourceId, 'Downloading', 15, 'Processing', currentJobId, notebookId);
      ingestionEvents.publish('Download Started', { jobId: currentJobId, sourceId, notebookId, stage: 'Downloading' });

      const loader = SourceLoaderFactory.getLoader(source.type, source, this.storageService);
      const rawContent = await loader.load(source);

      const rawLength = Buffer.isBuffer(rawContent.content)
        ? rawContent.content.length
        : Buffer.byteLength(rawContent.content, 'utf-8');

      logger.info(
        { sourceId, loader: loader.constructor.name, rawLength, mimeType: rawContent.mimeType },
        'Loaded source content successfully via SourceLoader',
      );

      // 3. Extraction Stage via ExtractorFactory
      await this.updateProgress(sourceId, 'Extracting', 30, 'Processing', currentJobId, notebookId);

      const extractor = ExtractorFactory.getExtractor(rawContent);
      const extractedDoc = await extractor.extract(rawContent);

      const extractedText = extractedDoc.content || extractedDoc.text || '';
      logger.info(
        { sourceId, extractor: extractor.constructor.name, extractedLength: extractedText.length, docTitle: extractedDoc.title },
        'Extracted content successfully via Extractor',
      );
      ingestionEvents.publish('Extraction Completed', {
        jobId: currentJobId,
        sourceId,
        notebookId,
        stage: 'Extracting',
        details: { extractedLength: extractedText.length, title: extractedDoc.title },
      });

      // 4. Normalization Stage
      await this.updateProgress(sourceId, 'Normalizing', 45, 'Processing', currentJobId, notebookId);

      const normalizedText = DocumentNormalizer.normalize(extractedText);
      logger.info({ sourceId, normalizedLength: normalizedText.length }, 'Normalized content successfully');
      ingestionEvents.publish('Normalization Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Normalizing', details: { normalizedLength: normalizedText.length } });


      // 5. Chunking Stage
      await this.updateProgress(sourceId, 'Chunking', 60, 'Processing', currentJobId, notebookId);

      const chunks = SourceChunker.chunk(normalizedText, sourceId, notebookId, {
        chunkSize: config.ingestion.chunkSize,
        chunkOverlap: config.ingestion.chunkOverlap,
        metadata: {
          title: source.title,
          displayName: source.displayName,
          sourceType: source.type,
          ...extractedDoc.metadata,
        },
      });

      logger.info({ sourceId, totalChunksCount: chunks.length }, 'Generated chunks successfully');
      ingestionEvents.publish('Chunking Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Chunking', details: { chunksCount: chunks.length } });

      if (chunks.length === 0) {
        throw new IngestionError(`Extracted document resulted in 0 valid chunks for source '${sourceId}'`);
      }

      // 6. Embedding Stage
      await this.updateProgress(sourceId, 'Embedding', 75, 'Processing', currentJobId, notebookId);

      // Convert SourceChunk models to Chunk models expected by EmbeddingService
      const domainChunks: Chunk[] = chunks.map((c) => ({
        id: c.chunkId,
        text: c.content,
        courseId: notebookId,
        metadata: {
          courseId: notebookId,
          courseTitle: source.title,
          moduleId: notebookId,
          moduleTitle: source.title,
          lessonId: sourceId,
          lessonTitle: source.title,
          transcriptId: c.chunkId,
          transcriptFile: source.storagePath || undefined,
          sourceId: c.sourceId,
          notebookId: c.notebookId,
          chunkIndex: c.chunkIndex,
          page: c.metadata.page ?? null,
          timestamp: c.metadata.timestamp ?? null,
          section: c.metadata.section ?? null,
          heading: c.metadata.heading ?? null,
          content: c.content,
          ...c.metadata,
        },
      }));

      const embeddingResult = await this.embeddingService.embedChunks(domainChunks, {
        courseId: notebookId,
        courseName: source.title,
      });

      if (!embeddingResult.success || embeddingResult.embeddedChunks.length === 0) {
        throw new IngestionError(
          `Embedding generation failed for source '${sourceId}': ${embeddingResult.errors.join('; ')}`,
        );
      }

      logger.info({ sourceId, embeddedChunksCount: embeddingResult.embeddedChunks.length }, 'Generated embeddings successfully');
      ingestionEvents.publish('Embedding Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Embedding', details: { embeddingsCount: embeddingResult.embeddedChunks.length } });

      // 7. Indexing Stage & Idempotency
      await this.updateProgress(sourceId, 'Indexing', 90, 'Processing', currentJobId, notebookId);

      const collectionName = config.vectorStore.userKnowledgeCollection;

      // Ensure user knowledge collection exists
      const exists = await this.vectorStore.collectionExists(collectionName);
      if (!exists) {
        await this.vectorStore.createCollection(collectionName, config.embeddings.dimension ?? 1024);
      }

      // Idempotency: Delete existing vectors for this source before indexing fresh vectors
      try {
        const existingChunkIds = chunks.map((c) => c.chunkId);
        if (existingChunkIds.length > 0) {
          await this.vectorStore.deleteVectors(existingChunkIds, collectionName).catch(() => {
            // Ignore error if points don't exist yet
          });
        }
      } catch (delErr) {
        logger.warn({ sourceId, delErr }, 'Cleaned up previous vector points or skipped delete');
      }

      // Upsert fresh vectors
      const chunkModels = embeddingResult.embeddedChunks.map((ec) => {
        const { courseId: _c, moduleId: _m, lessonId: _l, ...otherMeta } = ec.metadata;
        return {
          id: ec.id,
          text: ec.text,
          metadata: {
            ...otherMeta,
            notebookId,
            sourceId,
            chunkId: ec.id,
            chunkIndex: ec.metadata.chunkIndex,
            page: ec.metadata.page ?? null,
            content: ec.text,
            courseId: notebookId,
            courseTitle: source.title,
            moduleId: notebookId,
            moduleTitle: source.title,
            lessonId: sourceId,
            lessonTitle: source.title,
            transcriptFile: source.storagePath || undefined,
            startTime: ec.metadata.startChar || 0,
            endTime: ec.metadata.endChar || 0,
          },
        };
      });

      const vectors: number[][] = embeddingResult.embeddedChunks.map((ec) => Array.from(ec.embedding));

      await this.vectorStore.upsert(chunkModels as any, vectors, collectionName);

      logger.info({ sourceId, collectionName, indexedPointsCount: chunkModels.length }, 'Indexed vectors into Qdrant successfully');
      ingestionEvents.publish('Indexing Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Indexing', details: { pointsCount: chunkModels.length } });

      // 8. Update Source Lifecycle & Completed Progress
      const updatedMetadata = {
        ...((source.metadata as Record<string, any>) || {}),
        indexedAt: new Date().toISOString(),
        chunksCount: chunks.length,
        embeddingsCount: embeddingResult.embeddedChunks.length,
        error: null,
      };

      await this.sourceRepository.update(sourceId, userId, {
        status: SourceStatus.Indexed,
        metadata: updatedMetadata,
      });

      await this.updateProgress(sourceId, 'Completed', 100, 'Indexed', currentJobId, notebookId);
      ingestionEvents.publish('Job Finished', { jobId: currentJobId, sourceId, notebookId, stage: 'Completed', details: { durationMs: Date.now() - startTime } });

      const durationMs = Date.now() - startTime;
      logger.info({ jobId: currentJobId, sourceId, durationMs }, 'Source Ingestion Orchestration completed successfully');

      return {
        sourceId,
        notebookId,
        status: SourceStatus.Indexed,
        chunksCount: chunks.length,
        embeddingsCount: embeddingResult.embeddedChunks.length,
        durationMs,
        success: true,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({ jobId: currentJobId, sourceId, error: errorMessage, durationMs }, 'Source Ingestion Orchestration failed');

      // Update Source status to Failed in DB
      try {
        const currentSource = await this.sourceRepository.findById(sourceId);
        if (currentSource) {
          const updatedMetadata = {
            ...((currentSource.metadata as Record<string, any>) || {}),
            failedAt: new Date().toISOString(),
            error: errorMessage,
          };
          await this.sourceRepository.update(sourceId, userId, {
            status: SourceStatus.Failed,
            metadata: updatedMetadata,
          });
        }
      } catch (dbErr) {
        logger.warn({ sourceId, dbErr }, 'Failed to set Source status to Failed in DB');
      }

      await this.updateProgress(sourceId, 'Failed', 0, 'Failed', currentJobId, notebookId, errorMessage);
      ingestionEvents.publish('Job Failed', { jobId: currentJobId, sourceId, notebookId, stage: 'Failed', details: { error: errorMessage } });

      return {
        sourceId,
        notebookId,
        status: SourceStatus.Failed,
        chunksCount: 0,
        embeddingsCount: 0,
        durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  private async updateProgress(
    sourceId: string,
    stage: IngestionStage,
    percent: number,
    statusOverride?: 'Queued' | 'Processing' | 'Indexed' | 'Failed',
    _jobId?: string,
    _notebookId?: string,
    error?: string,
  ): Promise<void> {
    await this.queue.updateProgress(sourceId, stage, percent, statusOverride, error);
  }
}
