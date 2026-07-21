import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RerankerProviderFactory } from './RerankerProviderFactory';
import { NoOpRerankerProvider } from '@/providers/reranker/noop/NoOpRerankerProvider';

// Mock config
vi.mock('@/config/retrieval', () => ({
  retrievalConfig: {
    rerankerProvider: 'noop',
  },
}));

describe('RerankerProviderFactory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create NoOpRerankerProvider when config specifies noop', async () => {
    const { retrievalConfig } = await import('@/config/retrieval');
    retrievalConfig.rerankerProvider = 'noop';

    const provider = RerankerProviderFactory.create();
    expect(provider).toBeInstanceOf(NoOpRerankerProvider);
  });

  it('should ignore case when resolving provider name', async () => {
    const { retrievalConfig } = await import('@/config/retrieval');
    retrievalConfig.rerankerProvider = 'NoOp';

    const provider = RerankerProviderFactory.create();
    expect(provider).toBeInstanceOf(NoOpRerankerProvider);
  });

  it('should throw an error for unsupported providers', async () => {
    const { retrievalConfig } = await import('@/config/retrieval');
    retrievalConfig.rerankerProvider = 'unknown_provider';

    expect(() => {
      RerankerProviderFactory.create();
    }).toThrow('Unsupported reranker provider: unknown_provider');
  });
});
