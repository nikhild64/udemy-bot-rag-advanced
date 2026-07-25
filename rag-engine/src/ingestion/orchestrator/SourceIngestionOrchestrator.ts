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
import { ChatRole } from '@/types';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';

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

      // Check for cancellation before starting
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

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

      if (!source.storagePath && !source.fileUrl && (!source.metadata || (!(source.metadata as any).url && !(source.metadata as any).rawText))) {
        throw new ValidationError(`Source '${sourceId}' does not have a storagePath, fileUrl, or rawText`);
      }

      // Update Source status in DB to Downloading
      await this.sourceRepository.updateStatus(sourceId, 'Downloading' as any);

      // --- Deduplication for YOUTUBE (and potentially others in the future) ---
      if (source.type === 'YOUTUBE' && source.fileUrl && this.sourceRepository.findExistingReadySourceByUrl) {
        const existingSource = await this.sourceRepository.findExistingReadySourceByUrl(source.fileUrl);
        
        if (existingSource && this.vectorStore.copyVectorsBySource) {
          logger.info({ sourceId, existingSourceId: existingSource.id }, 'Found existing Ready source for URL, deduplicating embeddings');
          
          await this.updateProgress(sourceId, 'Embedding', 75, 'Processing', currentJobId, notebookId);
          await this.sourceRepository.updateStatus(sourceId, 'Embedding' as any);

          const copiedCount = await this.vectorStore.copyVectorsBySource(
            existingSource.id,
            source.id,
            notebookId,
            source.title,
            config.vectorStore.userKnowledgeCollection
          );

          if (copiedCount > 0) {
            const updatedMetadata = {
              ...((source.metadata as Record<string, any>) || {}),
              indexedAt: new Date().toISOString(),
              chunksCount: (existingSource.metadata as any)?.chunksCount || copiedCount,
              embeddingsCount: copiedCount,
              error: null,
              deduplicatedFrom: existingSource.id
            };

            await this.sourceRepository.update(sourceId, userId, {
              status: 'Ready' as any,
              metadata: updatedMetadata,
            });

            await this.updateProgress(sourceId, 'Completed', 100, 'Indexed', currentJobId, notebookId);
            ingestionEvents.publish('Job Finished', { jobId: currentJobId, sourceId, notebookId, stage: 'Completed', details: { durationMs: Date.now() - startTime } });

            const durationMs = Date.now() - startTime;
            logger.info({ jobId: currentJobId, sourceId, durationMs, copiedCount }, 'Source Ingestion Orchestration completed instantly via deduplication');

            this.updateNotebookStats(notebookId, userId).catch(e => logger.warn({ err: e }, 'Failed to update notebook stats async'));

            return {
              sourceId,
              notebookId,
              status: 'Ready' as any,
              chunksCount: updatedMetadata.chunksCount,
              embeddingsCount: copiedCount,
              durationMs,
              success: true,
            };
          }
        }
      }

      // Cancellation checkpoint — before download
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

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

      // Cancellation checkpoint — before extraction
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

      // 3. Extraction Stage via ExtractorFactory
      await this.updateProgress(sourceId, 'Extracting', 30, 'Processing', currentJobId, notebookId);
      await this.sourceRepository.updateStatus(sourceId, 'Extracting' as any);

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

      // Cancellation checkpoint — before normalization
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

      // 4. Normalization Stage
      await this.updateProgress(sourceId, 'Normalizing', 45, 'Processing', currentJobId, notebookId);
      await this.sourceRepository.updateStatus(sourceId, 'Normalizing' as any);

      const normalizedText = DocumentNormalizer.normalize(extractedText);
      logger.info({ sourceId, normalizedLength: normalizedText.length }, 'Normalized content successfully');
      ingestionEvents.publish('Normalization Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Normalizing', details: { normalizedLength: normalizedText.length } });

      // Generate AI title for Website or generic titled sources
      let finalTitle = extractedDoc.title || source.title;
      const isGenericTitle =
        !finalTitle ||
        finalTitle === 'Web Source' ||
        finalTitle === 'Untitled Web Page' ||
        /^https?:\/\//i.test(finalTitle);

      if ((source.type === 'WEBSITE' || isGenericTitle) && normalizedText.length > 50) {
        finalTitle = await this.generateAiTitle(normalizedText, finalTitle || 'Web Source');
        logger.info({ sourceId, finalTitle }, 'Generated AI title for web source');
      }

      // Cancellation checkpoint — before chunking
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

      // 5. Chunking Stage
      await this.updateProgress(sourceId, 'Chunking', 60, 'Processing', currentJobId, notebookId);
      await this.sourceRepository.updateStatus(sourceId, 'Chunking' as any);

      const {
        pageTexts: _pageTexts,
        rawText: _rawText,
        fullText: _fullText,
        content: _content,
        body: _body,
        buffer: _buffer,
        info: _info,
        ...documentMetadata
      } = (extractedDoc.metadata as Record<string, any>) || {};
      const baseChunkMetadata = {
        title: finalTitle,
        displayName: finalTitle,
        sourceType: source.type,
        ...documentMetadata,
      };
      const pageTexts = source.type === 'PDF' && Array.isArray((extractedDoc.metadata as Record<string, any>)?.pageTexts)
        ? (extractedDoc.metadata as Record<string, any>).pageTexts as Array<{ page: number; text: string }>
        : [];
      let nextChunkIndex = 0;
      const chunks = pageTexts.length > 0
        ? pageTexts.flatMap((page) => {
            const pageChunks = SourceChunker.chunk(page.text, sourceId, notebookId, {
              chunkSize: config.ingestion.chunkSize,
              chunkOverlap: config.ingestion.chunkOverlap,
              chunkIndexOffset: nextChunkIndex,
              metadata: { ...baseChunkMetadata, page: page.page },
            });
            nextChunkIndex += pageChunks.length;
            return pageChunks;
          })
        : SourceChunker.chunk(normalizedText, sourceId, notebookId, {
            chunkSize: config.ingestion.chunkSize,
            chunkOverlap: config.ingestion.chunkOverlap,
            metadata: baseChunkMetadata,
          });

      logger.info({ sourceId, totalChunksCount: chunks.length }, 'Generated chunks successfully');
      ingestionEvents.publish('Chunking Completed', { jobId: currentJobId, sourceId, notebookId, stage: 'Chunking', details: { chunksCount: chunks.length } });

      if (chunks.length === 0) {
        throw new IngestionError(`Extracted document resulted in 0 valid chunks for source '${sourceId}'`);
      }

      // Cancellation checkpoint — before embedding (most expensive stage)
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

      // 6. Embedding Stage
      await this.updateProgress(sourceId, 'Embedding', 75, 'Processing', currentJobId, notebookId);
      await this.sourceRepository.updateStatus(sourceId, 'Embedding' as any);

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
          transcriptFile: source.storagePath || source.fileUrl || source.title || '',
          startTime: c.metadata.startChar ?? 0,
          endTime: c.metadata.endChar ?? 0,
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

      // Cancellation checkpoint — before indexing
      if (await this.isCancelled(sourceId)) {
        return this.buildCancelledResult(sourceId, notebookId, startTime, currentJobId);
      }

      // 7. Indexing Stage & Idempotency
      await this.updateProgress(sourceId, 'Indexing', 90, 'Processing', currentJobId, notebookId);
      await this.sourceRepository.updateStatus(sourceId, 'Indexing' as any);

      const collectionName = config.vectorStore.userKnowledgeCollection;

      // Ensure user knowledge collection exists with correct dimension
      const expectedDim = config.embeddings.dimension ?? 1024;
      const exists = await this.vectorStore.collectionExists(collectionName);
      if (!exists) {
        await this.vectorStore.createCollection(collectionName, expectedDim);
      } else if (typeof this.vectorStore.getCollectionInfo === 'function') {
        const info = await this.vectorStore.getCollectionInfo(collectionName).catch(() => null);
        if (info && info.dimension !== undefined && info.dimension !== expectedDim) {
          logger.warn({ collectionName, oldDim: info.dimension, newDim: expectedDim }, 'Recreating Qdrant collection due to dimension mismatch');
          await this.vectorStore.deleteCollection(collectionName).catch(() => {});
          await this.vectorStore.createCollection(collectionName, expectedDim);
        }
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
        const {
          courseId: _c,
          moduleId: _m,
          lessonId: _l,
          rawText: _rt,
          fullText: _ft,
          pageTexts: _pt,
          content: _cnt,
          body: _bd,
          buffer: _bf,
          info: _inf,
          ...otherMeta
        } = ec.metadata;
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
        rawText: normalizedText,
        indexedAt: new Date().toISOString(),
        chunksCount: chunks.length,
        embeddingsCount: embeddingResult.embeddedChunks.length,
        error: null,
      };

      await this.sourceRepository.update(sourceId, userId, {
        title: finalTitle,
        displayName: finalTitle,
        status: 'Ready' as any,
        metadata: updatedMetadata,
      });

      await this.updateProgress(sourceId, 'Completed', 100, 'Indexed', currentJobId, notebookId);
      ingestionEvents.publish('Job Finished', { jobId: currentJobId, sourceId, notebookId, stage: 'Completed', details: { durationMs: Date.now() - startTime } });

      const durationMs = Date.now() - startTime;
      logger.info({ jobId: currentJobId, sourceId, durationMs }, 'Source Ingestion Orchestration completed successfully');

      // Update Notebook Stats
      this.updateNotebookStats(notebookId, userId).catch(e => logger.warn({ err: e }, 'Failed to update notebook stats async'));

      return {
        sourceId,
        notebookId,
        status: 'Ready' as any,
        chunksCount: chunks.length,
        embeddingsCount: embeddingResult.embeddedChunks.length,
        durationMs,
        success: true,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({ jobId: currentJobId, sourceId, error: errorMessage, durationMs }, 'Source Ingestion Orchestration failed');

      // Clean up any partially-indexed vectors so they don't corrupt search results
      await this.cleanupPartialVectors(sourceId);

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

  /**
   * Check if the source has been cancelled by the user.
   * Reads the latest source status from the DB to detect if cancelSource() was called.
   */
  private async isCancelled(sourceId: string): Promise<boolean> {
    try {
      const source = await this.sourceRepository.findById(sourceId);
      if (!source) return false;

      const meta = (source.metadata as Record<string, any>) || {};
      // Source was cancelled if status is Failed AND metadata has cancelledAt
      if (source.status === SourceStatus.Failed && meta.cancelledAt) {
        logger.info({ sourceId }, 'Source ingestion cancelled by user — aborting pipeline');
        return true;
      }
      return false;
    } catch (err) {
      logger.warn({ sourceId, err }, 'Failed to check cancellation status, continuing pipeline');
      return false;
    }
  }

  /**
   * Clean up any partially-indexed vectors for a source.
   * Uses the same filter pattern as SourceDeletionOrchestrator.
   */
  private async cleanupPartialVectors(sourceId: string): Promise<void> {
    try {
      const collectionName = config.vectorStore.userKnowledgeCollection;
      if (typeof this.vectorStore.deleteVectorsByFilter === 'function') {
        await this.vectorStore.deleteVectorsByFilter(collectionName, {
          should: [
            { key: 'sourceId', match: { value: sourceId } },
            { key: 'lessonId', match: { value: sourceId } },
          ],
        });
        logger.info({ sourceId, collectionName }, 'Cleaned up partial vectors for cancelled/failed source');
      }
    } catch (err) {
      logger.warn({ sourceId, err }, 'Failed to clean up partial vectors (may not exist yet)');
    }
  }

  /**
   * Build a standardised cancelled result and publish events.
   */
  private async buildCancelledResult(
    sourceId: string,
    notebookId: string,
    startTime: number,
    jobId: string,
  ): Promise<SourceIngestionResult> {
    const durationMs = Date.now() - startTime;
    logger.info({ sourceId, durationMs }, 'Source ingestion aborted — cancelled by user');

    // Clean up any partially-indexed vectors
    await this.cleanupPartialVectors(sourceId);

    await this.updateProgress(sourceId, 'Failed', 0, 'Failed', jobId, notebookId, 'Cancelled by user');
    ingestionEvents.publish('Job Failed', { jobId, sourceId, notebookId, stage: 'Failed', details: { error: 'Cancelled by user' } });

    return {
      sourceId,
      notebookId,
      status: SourceStatus.Failed,
      chunksCount: 0,
      embeddingsCount: 0,
      durationMs,
      success: false,
      error: 'Cancelled by user',
    };
  }

  private async updateNotebookStats(notebookId: string, userId: string): Promise<void> {
    const sources = await this.sourceRepository.findMany({ notebookId, userId, limit: 10000 });
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

    await this.notebookRepository.update(notebookId, userId, { stats } as any);
  }

  private async generateAiTitle(text: string, defaultTitle: string): Promise<string> {
    try {
      const chatProvider = ChatProviderFactory.create();
      const prompt = `Generate a short, concise, descriptive title (3 to 6 words) summarizing the main topic of the following website article/content. Do NOT use quotation marks, markdown, or prefixes like "Title:". Output ONLY the title text.

Content:
${text.slice(0, 1500)}`;

      const response = await chatProvider.generateResponse(
        [{ role: ChatRole.USER, content: prompt }],
        { task: 'chat' }
      );
      const cleaned = response.message?.content?.trim().replace(/^["']|["']$/g, '');
      if (cleaned && cleaned.length >= 3 && cleaned.length <= 80) {
        return cleaned;
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to generate AI title for website source');
    }
    return defaultTitle;
  }
}
