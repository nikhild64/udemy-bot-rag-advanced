import { describe, it, expect } from 'vitest';
import { SimilarityScoreEvaluator } from './SimilarityScoreEvaluator';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';

describe('SimilarityScoreEvaluator', () => {
  const createMockChunk = (id: string, score: number): RetrievedChunk => ({
    chunkId: id,
    score,
    text: `Sample text for ${id}`,
    metadata: {},
    chunk: { id, text: `Sample text for ${id}`, metadata: {} },
    sourceReference: { courseId: 'c1', lessonId: 'l1', startTime: 0, endTime: 10 },
    citation: {
      chunkId: id,
      courseId: 'c1',
      courseName: 'Course 1',
      moduleId: 'm1',
      moduleTitle: 'Mod 1',
      lessonId: 'l1',
      lessonTitle: 'Les 1',
      transcriptFile: 'f1.vtt',
      startTime: 0,
      endTime: 10,
      similarityScore: score,
    },
  });

  it('should return reject if no chunks are provided', async () => {
    const evaluator = new SimilarityScoreEvaluator(0.7, 0.5);
    const result = await evaluator.evaluate('What is RAG?', []);

    expect(result.decision).toBe('reject');
    expect(result.score).toBe(0);
    expect(result.documentsEvaluated).toBe(0);
  });

  it('should return accept if average similarity exceeds threshold', async () => {
    const evaluator = new SimilarityScoreEvaluator(0.7, 0.5);
    const chunks = [
      createMockChunk('c1', 0.85),
      createMockChunk('c2', 0.75),
    ];
    const result = await evaluator.evaluate('What is RAG?', chunks);

    expect(result.decision).toBe('accept');
    expect(result.averageSimilarity).toBe(0.8);
    expect(result.maxSimilarity).toBe(0.85);
  });

  it('should return correct if average is below threshold but max meets min confidence', async () => {
    const evaluator = new SimilarityScoreEvaluator(0.7, 0.5);
    const chunks = [
      createMockChunk('c1', 0.65),
      createMockChunk('c2', 0.55),
    ];
    const result = await evaluator.evaluate('What is RAG?', chunks);

    expect(result.decision).toBe('correct');
    expect(result.averageSimilarity).toBeCloseTo(0.6);
    expect(result.maxSimilarity).toBe(0.65);
  });

  it('should return reject if max similarity is below min confidence', async () => {
    const evaluator = new SimilarityScoreEvaluator(0.7, 0.5);
    const chunks = [
      createMockChunk('c1', 0.4),
      createMockChunk('c2', 0.3),
    ];
    const result = await evaluator.evaluate('What is RAG?', chunks);

    expect(result.decision).toBe('reject');
    expect(result.maxSimilarity).toBe(0.4);
  });
});
