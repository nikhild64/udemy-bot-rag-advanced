import { describe, it, expect } from 'vitest';
import { ContextFilterService } from './ContextFilterService';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';

describe('ContextFilterService', () => {
  const createMockChunk = (id: string, score: number, text: string): RetrievedChunk => ({
    chunkId: id,
    score,
    text,
    metadata: {},
    chunk: { id, text, metadata: {} },
    sourceReference: { courseId: 'c1', lessonId: 'l1', startTime: 0, endTime: 10 },
    citation: {
      chunkId: id,
      courseId: 'c1',
      courseName: 'C1',
      moduleId: 'm1',
      moduleTitle: 'M1',
      lessonId: 'l1',
      lessonTitle: 'L1',
      transcriptFile: 'f1.vtt',
      startTime: 0,
      endTime: 10,
      similarityScore: score,
    },
  });

  it('should remove chunks below min confidence threshold', () => {
    const filterService = new ContextFilterService(0.5);
    const chunks = [
      createMockChunk('c1', 0.8, 'High score chunk'),
      createMockChunk('c2', 0.3, 'Low score chunk'),
    ];

    const result = filterService.filter(chunks);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.chunkId).toBe('c1');
    expect(result.documentsDiscarded).toBe(1);
  });

  it('should remove duplicate chunks by chunkId and text hash', () => {
    const filterService = new ContextFilterService(0.5);
    const chunks = [
      createMockChunk('c1', 0.8, 'Unique chunk text 1'),
      createMockChunk('c1', 0.8, 'Unique chunk text 1 duplicate ID'),
      createMockChunk('c2', 0.7, 'Unique chunk text 1'), // Duplicate text
    ];

    const result = filterService.filter(chunks);

    expect(result.chunks).toHaveLength(1);
    expect(result.documentsDiscarded).toBe(2);
  });

  it('should preserve citations and order of accepted chunks', () => {
    const filterService = new ContextFilterService(0.5);
    const chunks = [
      createMockChunk('c1', 0.9, 'Text 1'),
      createMockChunk('c2', 0.8, 'Text 2'),
    ];

    const result = filterService.filter(chunks);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]?.chunkId).toBe('c1');
    expect(result.citations[1]?.chunkId).toBe('c2');
  });
});
