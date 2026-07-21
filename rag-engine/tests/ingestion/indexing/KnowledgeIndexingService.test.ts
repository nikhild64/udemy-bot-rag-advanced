import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeIndexingService } from '@/ingestion/indexing/KnowledgeIndexingService';
import { IEmbeddingService } from '@/ingestion/embeddings';
import { VectorStore } from '@/providers/vectorstore';
import { ChunkingResult } from '@/ingestion/chunking';

describe('KnowledgeIndexingService', () => {
  let embeddingService: ReturnType<typeof vi.mocked<IEmbeddingService>>;
  let vectorStore: ReturnType<typeof vi.mocked<VectorStore>>;
  let indexingService: KnowledgeIndexingService;

  beforeEach(() => {
    embeddingService = {
      embedChunks: vi.fn(),
      embedChunkingResult: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<IEmbeddingService>>;

    vectorStore = {
      upsert: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<VectorStore>>;

    indexingService = new KnowledgeIndexingService(embeddingService, vectorStore);
  });

  const createChunkingResult = (courseId: string, chunksCount: number, success = true): ChunkingResult => {
    return {
      courseId,
      courseName: `Course ${courseId}`,
      lessonsCount: 1,
      transcriptsChunkedCount: 1,
      failedTranscriptsCount: 0,
      totalChunksCount: chunksCount,
      averageChunkSize: 100,
      durationMs: 100,
      success,
      chunks: Array.from({ length: chunksCount }, (_, i) => ({
        courseId,
        moduleId: 'mod1',
        lessonId: 'less1',
        cueId: `cue${i}`,
        text: `text ${i}`,
        startTime: 0,
        endTime: 1,
        order: i,
      })),
      transcriptResults: [],
      errors: success ? [] : ['Chunking failed'],
    };
  };

  it('skips chunking results that are not successful or have 0 chunks', async () => {
    const chunkingResults = [
      createChunkingResult('course1', 0),
      createChunkingResult('course2', 5, false),
    ];

    const reports = await indexingService.indexChunks(chunkingResults);

    expect(reports).toHaveLength(2);
    expect(reports[0]!.totalChunks).toBe(0);
    expect(reports[0]!.success).toBe(true);
    expect(reports[1]!.success).toBe(false);
    expect(reports[1]!.errors).toContain('Chunking failed');

    expect(embeddingService.embedChunks).not.toHaveBeenCalled();
    expect(vectorStore.upsert).not.toHaveBeenCalled();
  });

  it('indexes chunks successfully for a single course', async () => {
    const chunkingResults = [createChunkingResult('course1', 2)];

    embeddingService.embedChunks.mockResolvedValue({
      courseId: 'course1',
      courseName: 'Course course1',
      providerName: 'test',
      embeddingModel: 'test-model',
      chunksCount: 2,
      embeddingsGeneratedCount: 2,
      failedChunksCount: 0,
      durationMs: 100,
      success: true,
      embeddedChunks: chunkingResults[0]!.chunks!.map((c: any) => ({
        ...c,
        embedding: [1, 2, 3],
      })),
      errors: [],
    });

    vectorStore.upsert.mockResolvedValue(undefined);

    const reports = await indexingService.indexChunks(chunkingResults, {
      batchSize: 2,
      maxRetries: 0,
      retryDelayMs: 0,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]!.courseId).toBe('course1');
    expect(reports[0]!.success).toBe(true);
    expect(reports[0]!.totalChunks).toBe(2);
    expect(reports[0]!.successfulEmbeddings).toBe(2);
    expect(reports[0]!.successfulUploads).toBe(2);
    expect(reports[0]!.failedChunks).toBe(0);
    expect(reports[0]!.errors).toHaveLength(0);

    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(1);
    expect(vectorStore.upsert).toHaveBeenCalledTimes(1);
  });

  it('processes multiple chunking results correctly', async () => {
    const chunkingResults = [
      createChunkingResult('course1', 1),
      createChunkingResult('course2', 1),
    ];

    embeddingService.embedChunks.mockImplementation(async (batchChunks, opts) => {
      const courseId = opts?.courseId ?? 'unknown';
      return {
        courseId,
        courseName: `Course ${courseId}`,
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
        })),
        errors: [],
      };
    });

    vectorStore.upsert.mockResolvedValue(undefined);

    const reports = await indexingService.indexChunks(chunkingResults, {
      batchSize: 1,
      maxRetries: 0,
      retryDelayMs: 0,
    });

    expect(reports).toHaveLength(2);
    expect(reports[0]!.courseId).toBe('course1');
    expect(reports[0]!.success).toBe(true);
    expect(reports[1]!.courseId).toBe('course2');
    expect(reports[1]!.success).toBe(true);

    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(2);
    expect(vectorStore.upsert).toHaveBeenCalledTimes(2);
  });
});
