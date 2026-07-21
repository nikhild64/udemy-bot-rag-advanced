import { describe, it, expect } from 'vitest';
import { NoOpRerankerProvider } from './NoOpRerankerProvider';

describe('NoOpRerankerProvider', () => {
  it('should return the chunks exactly as they were provided', async () => {
    const provider = new NoOpRerankerProvider();
    
    const request = {
      query: 'test query',
      chunks: ['chunk A', 'chunk B', 'chunk C'],
    };

    const result = await provider.rerank(request);

    expect(result.query).toBe('test query');
    expect(result.originalCount).toBe(3);
    expect(result.rerankedCount).toBe(3);
    expect(result.provider).toBe('noop');
    expect(result.chunks).toEqual(['chunk A', 'chunk B', 'chunk C']);
  });

  it('should handle empty chunks', async () => {
    const provider = new NoOpRerankerProvider();
    
    const request = {
      query: 'test query',
      chunks: [],
    };

    const result = await provider.rerank(request);

    expect(result.query).toBe('test query');
    expect(result.originalCount).toBe(0);
    expect(result.rerankedCount).toBe(0);
    expect(result.provider).toBe('noop');
    expect(result.chunks).toEqual([]);
  });

  it('should handle a single chunk', async () => {
    const provider = new NoOpRerankerProvider();
    
    const request = {
      query: 'test query',
      chunks: ['chunk A'],
    };

    const result = await provider.rerank(request);

    expect(result.originalCount).toBe(1);
    expect(result.chunks).toEqual(['chunk A']);
  });
});
