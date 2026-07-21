import { describe, it, expect, vi } from 'vitest';
import { RerankingService } from './RerankingService';
import { RerankerProvider } from '@/core/contracts';
import { RerankResult } from '@/core/models';

describe('RerankingService', () => {
  it('should call the provider and return the reranked results', async () => {
    const mockResult: RerankResult<string> = {
      query: 'test',
      originalCount: 2,
      rerankedCount: 2,
      chunks: ['chunk B', 'chunk A'], // Assume reordered
      provider: 'mock-provider',
    };

    const mockProvider: RerankerProvider<string> = {
      rerank: vi.fn().mockResolvedValue(mockResult),
    };

    const service = new RerankingService(mockProvider);
    const result = await service.rerank('test', ['chunk A', 'chunk B']);

    expect(mockProvider.rerank).toHaveBeenCalledWith({
      query: 'test',
      chunks: ['chunk A', 'chunk B'],
    });

    expect(result).toEqual(mockResult);
  });

  it('should propagate errors from the provider', async () => {
    const mockProvider: RerankerProvider<string> = {
      rerank: vi.fn().mockRejectedValue(new Error('Provider error')),
    };

    const service = new RerankingService(mockProvider);

    await expect(service.rerank('test', ['chunk'])).rejects.toThrow('Provider error');
  });
});
