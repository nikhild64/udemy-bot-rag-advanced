import { describe, it, expect } from 'vitest';
import { MultiMetricEvaluator } from './MultiMetricEvaluator';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';

describe('MultiMetricEvaluator Unit Tests', () => {
  const evaluator = new MultiMetricEvaluator(0.7, 0.5);

  it('should return reject for empty retrieved chunks', async () => {
    const res = await evaluator.evaluate('what is React?', []);
    expect(res.decision).toBe('reject');
    expect(res.score).toBe(0);
    expect(res.confidenceLabel).toContain('Low Confidence');
  });

  it('should return accept for high quality chunks with high similarity and good coverage', async () => {
    const chunks: RetrievedChunk[] = [
      {
        chunkId: 'c1',
        text: 'React is a JavaScript library for building user interfaces with components.',
        score: 0.9,
        sourceId: 'src_1',
        sourceName: 'react.pdf',
        notebookId: 'nb_1',
        sourceType: 'PDF',
        metadata: { page: 1 },
      },
      {
        chunkId: 'c2',
        text: 'State management in React can be done using hooks like useState and useReducer.',
        score: 0.85,
        sourceId: 'src_2',
        sourceName: 'state.pdf',
        notebookId: 'nb_1',
        sourceType: 'PDF',
        metadata: { page: 2 },
      },
    ];

    const res = await evaluator.evaluate('what is React state management?', chunks);
    expect(res.decision).toBe('accept');
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(res.confidenceLabel).toContain('High Confidence');
    expect(res.chunkDiversity).toBeGreaterThan(0);
    expect(res.sourceDiversity).toBe(1);
    expect(res.contextCoverage).toBeGreaterThan(0);
  });

  it('should return correct when confidence is moderate', async () => {
    const chunks: RetrievedChunk[] = [
      {
        chunkId: 'c1',
        text: 'Some random text mentioning JavaScript briefly.',
        score: 0.55,
        sourceId: 'src_1',
        sourceName: 'doc.txt',
        notebookId: 'nb_1',
        sourceType: 'TEXT',
        metadata: {},
      },
    ];

    const res = await evaluator.evaluate('Explain React virtual DOM rendering details', chunks);
    expect(res.decision).toBe('correct');
    expect(res.confidenceScore).toBeLessThan(0.7);
  });

  it('should return reject when similarity and coverage are low', async () => {
    const chunks: RetrievedChunk[] = [
      {
        chunkId: 'c1',
        text: 'Unrelated topic about cooking pizza.',
        score: 0.2,
        sourceId: 'src_1',
        sourceName: 'pizza.txt',
        notebookId: 'nb_1',
        sourceType: 'TEXT',
        metadata: {},
      },
    ];

    const res = await evaluator.evaluate('quantum computing error correction', chunks);
    expect(res.decision).toBe('reject');
    expect(res.confidenceScore).toBeLessThan(0.5);
    expect(res.confidenceLabel).toContain('Low Confidence');
  });
});
