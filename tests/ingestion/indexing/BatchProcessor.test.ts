import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchProcessor } from '@/ingestion/indexing/BatchProcessor';
import { IndexingProgress } from '@/ingestion/indexing/IndexingProgress';
import { IEmbeddingService } from '@/ingestion/embeddings';
import { VectorStore } from '@/providers/vectorstore';
import { Chunk } from '@/core/models';

describe('BatchProcessor', () => {
  let embeddingService: ReturnType<typeof vi.mocked<IEmbeddingService>>;
  let vectorStore: ReturnType<typeof vi.mocked<VectorStore>>;
  let progress: IndexingProgress;
  let batchProcessor: BatchProcessor;

  beforeEach(() => {
    embeddingService = {
      embedChunks: vi.fn(),
      embedChunkingResult: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<IEmbeddingService>>;

    vectorStore = {
      upsert: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<VectorStore>>;

    progress = new IndexingProgress(100);

    batchProcessor = new BatchProcessor(embeddingService, vectorStore, {
      batchSize: 2,
      maxRetries: 2,
      retryDelayMs: 10,
    });
  });

  const createChunks = (count: number): Chunk[] => {
    return Array.from({ length: count }, (_, i) => ({
      courseId: 'course1',
      moduleId: 'mod1',
      lessonId: 'less1',
      cueId: `cue${i}`,
      text: `text ${i}`,
      startTime: 0,
      endTime: 1,
      order: i,
    }));
  };

  it('processes chunks in batches successfully', async () => {
    const chunks = createChunks(3); // 2 batches: size 2 and 1

    embeddingService.embedChunks.mockImplementation(async (batchChunks) => {
      return {
        courseId: 'course1',
        courseName: 'Course 1',
        providerName: 'test',
        embeddingModel: 'test-model',
        chunksCount: batchChunks.length,
        embeddingsGeneratedCount: batchChunks.length,
        failedChunksCount: 0,
        durationMs: 100,
        success: true,
        embeddedChunks: batchChunks.map((c: any) => ({
          ...c,
          embedding: [1, 2, 3],
          embeddingModel: 'test-model',
          embeddingDimension: 3,
          providerName: 'test',
          provider: 'test',
        })),
        errors: [],
      };
    });

    vectorStore.upsert.mockResolvedValue(undefined);

    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', chunks, progress);

    expect(errors).toHaveLength(0);
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(2);
    expect(vectorStore.upsert).toHaveBeenCalledTimes(2);
    expect(progress.successfulEmbeddings).toBe(3);
    expect(progress.successfulUploads).toBe(3);
    expect(progress.failedChunks).toBe(0);
  });

  it('handles empty chunks array', async () => {
    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', [], progress);

    expect(errors).toHaveLength(0);
    expect(embeddingService.embedChunks).not.toHaveBeenCalled();
    expect(vectorStore.upsert).not.toHaveBeenCalled();
    expect(progress.successfulEmbeddings).toBe(0);
    expect(progress.successfulUploads).toBe(0);
    expect(progress.failedChunks).toBe(0);
  });

  it('retries on embedding failure and succeeds', async () => {
    const chunks = createChunks(2);

    embeddingService.embedChunks
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        courseId: 'course1',
        courseName: 'Course 1',
        providerName: 'test',
        embeddingModel: 'test-model',
        chunksCount: chunks.length,
        embeddingsGeneratedCount: chunks.length,
        failedChunksCount: 0,
        durationMs: 100,
        success: true,
        embeddedChunks: chunks.map((c: any) => ({
          ...c,
          embedding: [1, 2, 3],
        })),
        errors: [],
      });

    vectorStore.upsert.mockResolvedValue(undefined);

    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', chunks, progress);

    expect(errors).toHaveLength(0);
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(2); // 1 fail, 1 success
    expect(vectorStore.upsert).toHaveBeenCalledTimes(1);
    expect(progress.retryCount).toBe(1);
    expect(progress.successfulUploads).toBe(2);
    expect(progress.failedChunks).toBe(0);
  });

  it('exhausts retries and records failure', async () => {
    const chunks = createChunks(2);

    embeddingService.embedChunks.mockRejectedValue(new Error('Persistent error'));

    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', chunks, progress);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Persistent error');
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(vectorStore.upsert).not.toHaveBeenCalled();
    expect(progress.retryCount).toBe(2);
    expect(progress.successfulUploads).toBe(0);
    expect(progress.failedChunks).toBe(2);
  });

  it('handles partial embedding validation failures', async () => {
    const chunks = createChunks(2);

    embeddingService.embedChunks.mockResolvedValue({
      courseId: 'course1',
      courseName: 'Course 1',
      providerName: 'test',
      embeddingModel: 'test-model',
      chunksCount: 2,
      embeddingsGeneratedCount: 1,
      failedChunksCount: 1,
      durationMs: 100,
      success: false,
      embeddedChunks: [
        {
          ...chunks[0],
          embedding: [1, 2, 3],
        } as any,
      ],
      errors: ['Validation failed for chunk 2'],
    });

    vectorStore.upsert.mockResolvedValue(undefined);

    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', chunks, progress);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Validation failed for chunk 2');
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(1);
    expect(vectorStore.upsert).toHaveBeenCalledTimes(1);
    expect(progress.successfulEmbeddings).toBe(1);
    expect(progress.successfulUploads).toBe(1);
    expect(progress.failedChunks).toBe(1);
  });

  it('retries on vector store upsert failure and records failure if exhausted', async () => {
    const chunks = createChunks(2);

    embeddingService.embedChunks.mockResolvedValue({
      courseId: 'course1',
      courseName: 'Course 1',
      providerName: 'test',
      embeddingModel: 'test-model',
      chunksCount: 2,
      embeddingsGeneratedCount: 2,
      failedChunksCount: 0,
      durationMs: 100,
      success: true,
      embeddedChunks: chunks.map((c: any) => ({
        ...c,
        embedding: [1, 2, 3],
      })),
      errors: [],
    });

    vectorStore.upsert.mockRejectedValue(new Error('Vector store error'));

    const errors = await batchProcessor.processCourseChunks('course1', 'Course 1', chunks, progress);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Vector store error');
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(3); // retries retry the WHOLE batch process
    expect(vectorStore.upsert).toHaveBeenCalledTimes(3);
    expect(progress.retryCount).toBe(2);
    expect(progress.successfulUploads).toBe(0);
    expect(progress.failedChunks).toBe(2);
  });
});
