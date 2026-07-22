import { describe, it, expect, vi } from 'vitest';
import { QueryTransformationService } from '@/query/services/query-transformation.service';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { logger } from '@/shared/logger';

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('QueryTransformationService', () => {
  it('should delegate to the provided strategy and log metrics', async () => {
    const mockResult: QueryTransformationResult = {
      originalQuery: 'test query',
      transformedQuery: 'transformed query',
      transformedQueries: ['transformed query'],
      strategy: 'mock',
      metadata: { key: 'value' },
    };

    const mockStrategy: QueryTransformationStrategy = {
      transform: vi.fn().mockResolvedValue(mockResult),
    };

    const service = new QueryTransformationService(mockStrategy);
    const result = await service.transform('test query');

    expect(mockStrategy.transform).toHaveBeenCalledWith('test query');
    expect(result).toEqual(mockResult);

    expect(logger.info).toHaveBeenCalledWith(
      { query: 'test query' },
      'Query transformation started'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'mock',
        originalQuery: 'test query',
        transformedQuery: 'transformed query',
        durationMs: expect.any(Number),
      }),
      'Query transformation completed'
    );
  });
});
