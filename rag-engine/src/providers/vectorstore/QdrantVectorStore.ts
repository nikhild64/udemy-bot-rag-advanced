import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import { VectorStore, VectorStoreCollectionInfo } from '@/core/contracts/vector-store.contract';
import { Chunk, SearchResult } from '@/core/models';
import { CollectionManager } from './CollectionManager';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { ValidationError } from '@/shared/errors';

function toValidQdrantId(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-8${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

export interface QdrantVectorStoreOptions {
  readonly url?: string;
  readonly apiKey?: string;
  readonly collectionName?: string;
  readonly distanceMetric?: string;
  readonly timeoutMs?: number;
  readonly client?: QdrantClient;
}



export class QdrantVectorStore implements VectorStore {
  readonly providerName = 'Qdrant Cloud';
  readonly collectionName: string;
  readonly distanceMetric: string;
  readonly timeoutMs: number;

  private readonly client: QdrantClient;
  readonly collectionManager: CollectionManager;

  constructor(options: QdrantVectorStoreOptions = {}) {
    this.collectionName = options.collectionName ?? config.vectorStore.vectorCollectionName ?? config.vectorStore.collectionName;
    this.distanceMetric = options.distanceMetric ?? config.vectorStore.distanceMetric;
    this.timeoutMs = options.timeoutMs ?? config.vectorStore.timeoutMs;

    if (options.client) {
      this.client = options.client;
    } else {
      const url = options.url ?? config.vectorStore.qdrantUrl;
      const apiKey = options.apiKey ?? config.vectorStore.qdrantApiKey;
      this.client = new QdrantClient({
        url,
        apiKey,
        timeout: this.timeoutMs,
        checkCompatibility: false,
      });
    }

    this.collectionManager = new CollectionManager(this.client, {
      collectionName: this.collectionName,
      distanceMetric: this.distanceMetric,
      timeoutMs: this.timeoutMs,
    });
  }

  async createCollection(collectionName?: string, dimension?: number, metric?: string): Promise<boolean> {
    return this.collectionManager.createCollection(collectionName ?? this.collectionName, dimension, metric ?? this.distanceMetric);
  }

  async deleteCollection(collectionName?: string): Promise<boolean> {
    return this.collectionManager.deleteCollection(collectionName ?? this.collectionName);
  }

  async collectionExists(collectionName?: string): Promise<boolean> {
    return this.collectionManager.collectionExists(collectionName ?? this.collectionName);
  }

  async getCollectionInfo(collectionName?: string): Promise<VectorStoreCollectionInfo | null> {
    return this.collectionManager.getCollectionInfo(collectionName ?? this.collectionName);
  }

  async validateCollection(collectionName?: string, expectedDimension?: number): Promise<boolean> {
    return this.collectionManager.validateCollection(collectionName ?? this.collectionName, expectedDimension);
  }

  async upsert(chunks: Chunk[], embeddings: number[][], collectionName?: string): Promise<void> {
    const name = collectionName ?? this.collectionName;

    if (chunks.length !== embeddings.length) {
      throw new ValidationError(`Mismatch between chunks count (${chunks.length}) and embeddings count (${embeddings.length})`);
    }

    if (chunks.length === 0) {
      return;
    }

    const seenIds = new Set<string>();
    const expectedDimension = config.embeddings.dimension ?? 1024;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = embeddings[i];

      if (!chunk || !chunk.id || typeof chunk.text !== 'string' || !chunk.metadata) {
        throw new ValidationError('Invalid payload: chunk metadata, id, or text is missing');
      }

      if (seenIds.has(chunk.id)) {
        throw new ValidationError(`Duplicate ID found in upsert batch: '${chunk.id}'`);
      }
      seenIds.add(chunk.id);

      if (!vector || !Array.isArray(vector) || vector.length === 0) {
        throw new ValidationError(`Invalid vector: embedding vector for chunk '${chunk.id}' is empty`);
      }

      if (vector.length !== expectedDimension) {
        throw new ValidationError(`Invalid vector dimensions: expected ${expectedDimension}, got ${vector.length}`);
      }

    }

    const points = chunks.map((chunk, i) => {
      const vector = embeddings[i]!;
      const meta = (chunk.metadata ?? {}) as Record<string, any>;

      // Explicit allowlist: store ONLY small chunk-specific scalar fields.
      // Do NOT spread arbitrary unknown metadata keys that could contain full-document blobs.
      const payload: Record<string, unknown> = {
        chunkId: chunk.id,
        text: chunk.text,
        content: chunk.text,
        notebookId: meta.notebookId ?? (chunk as any).notebookId ?? meta.courseId ?? 'knowledge-base',
        sourceId: meta.sourceId ?? (chunk as any).sourceId ?? meta.lessonId ?? chunk.id,
        chunkIndex: typeof meta.chunkIndex === 'number' ? meta.chunkIndex : (chunk as any).chunkIndex ?? i,

        title: meta.title ?? meta.displayName ?? 'Source Document',
        displayName: meta.displayName ?? meta.title ?? 'Source Document',
        sourceType: meta.sourceType ?? 'document',

        courseId: meta.courseId ?? meta.notebookId ?? 'knowledge-base',
        courseTitle: meta.courseTitle ?? meta.title ?? 'Knowledge Base',
        moduleId: meta.moduleId ?? meta.courseId ?? 'module-1',
        moduleTitle: meta.moduleTitle ?? meta.courseTitle ?? 'Knowledge Module',
        lessonId: meta.lessonId ?? meta.sourceId ?? chunk.id,
        lessonTitle: meta.lessonTitle ?? meta.displayName ?? meta.title ?? 'Source Document',

        transcriptFile: meta.transcriptFile ?? meta.storagePath ?? meta.fileUrl ?? '',
        startTime: typeof meta.startTime === 'number' ? meta.startTime : typeof meta.startChar === 'number' ? meta.startChar : 0,
        endTime: typeof meta.endTime === 'number' ? meta.endTime : typeof meta.endChar === 'number' ? meta.endChar : 0,
        page: typeof meta.page === 'number' ? meta.page : typeof meta.pageNumber === 'number' ? meta.pageNumber : null,
        timestamp: typeof meta.timestamp === 'number' ? meta.timestamp : null,
        section: typeof meta.section === 'string' ? meta.section : null,
        heading: typeof meta.heading === 'string' ? meta.heading : null,
      };

      return {
        id: toValidQdrantId(chunk.id),
        vector: vector,
        payload: payload,
      };
    });

    const startTime = Date.now();
    const BATCH_SIZE = 100;

    try {
      for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        await this.client.upsert(name, {
          wait: false,
          points: batch,
        });
      }
      const durationMs = Date.now() - startTime;
      logger.info({ collectionName: name, pointsCount: points.length, durationMs }, 'Upsert completed');
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
    }
  }

  async search(queryEmbedding: number[], limit?: number, collectionName?: string, filters?: Record<string, unknown>): Promise<SearchResult[]> {
    const name = collectionName ?? this.collectionName;

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new ValidationError('Invalid vector: query embedding vector is empty');
    }

    const expectedDimension = config.embeddings.dimension ?? 1024;
    if (queryEmbedding.length !== expectedDimension) {
      throw new ValidationError(`Invalid vector dimensions: expected ${expectedDimension}, got ${queryEmbedding.length}`);
    }

    const maxResults = limit && limit > 0 ? limit : 10;
    const startTime = Date.now();

    // Construct Qdrant filters if any
    let qdrantFilter: any = undefined;
    if (filters && Object.keys(filters).length > 0) {
      const validConditions = Object.entries(filters)
        .filter(([_, val]) => val !== undefined && val !== null && val !== '')
        .map(([key, value]) => ({
          key,
          match: { value: value as string | number | boolean },
        }));

      if (validConditions.length > 0) {
        qdrantFilter = { must: validConditions };
      }
    }

    const searchParams: any = {
      vector: queryEmbedding,
      limit: maxResults,
      with_payload: true,
    };
    if (qdrantFilter) {
      searchParams.filter = qdrantFilter;
    }

    let scoredPoints: any[] = [];
    try {
      scoredPoints = await this.client.search(name, searchParams);
    } catch (err) {
      if (searchParams.filter) {
        logger.warn({ err, name }, 'Qdrant search with filter failed, retrying search without payload filter');
        delete searchParams.filter;
        try {
          scoredPoints = await this.client.search(name, searchParams);
        } catch (fallbackErr) {
          this.collectionManager.handleQdrantError(fallbackErr, name);
        }
      } else {
        this.collectionManager.handleQdrantError(err, name);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info({ collectionName: name, resultsCount: scoredPoints.length, durationMs }, 'Search completed');

    return scoredPoints.map((point) => {
      const payloadCopy = { ...(point.payload ?? {}) } as Record<string, unknown>;
      const text = typeof payloadCopy.text === 'string' ? payloadCopy.text : '';
      const id = String(point.id);
      delete payloadCopy.text;

      return {
        score: typeof point.score === 'number' ? point.score : 0,
        chunk: {
          id,
          text,
          metadata: payloadCopy,
          courseId: typeof payloadCopy.courseId === 'string' ? payloadCopy.courseId : undefined,
          moduleId: typeof payloadCopy.moduleId === 'string' ? payloadCopy.moduleId : undefined,
          lessonId: typeof payloadCopy.lessonId === 'string' ? payloadCopy.lessonId : undefined,
          transcriptId: typeof payloadCopy.transcriptId === 'string' ? payloadCopy.transcriptId : undefined,
          chunkIndex: typeof payloadCopy.chunkIndex === 'number' ? payloadCopy.chunkIndex : undefined,
          startTime: typeof payloadCopy.startTime === 'number' ? payloadCopy.startTime : undefined,
          endTime: typeof payloadCopy.endTime === 'number' ? payloadCopy.endTime : undefined,
        } as any,
      };
    });
  }

  async deleteVectors(ids: string[], collectionName?: string): Promise<boolean> {
    const name = collectionName ?? this.collectionName;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('Invalid payload: ids array is empty');
    }

    for (const id of ids) {
      if (!id || typeof id !== 'string') {
        throw new ValidationError('Invalid payload: id must be a non-empty string');
      }
    }

    const startTime = Date.now();
    const validIds = ids.map((id) => toValidQdrantId(id));
    const BATCH_SIZE = 500;

    try {
      for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
        const batch = validIds.slice(i, i + BATCH_SIZE);
        await this.client.delete(name, {
          wait: true,
          points: batch,
        });
      }
      const durationMs = Date.now() - startTime;
      logger.info({ collectionName: name, idsCount: ids.length, durationMs }, 'Delete vectors completed');
      return true;
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
    }
  }

  async copyVectorsBySource(sourceId: string, newSourceId: string, newNotebookId: string, newTitle: string, collectionName?: string): Promise<number> {
    const name = collectionName ?? this.collectionName;
    const startTime = Date.now();
    let copiedCount = 0;
    
    try {
      let offset: any = undefined;
      const batchSize = 100;

      while (true) {
        const scrollOptions: any = {
          filter: {
            must: [
              {
                key: 'lessonId',
                match: { value: sourceId },
              },
            ],
          },
          limit: batchSize,
          with_payload: true,
          with_vector: true,
        };
        if (offset !== undefined) scrollOptions.offset = offset;

        const scrollRes = await this.client.scroll(name, scrollOptions);

        const points = scrollRes.points;
        if (!points || points.length === 0) {
          break;
        }

        const newPoints = points.map((p) => {
          const oldPayload = p.payload || {};
          const chunkId = crypto.randomUUID();
          
          const newPayload = {
            ...oldPayload,
            courseId: newNotebookId,
            courseTitle: newTitle,
            moduleId: newNotebookId,
            moduleTitle: newTitle,
            lessonId: newSourceId,
            lessonTitle: newTitle,
            notebookId: newNotebookId,
            sourceId: newSourceId,
            chunkId,
          };

          return {
            id: toValidQdrantId(chunkId),
            vector: p.vector as any,
            payload: newPayload,
          };
        });

        await this.client.upsert(name, {
          wait: true,
          points: newPoints,
        });

        copiedCount += newPoints.length;
        
        if (scrollRes.next_page_offset === undefined || scrollRes.next_page_offset === null) {
          break;
        }
        offset = scrollRes.next_page_offset;
      }

      const durationMs = Date.now() - startTime;
      logger.info({ collectionName: name, copiedCount, durationMs }, 'Copied vectors by source');
      return copiedCount;
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
      return 0;
    }
  }

  async deleteVectorsByFilter(collectionName?: string, filter?: Record<string, unknown>): Promise<boolean> {
    const name = collectionName ?? this.collectionName;

    if (!filter || Object.keys(filter).length === 0) {
      throw new ValidationError('Invalid payload: filter object is required to delete vectors by filter');
    }

    const startTime = Date.now();
    try {
      await this.client.delete(name, {
        wait: true,
        filter: filter as any,
      });
      const durationMs = Date.now() - startTime;
      logger.info({ collectionName: name, filter, durationMs }, 'Delete vectors by filter completed');
      return true;
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
      return false;
    }
  }
}
