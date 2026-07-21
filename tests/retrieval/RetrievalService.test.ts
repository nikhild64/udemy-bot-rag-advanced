import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalService } from '@/retrieval/RetrievalService';
import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { VectorStore } from '@/core/contracts/vector-store.contract';
import { AppError } from '@/shared/errors';
import { SearchResult } from '@/core/models';

describe('RetrievalService', () => {
  let embeddingProvider: ReturnType<typeof vi.mocked<EmbeddingProvider>>;
  let vectorStore: ReturnType<typeof vi.mocked<VectorStore>>;
  let service: RetrievalService;

  beforeEach(() => {
    embeddingProvider = {
      embed: vi.fn(),
      embedSingle: vi.fn(),
    } as any;

    vectorStore = {
      search: vi.fn(),
    } as any;

    service = new RetrievalService(embeddingProvider, vectorStore);
  });

  const mockSearchResult = (id: string, score: number): SearchResult => ({
    chunk: {
      id,
      text: `Text for ${id}`,
      metadata: { 
        courseId: 'course1',
        courseName: 'Test Course',
        moduleId: 'module1',
        moduleTitle: 'Test Module',
        lessonId: 'lesson1',
        lessonTitle: 'Test Lesson',
        sourceTranscriptPath: 'test.vtt',
        startTime: 10,
        endTime: 20
      },
    },
    score,
  });

  it('should successfully retrieve chunks for a valid query', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1, 0.2]);
    vectorStore.search.mockResolvedValueOnce([
      mockSearchResult('chunk1', 0.9),
      mockSearchResult('chunk2', 0.8),
    ]);

    const result = await service.search({ query: 'test query' });

    expect(result.query).toBe('test query');
    expect(result.totalResults).toBe(2);
    expect(result.retrievedChunks).toHaveLength(2);
    expect(result.statistics.highestScore).toBe(0.9);
    expect(result.statistics.lowestScore).toBe(0.8);
    expect(result.statistics.averageScore).toBeCloseTo(0.85);

    expect(embeddingProvider.embedSingle).toHaveBeenCalledWith('test query');
    expect(vectorStore.search).toHaveBeenCalledWith([0.1, 0.2], 5, undefined, undefined);
  });

  it('should throw error for empty query', async () => {
    await expect(service.search({ query: '' })).rejects.toThrow(AppError);
  });

  it('should filter chunks based on minimum score', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1]);
    vectorStore.search.mockResolvedValueOnce([
      mockSearchResult('chunk1', 0.9),
      mockSearchResult('chunk2', 0.6),
    ]);

    const result = await service.search({ query: 'test', minimumScore: 0.7 });

    expect(result.totalResults).toBe(1);
    expect(result.retrievedChunks[0].chunkId).toBe('chunk1');
  });

  it('should pass filters to the vector store', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1]);
    vectorStore.search.mockResolvedValueOnce([]);

    await service.search({
      query: 'test',
      filters: { courseId: 'c1' },
    });

    expect(vectorStore.search).toHaveBeenCalledWith([0.1], 5, undefined, { courseId: 'c1' });
  });

  it('should fallback to embed() if embedSingle() is not available', async () => {
    embeddingProvider.embedSingle = undefined;
    embeddingProvider.embed.mockResolvedValueOnce([[0.1]]);
    vectorStore.search.mockResolvedValueOnce([]);

    await service.search({ query: 'test' });

    expect(embeddingProvider.embed).toHaveBeenCalledWith(['test']);
  });

  it('should throw AppError if embedding fails', async () => {
    embeddingProvider.embedSingle!.mockRejectedValueOnce(new Error('Embedding error'));
    
    await expect(service.search({ query: 'test' })).rejects.toThrow('Embedding generation failed');
  });

  it('should throw AppError if vector search fails', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1]);
    vectorStore.search.mockRejectedValueOnce(new Error('Search error'));

    await expect(service.search({ query: 'test' })).rejects.toThrow('Vector search failed');
  });

  it('should handle zero matching documents', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1]);
    vectorStore.search.mockResolvedValueOnce([]);

    const result = await service.search({ query: 'test' });

    expect(result.totalResults).toBe(0);
    expect(result.statistics.averageScore).toBe(0);
    expect(result.statistics.highestScore).toBe(0);
    expect(result.statistics.lowestScore).toBe(0);
  });
  it('should generate citations and preserve metadata', async () => {
    embeddingProvider.embedSingle!.mockResolvedValueOnce([0.1, 0.2]);
    vectorStore.search.mockResolvedValueOnce([
      mockSearchResult('chunk1', 0.95),
    ]);

    const result = await service.search({ query: 'test query' });

    expect(result.retrievedChunks).toHaveLength(1);
    const chunk = result.retrievedChunks[0];
    
    // Check RetrievedChunk enhancements
    expect(chunk.startTime).toBe(10);
    expect(chunk.endTime).toBe(20);
    expect(chunk.sourceReference.courseName).toBe('Test Course');
    expect(chunk.sourceReference.moduleTitle).toBe('Test Module');
    expect(chunk.sourceReference.lessonTitle).toBe('Test Lesson');
    expect(chunk.sourceReference.transcriptFile).toBe('test.vtt');
    
    // Check Citation generation
    expect(result.citations).toHaveLength(1);
    const citation = result.citations[0];
    expect(citation.chunkId).toBe('chunk1');
    expect(citation.courseId).toBe('course1');
    expect(citation.courseName).toBe('Test Course');
    expect(citation.moduleId).toBe('module1');
    expect(citation.moduleTitle).toBe('Test Module');
    expect(citation.lessonId).toBe('lesson1');
    expect(citation.lessonTitle).toBe('Test Lesson');
    expect(citation.transcriptFile).toBe('test.vtt');
    expect(citation.startTime).toBe(10);
    expect(citation.endTime).toBe(20);
    expect(citation.similarityScore).toBe(0.95);
  });
});
