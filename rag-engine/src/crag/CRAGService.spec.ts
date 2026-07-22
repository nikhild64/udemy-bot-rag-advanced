import { describe, it, expect, vi } from 'vitest';
import { CRAGService } from './CRAGService';
import { RetrievalEvaluator } from '../core/contracts/crag-evaluator.contract';
import { CorrectiveRetrievalService } from './corrective/CorrectiveRetrievalService';
import { ContextFilterService } from './filtering/ContextFilterService';
import { CRAGRetryPolicy } from './retry/CRAGRetryPolicy';
import { RetrievalResult, RetrievedChunk } from '../retrieval/RetrievalResult';

describe('CRAGService', () => {
  const createMockChunk = (id: string, score: number): RetrievedChunk => ({
    chunkId: id,
    score,
    text: `Text ${id}`,
    metadata: {},
    chunk: { id, text: `Text ${id}`, metadata: {} },
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

  const mockRetrievalResult = (chunks: RetrievedChunk[]): RetrievalResult => ({
    query: 'test query',
    retrievedChunks: chunks,
    citations: chunks.map(c => c.citation),
    totalResults: chunks.length,
    elapsedTime: 10,
    statistics: { vectorSearchMs: 5, totalMs: 10, count: chunks.length },
  });

  it('should accept context immediately if evaluator decides accept', async () => {
    const evaluator: RetrievalEvaluator = {
      evaluate: vi.fn().mockResolvedValue({
        decision: 'accept',
        score: 0.9,
        averageSimilarity: 0.85,
        maxSimilarity: 0.9,
        documentsEvaluated: 1,
      }),
    };

    const correctiveService = {} as CorrectiveRetrievalService;
    const filterService = new ContextFilterService(0.5);
    const retryPolicy = new CRAGRetryPolicy({ maxRetries: 2 });

    const cragService = new CRAGService(evaluator, correctiveService, filterService, retryPolicy);

    const initialResult = mockRetrievalResult([createMockChunk('c1', 0.85)]);
    const res = await cragService.process(initialResult, { query: 'test query' });

    expect(res.decision).toBe('accept');
    expect(res.chunks).toHaveLength(1);
    expect(res.metrics.retryCount).toBe(0);
    expect(res.metrics.finalDecision).toBe('accept');
  });

  it('should trigger corrective retrieval when decision is correct', async () => {
    const evaluator: RetrievalEvaluator = {
      evaluate: vi.fn()
        .mockResolvedValueOnce({
          decision: 'correct',
          score: 0.6,
          averageSimilarity: 0.6,
          maxSimilarity: 0.65,
          documentsEvaluated: 1,
        })
        .mockResolvedValueOnce({
          decision: 'accept',
          score: 0.85,
          averageSimilarity: 0.85,
          maxSimilarity: 0.9,
          documentsEvaluated: 2,
        }),
    };

    const correctiveService: CorrectiveRetrievalService = {
      executeCorrectiveRetrieval: vi.fn().mockResolvedValue({
        retrievalResult: mockRetrievalResult([createMockChunk('c1', 0.85), createMockChunk('c2', 0.85)]),
        actionTaken: 'Increased retrieval topK limit',
        newTopK: 15,
      }),
    } as unknown as CorrectiveRetrievalService;

    const filterService = new ContextFilterService(0.5);
    const retryPolicy = new CRAGRetryPolicy({ maxRetries: 2 });

    const cragService = new CRAGService(evaluator, correctiveService, filterService, retryPolicy);

    const initialResult = mockRetrievalResult([createMockChunk('c1', 0.6)]);
    const res = await cragService.process(initialResult, { query: 'test query' });

    expect(res.decision).toBe('accept');
    expect(res.metrics.retryCount).toBe(1);
    expect(res.metrics.correctiveActionsTaken).toHaveLength(1);
  });

  it('should return reject if initial evaluation is reject', async () => {
    const evaluator: RetrievalEvaluator = {
      evaluate: vi.fn().mockResolvedValue({
        decision: 'reject',
        score: 0.2,
        averageSimilarity: 0.2,
        maxSimilarity: 0.3,
        documentsEvaluated: 1,
      }),
    };

    const correctiveService = {} as CorrectiveRetrievalService;
    const filterService = new ContextFilterService(0.5);
    const retryPolicy = new CRAGRetryPolicy({ maxRetries: 2 });

    const cragService = new CRAGService(evaluator, correctiveService, filterService, retryPolicy);

    const initialResult = mockRetrievalResult([createMockChunk('c1', 0.2)]);
    const res = await cragService.process(initialResult, { query: 'test query' });

    expect(res.decision).toBe('reject');
    expect(res.chunks).toHaveLength(0);
    expect(res.citations).toHaveLength(0);
  });
});
