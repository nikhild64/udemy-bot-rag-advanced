import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService, EmbeddingValidator } from '../src/ingestion/embeddings';
import { Chunk, ChunkMetadata } from '../src/core/models';
import { EmbeddingProvider } from '../src/core/contracts';
import { ChunkingResult } from '../src/ingestion/chunking';

describe('EmbeddingValidator & EmbeddingService', () => {
  let mockProvider: EmbeddingProvider;
  let validator: EmbeddingValidator;
  let service: EmbeddingService;

  const sampleMeta: ChunkMetadata = {
    courseId: 'course-rag',
    moduleId: 'mod-1',
    lessonId: 'less-1',
    transcriptId: 'ts-1',
    startTime: 0,
    endTime: 10,
  };

  const sampleChunk1: Chunk = {
    id: 'chk-1',
    text: 'Introduction to semantic chunking.',
    metadata: sampleMeta,
    courseId: 'course-rag',
  };

  const sampleChunk2: Chunk = {
    id: 'chk-2',
    text: 'How vector embeddings work in RAG.',
    metadata: sampleMeta,
    courseId: 'course-rag',
  };

  const sampleChunk3: Chunk = {
    id: 'chk-3',
    text: 'Configuring Qdrant vector database.',
    metadata: sampleMeta,
    courseId: 'course-rag',
  };

  beforeEach(() => {
    mockProvider = {
      providerName: 'MockProvider',
      modelName: 'mock-embed-model',
      dimension: 3,
      embed: vi.fn().mockImplementation(async (texts: string[]) => {
        return texts.map(() => [0.1, 0.2, 0.3]);
      }),
    };

    validator = new EmbeddingValidator();
    service = new EmbeddingService(mockProvider, validator, 2); // batchSize = 2
  });

  describe('EmbeddingValidator', () => {
    it('should validate chunk text before embedding', () => {
      const validRes = validator.validateChunkBeforeEmbed(sampleChunk1);
      expect(validRes.valid).toBe(true);
      expect(validRes.errors).toHaveLength(0);

      const emptyTextChunk: Chunk = { ...sampleChunk1, text: '   ' };
      const invalidRes = validator.validateChunkBeforeEmbed(emptyTextChunk);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors[0]).toContain('Chunk text cannot be empty');
    });

    it('should validate embedding vector after generation', () => {
      const validRes = validator.validateEmbeddingVector(sampleChunk1, [0.1, 0.2, 0.3], 3);
      expect(validRes.valid).toBe(true);

      const emptyVecRes = validator.validateEmbeddingVector(sampleChunk1, [], 3);
      expect(emptyVecRes.valid).toBe(false);
      expect(emptyVecRes.errors[0]).toContain('Empty embedding vector');

      const nullVecRes = validator.validateEmbeddingVector(sampleChunk1, undefined, 3);
      expect(nullVecRes.valid).toBe(false);
      expect(nullVecRes.errors[0]).toContain('Missing provider response');

      const mismatchDimRes = validator.validateEmbeddingVector(sampleChunk1, [0.1, 0.2], 3);
      expect(mismatchDimRes.valid).toBe(false);
      expect(mismatchDimRes.errors[0]).toContain('Incorrect embedding dimension');
    });
  });

  describe('EmbeddingService', () => {
    it('should return clean summary when empty chunk array is provided', async () => {
      const result = await service.embedChunks([], { courseId: 'course-rag', courseName: 'RAG Course' });
      expect(result.chunksCount).toBe(0);
      expect(result.embeddingsGeneratedCount).toBe(0);
      expect(result.embeddedChunks).toEqual([]);
      expect(result.success).toBe(true);
      expect(mockProvider.embed).not.toHaveBeenCalled();
    });

    it('should generate embeddings for single chunk and preserve all original metadata exactly', async () => {
      const result = await service.embedChunks([sampleChunk1]);
      expect(result.chunksCount).toBe(1);
      expect(result.embeddingsGeneratedCount).toBe(1);
      expect(result.failedChunksCount).toBe(0);
      expect(result.success).toBe(true);

      const embedded = result.embeddedChunks[0];
      expect(embedded?.id).toBe(sampleChunk1.id);
      expect(embedded?.text).toBe(sampleChunk1.text);
      expect(embedded?.metadata).toEqual(sampleChunk1.metadata);
      expect(embedded?.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(embedded?.embeddingModel).toBe('mock-embed-model');
      expect(embedded?.embeddingDimension).toBe(3);
      expect(embedded?.providerName).toBe('MockProvider');
      expect(mockProvider.embed).toHaveBeenCalledTimes(1);
    });

    it('should split multiple chunks into batches of configured batchSize and process sequentially', async () => {
      const chunks = [sampleChunk1, sampleChunk2, sampleChunk3];
      const result = await service.embedChunks(chunks);

      expect(result.chunksCount).toBe(3);
      expect(result.embeddingsGeneratedCount).toBe(3);
      expect(result.success).toBe(true);
      expect(mockProvider.embed).toHaveBeenCalledTimes(2); // batchSize=2 -> 2 chunks in batch 1, 1 chunk in batch 2
      expect(mockProvider.embed).toHaveBeenNthCalledWith(1, [sampleChunk1.text, sampleChunk2.text]);
      expect(mockProvider.embed).toHaveBeenNthCalledWith(2, [sampleChunk3.text]);
    });

    it('should record validation errors and failedChunksCount without crashing other valid chunks', async () => {
      const invalidChunk: Chunk = { ...sampleChunk2, id: 'chk-invalid', text: '' };
      const chunks = [sampleChunk1, invalidChunk, sampleChunk3];

      const result = await service.embedChunks(chunks);
      expect(result.chunksCount).toBe(3);
      expect(result.embeddingsGeneratedCount).toBe(2);
      expect(result.failedChunksCount).toBe(1);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Chunk text cannot be empty');
    });

    it('should handle provider errors during batch processing gracefully', async () => {
      mockProvider.embed = vi.fn().mockRejectedValue(new Error('Network failure'));
      const result = await service.embedChunks([sampleChunk1]);

      expect(result.chunksCount).toBe(1);
      expect(result.embeddingsGeneratedCount).toBe(0);
      expect(result.failedChunksCount).toBe(1);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Batch 1 failed: Network failure');
    });

    it('should process ChunkingResult cleanly or skip when chunking failed or has zero chunks', async () => {
      const validChunkingRes: ChunkingResult = {
        courseId: 'course-rag',
        courseName: 'RAG Course',
        lessonsCount: 1,
        transcriptsChunkedCount: 1,
        failedTranscriptsCount: 0,
        totalChunksCount: 1,
        averageChunkSize: 100,
        durationMs: 5,
        success: true,
        chunks: [sampleChunk1],
        transcriptResults: [],
        errors: [],
      };

      const result = await service.embedChunkingResult(validChunkingRes);
      expect(result.embeddingsGeneratedCount).toBe(1);
      expect(result.success).toBe(true);

      const failedChunkingRes: ChunkingResult = {
        ...validChunkingRes,
        success: false,
        chunks: [],
        errors: ['Chunking error'],
      };

      const skippedResult = await service.embedChunkingResult(failedChunkingRes);
      expect(skippedResult.embeddingsGeneratedCount).toBe(0);
      expect(skippedResult.success).toBe(false);
      expect(skippedResult.errors).toContain('Chunking error');
    });
  });
});
