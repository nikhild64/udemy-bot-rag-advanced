import { describe, it, expect } from 'vitest';
import { ContextMerger } from '@/retrieval/ContextMerger';
import { RetrievalResult, RetrievedChunk } from '@/retrieval/RetrievalResult';

describe('ContextMerger', () => {
  const createMockChunk = (id: string, score: number, text: string): RetrievedChunk => ({
    chunkId: id,
    score,
    text,
    startTime: 0,
    endTime: 10,
    metadata: {},
    chunk: { id, text, metadata: {} },
    sourceReference: {
      courseName: 'Course',
      moduleTitle: 'Module',
      lessonTitle: 'Lesson',
      transcriptFile: 'file.vtt',
      startTime: 0,
      endTime: 10,
    },
    citation: {
      chunkId: id,
      courseId: 'c1',
      courseName: 'Course',
      moduleId: 'm1',
      moduleTitle: 'Module',
      lessonId: 'l1',
      lessonTitle: 'Lesson',
      transcriptFile: 'file.vtt',
      startTime: 0,
      endTime: 10,
      similarityScore: score,
    },
  });

  it('should merge results and deduplicate chunks keeping highest similarity score', () => {
    const result1: RetrievalResult = {
      query: 'query 1',
      retrievedChunks: [
        createMockChunk('chunk-1', 0.85, 'Text 1'),
        createMockChunk('chunk-2', 0.70, 'Text 2'),
      ],
      citations: [],
      totalResults: 2,
      elapsedTime: 50,
      statistics: {
        searchDurationMs: 30,
        embeddingDurationMs: 20,
        retrievedChunksCount: 2,
        appliedFilters: null,
        averageScore: 0.775,
        highestScore: 0.85,
        lowestScore: 0.70,
      },
    };

    const result2: RetrievalResult = {
      query: 'query 2',
      retrievedChunks: [
        createMockChunk('chunk-2', 0.92, 'Text 2 (Higher Score)'),
        createMockChunk('chunk-3', 0.80, 'Text 3'),
      ],
      citations: [],
      totalResults: 2,
      elapsedTime: 60,
      statistics: {
        searchDurationMs: 40,
        embeddingDurationMs: 20,
        retrievedChunksCount: 2,
        appliedFilters: null,
        averageScore: 0.86,
        highestScore: 0.92,
        lowestScore: 0.80,
      },
    };

    const merged = ContextMerger.mergeResults([result1, result2], 'query 1', 10);

    expect(merged.totalResults).toBe(3);
    expect(merged.retrievedChunks[0]!.chunkId).toBe('chunk-2');
    expect(merged.retrievedChunks[0]!.score).toBe(0.92);
    expect(merged.retrievedChunks[1]!.chunkId).toBe('chunk-1');
    expect(merged.retrievedChunks[2]!.chunkId).toBe('chunk-3');
  });

  it('should slice results according to topK limit', () => {
    const result: RetrievalResult = {
      query: 'query 1',
      retrievedChunks: [
        createMockChunk('chunk-1', 0.9, 'Text 1'),
        createMockChunk('chunk-2', 0.8, 'Text 2'),
        createMockChunk('chunk-3', 0.7, 'Text 3'),
      ],
      citations: [],
      totalResults: 3,
      elapsedTime: 50,
      statistics: {
        searchDurationMs: 30,
        embeddingDurationMs: 20,
        retrievedChunksCount: 3,
        appliedFilters: null,
        averageScore: 0.8,
        highestScore: 0.9,
        lowestScore: 0.7,
      },
    };

    const merged = ContextMerger.mergeResults([result], 'query 1', 2);
    expect(merged.totalResults).toBe(2);
    expect(merged.retrievedChunks.length).toBe(2);
  });
});
