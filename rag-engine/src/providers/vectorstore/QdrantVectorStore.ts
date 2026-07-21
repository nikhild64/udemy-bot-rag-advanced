import { QdrantClient } from '@qdrant/js-client-rest';
import { VectorStore, VectorStoreCollectionInfo } from '@/core/contracts/vector-store.contract';
import { Chunk, SearchResult } from '@/core/models';
import { CollectionManager } from './CollectionManager';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { ValidationError } from '@/shared/errors';

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

      const requiredMetadata = [
        'courseId',
        'courseTitle',
        'moduleId',
        'moduleTitle',
        'lessonId',
        'lessonTitle',
        'transcriptFile',
        'startTime',
        'endTime',
      ];

      for (const field of requiredMetadata) {
        if (chunk.metadata[field] === undefined || chunk.metadata[field] === null) {
          throw new ValidationError(`Invalid payload: missing required metadata field '${field}' for chunk '${chunk.id}'`);
        }
      }
    }

    const points = chunks.map((chunk, i) => {
      const vector = embeddings[i]!;
      const payload: Record<string, unknown> = {
        ...chunk.metadata,
        text: chunk.text,
        chunkId: chunk.id,
      };
      if (chunk.courseId !== undefined) payload.courseId = chunk.courseId;
      if (chunk.moduleId !== undefined) payload.moduleId = chunk.moduleId;
      if (chunk.lessonId !== undefined) payload.lessonId = chunk.lessonId;
      if (chunk.transcriptId !== undefined) payload.transcriptId = chunk.transcriptId;
      if (chunk.chunkIndex !== undefined) payload.chunkIndex = chunk.chunkIndex;
      if (chunk.startTime !== undefined) payload.startTime = chunk.startTime;
      if (chunk.endTime !== undefined) payload.endTime = chunk.endTime;

      return {
        id: chunk.id,
        vector: vector,
        payload: payload,
      };
    });

    const startTime = Date.now();
    try {
      await this.client.upsert(name, {
        wait: true,
        points: points,
      });
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
    let qdrantFilter: any;
    if (filters && Object.keys(filters).length > 0) {
      qdrantFilter = {
        must: Object.entries(filters).map(([key, value]) => ({
          key,
          match: { value },
        })),
      };
    }

    try {
      const scoredPoints = await this.client.search(name, {
        vector: queryEmbedding,
        limit: maxResults,
        with_payload: true,
        filter: qdrantFilter,
      });

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
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
    }
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
    try {
      await this.client.delete(name, {
        wait: true,
        points: ids,
      });
      const durationMs = Date.now() - startTime;
      logger.info({ collectionName: name, idsCount: ids.length, durationMs }, 'Delete vectors completed');
      return true;
    } catch (err) {
      this.collectionManager.handleQdrantError(err, name);
    }
  }
}
