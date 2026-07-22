import { describe, it, expect, vi } from 'vitest';
import { CompositeQueryTransformationStrategy } from '@/providers/query-transformation/composite-strategy';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';

describe('CompositeQueryTransformationStrategy', () => {
  it('should execute sub-strategies concurrently and aggregate deduplicated queries', async () => {
    const mockStrategy1: QueryTransformationStrategy = {
      transform: vi.fn().mockResolvedValue({
        originalQuery: 'test query',
        transformedQuery: 'query one',
        transformedQueries: ['query one', 'query two'],
        strategy: 'strat1',
        metadata: {},
      }),
    };

    const mockStrategy2: QueryTransformationStrategy = {
      transform: vi.fn().mockResolvedValue({
        originalQuery: 'test query',
        transformedQuery: 'query two',
        transformedQueries: ['query two', 'query three'],
        strategy: 'strat2',
        metadata: {},
      }),
    };

    const composite = new CompositeQueryTransformationStrategy([mockStrategy1, mockStrategy2], 'all');
    const result = await composite.transform('test query');

    expect(result.strategy).toBe('all');
    expect(result.transformedQueries).toEqual(['query one', 'query two', 'query three']);
  });

  it('should handle sub-strategy errors gracefully', async () => {
    const mockStrategy1: QueryTransformationStrategy = {
      transform: vi.fn().mockRejectedValue(new Error('Strategy failed')),
    };

    const mockStrategy2: QueryTransformationStrategy = {
      transform: vi.fn().mockResolvedValue({
        originalQuery: 'test query',
        transformedQuery: 'valid query',
        transformedQueries: ['valid query'],
        strategy: 'strat2',
        metadata: {},
      }),
    };

    const composite = new CompositeQueryTransformationStrategy([mockStrategy1, mockStrategy2], 'composite');
    const result = await composite.transform('test query');

    expect(result.transformedQueries).toEqual(['valid query']);
  });
});
