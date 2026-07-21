import { describe, it, expect } from 'vitest';
import { embeddingsConfig } from '../src/config';

describe('Embeddings Configuration', () => {
  it('should load default configuration settings or override from environment', () => {
    expect(embeddingsConfig.provider).toBeDefined();
    expect(typeof embeddingsConfig.provider).toBe('string');
    expect(embeddingsConfig.mistralEmbeddingModel).toBeDefined();
    expect(typeof embeddingsConfig.mistralEmbeddingModel).toBe('string');
    expect(embeddingsConfig.batchSize).toBeGreaterThan(0);
    expect(embeddingsConfig.timeoutMs).toBeGreaterThan(0);
    expect(embeddingsConfig.mistralApiUrl).toContain('mistral.ai');
  });
});
