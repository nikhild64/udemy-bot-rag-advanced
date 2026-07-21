import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VectorStoreFactory,
  QdrantVectorStore,
  CollectionManager,
} from '@/providers/vectorstore';
import {
  ProviderError,
  NotFoundError,
  ValidationError,
  ConfigurationError,
} from '@/shared/errors';
import { Chunk } from '@/core/models';

describe('VectorStore Layer Implementation Tests', () => {
  let mockQdrantClient: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockQdrantClient = {
      collectionExists: vi.fn(),
      getCollection: vi.fn(),
      createCollection: vi.fn(),
      deleteCollection: vi.fn(),
      upsert: vi.fn(),
      search: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('VectorStoreFactory', () => {
    it('should create QdrantVectorStore instance by default or when requested', () => {
      const store1 = VectorStoreFactory.create();
      const store2 = VectorStoreFactory.create('qdrant', { client: mockQdrantClient });

      expect(store1).toBeInstanceOf(QdrantVectorStore);
      expect(store2).toBeInstanceOf(QdrantVectorStore);
    });

    it('should throw ConfigurationError for unsupported provider names', () => {
      expect(() => VectorStoreFactory.create('unknown-db')).toThrow(ConfigurationError);
    });
  });

  describe('CollectionManager', () => {
    let manager: CollectionManager;

    beforeEach(() => {
      manager = new CollectionManager(mockQdrantClient, {
        collectionName: 'test-collection',
        distanceMetric: 'Cosine',
      });
    });

    it('should check if collection exists via Qdrant SDK', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      const exists = await manager.collectionExists();
      expect(exists).toBe(true);
      expect(mockQdrantClient.collectionExists).toHaveBeenCalledWith('test-collection');
    });

    it('should get collection info and parse dimension/metric from object vector params', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      mockQdrantClient.getCollection.mockResolvedValue({
        status: 'green',
        vectors_count: 100,
        points_count: 100,
        segments_count: 2,
        config: {
          params: {
            vectors: {
              size: 1024,
              distance: 'Cosine',
            },
          },
        },
      });

      const info = await manager.getCollectionInfo();
      expect(info).toEqual({
        name: 'test-collection',
        status: 'green',
        vectorsCount: 100,
        pointsCount: 100,
        segmentsCount: 2,
        dimension: 1024,
        distanceMetric: 'Cosine',
        config: expect.any(Object),
      });
    });

    it('should get collection info and parse dimension/metric from map vector params', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      mockQdrantClient.getCollection.mockResolvedValue({
        status: 'yellow',
        vectors_count: 50,
        points_count: 50,
        segments_count: 1,
        config: {
          params: {
            vectors: {
              default: {
                size: 768,
                distance: 'Euclid',
              },
            },
          },
        },
      });

      const info = await manager.getCollectionInfo();
      expect(info?.dimension).toBe(768);
      expect(info?.distanceMetric).toBe('Euclid');
    });

    it('should return null for getCollectionInfo when collection does not exist', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: false });
      const info = await manager.getCollectionInfo();
      expect(info).toBeNull();
    });

    it('should create collection when it does not exist', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: false });
      mockQdrantClient.createCollection.mockResolvedValue(true);

      const created = await manager.createCollection('test-collection', 1024, 'Cosine');
      expect(created).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith('test-collection', {
        vectors: {
          size: 1024,
          distance: 'Cosine',
        },
      });
    });

    it('should return false for createCollection when collection already exists', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      const created = await manager.createCollection();
      expect(created).toBe(false);
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it('should delete collection when it exists', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      mockQdrantClient.deleteCollection.mockResolvedValue(true);

      const deleted = await manager.deleteCollection();
      expect(deleted).toBe(true);
      expect(mockQdrantClient.deleteCollection).toHaveBeenCalledWith('test-collection');
    });

    it('should throw NotFoundError when deleting non-existent collection', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: false });
      await expect(manager.deleteCollection()).rejects.toThrow(NotFoundError);
    });

    it('should validate collection dimension successfully when matching expected dimension', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      mockQdrantClient.getCollection.mockResolvedValue({
        status: 'green',
        config: { params: { vectors: { size: 1024, distance: 'Cosine' } } },
      });

      const valid = await manager.validateCollection('test-collection', 1024);
      expect(valid).toBe(true);
    });

    it('should throw ValidationError when vector dimensions mismatch during validation', async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });
      mockQdrantClient.getCollection.mockResolvedValue({
        status: 'green',
        config: { params: { vectors: { size: 768, distance: 'Cosine' } } },
      });

      await expect(manager.validateCollection('test-collection', 1024)).rejects.toThrow(
        ValidationError,
      );
    });

    describe('Error handling', () => {
      it('should wrap connection errors in ProviderError with status 503', async () => {
        mockQdrantClient.collectionExists.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(manager.collectionExists()).rejects.toThrow(ProviderError);
      });

      it('should wrap authentication failures in ProviderError with status 401', async () => {
        mockQdrantClient.collectionExists.mockRejectedValue({ status: 401, message: 'Unauthorized API key' });
        await expect(manager.collectionExists()).rejects.toThrow(ProviderError);
      });

      it('should wrap timeout failures in ProviderError with status 504', async () => {
        mockQdrantClient.collectionExists.mockRejectedValue(new Error('ETIMEDOUT'));
        await expect(manager.collectionExists()).rejects.toThrow(ProviderError);
      });
    });
  });

  describe('QdrantVectorStore Vector Operations', () => {
    let store: QdrantVectorStore;

    beforeEach(() => {
      store = new QdrantVectorStore({
        collectionName: 'test-collection',
        client: mockQdrantClient,
      });
    });

    describe('upsert()', () => {
      const sampleChunk: Chunk = {
        id: 'chk-1',
        text: 'Semantic chunk text content',
        metadata: {
          courseId: 'course-101',
          moduleId: 'mod-1',
          lessonId: 'less-1',
          transcriptId: 'trans-1',
          chunkIndex: 0,
        },
      };

      it('should successfully upsert chunks and vectors with valid payload and dimensions', async () => {
        const vector = new Array(1024).fill(0.1);
        mockQdrantClient.upsert.mockResolvedValue({ status: 'completed' });

        await store.upsert([sampleChunk], [vector]);

        expect(mockQdrantClient.upsert).toHaveBeenCalledWith('test-collection', {
          wait: true,
          points: [
            {
              id: 'chk-1',
              vector: vector,
              payload: {
                ...sampleChunk.metadata,
                text: 'Semantic chunk text content',
                chunkId: 'chk-1',
                courseId: 'course-101',
                moduleId: 'mod-1',
                lessonId: 'less-1',
                transcriptId: 'trans-1',
                chunkIndex: 0,
              },
            },
          ],
        });
      });

      it('should throw ValidationError if chunks count does not match embeddings count', async () => {
        const vector = new Array(1024).fill(0.1);
        await expect(store.upsert([sampleChunk], [vector, vector])).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError before calling Qdrant if any vector is empty', async () => {
        await expect(store.upsert([sampleChunk], [[]])).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.upsert).not.toHaveBeenCalled();
      });

      it('should throw ValidationError before calling Qdrant if vector dimensions do not match expected dimensions', async () => {
        const wrongDimVector = new Array(512).fill(0.1);
        await expect(store.upsert([sampleChunk], [wrongDimVector])).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.upsert).not.toHaveBeenCalled();
      });

      it('should throw ValidationError before calling Qdrant if chunk metadata or ID is missing', async () => {
        const invalidChunk = { id: '', text: 'some text', metadata: {} } as Chunk;
        const vector = new Array(1024).fill(0.1);
        await expect(store.upsert([invalidChunk], [vector])).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.upsert).not.toHaveBeenCalled();
      });

      it('should throw ValidationError before calling Qdrant if duplicate IDs exist in the batch', async () => {
        const vector1 = new Array(1024).fill(0.1);
        const vector2 = new Array(1024).fill(0.2);
        await expect(store.upsert([sampleChunk, sampleChunk], [vector1, vector2])).rejects.toThrow(
          ValidationError,
        );
        expect(mockQdrantClient.upsert).not.toHaveBeenCalled();
      });
    });

    describe('search()', () => {
      it('should perform vector similarity search and map ScoredPoint[] to domain SearchResult[]', async () => {
        const queryVector = new Array(1024).fill(0.5);
        mockQdrantClient.search.mockResolvedValue([
          {
            id: 'chk-1',
            score: 0.92,
            payload: {
              text: 'Found chunk content',
              chunkId: 'chk-1',
              courseId: 'course-101',
              moduleId: 'mod-1',
              lessonId: 'less-1',
              transcriptId: 'trans-1',
              chunkIndex: 0,
            },
          },
        ]);

        const results = await store.search(queryVector, 5);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          score: 0.92,
          chunk: {
            id: 'chk-1',
            text: 'Found chunk content',
            metadata: expect.any(Object),
            courseId: 'course-101',
            moduleId: 'mod-1',
            lessonId: 'less-1',
            transcriptId: 'trans-1',
            chunkIndex: 0,
            startTime: undefined,
            endTime: undefined,
          },
        });
        expect(mockQdrantClient.search).toHaveBeenCalledWith('test-collection', {
          vector: queryVector,
          limit: 5,
          with_payload: true,
        });
      });

      it('should throw ValidationError when search query vector is empty', async () => {
        await expect(store.search([])).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.search).not.toHaveBeenCalled();
      });

      it('should throw ValidationError when search query vector dimension mismatches', async () => {
        const wrongDimVector = new Array(128).fill(0.1);
        await expect(store.search(wrongDimVector)).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.search).not.toHaveBeenCalled();
      });
    });

    describe('deleteVectors()', () => {
      it('should delete vectors by IDs', async () => {
        mockQdrantClient.delete.mockResolvedValue({ status: 'completed' });
        const deleted = await store.deleteVectors(['chk-1', 'chk-2']);
        expect(deleted).toBe(true);
        expect(mockQdrantClient.delete).toHaveBeenCalledWith('test-collection', {
          wait: true,
          points: ['chk-1', 'chk-2'],
        });
      });

      it('should throw ValidationError when ids array is empty', async () => {
        await expect(store.deleteVectors([])).rejects.toThrow(ValidationError);
        expect(mockQdrantClient.delete).not.toHaveBeenCalled();
      });
    });
  });
});
