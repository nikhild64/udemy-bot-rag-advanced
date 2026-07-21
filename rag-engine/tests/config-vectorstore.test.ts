import { describe, it, expect } from 'vitest';
import { vectorStoreConfig } from '@/config/vectorstore';
import { config } from '@/config';

describe('VectorStore Configuration Tests', () => {
  it('should expose vectorCollectionName matching VECTOR_COLLECTION_NAME env or default', () => {
    expect(vectorStoreConfig.vectorCollectionName).toBeDefined();
    expect(typeof vectorStoreConfig.vectorCollectionName).toBe('string');
    expect(vectorStoreConfig.vectorCollectionName).toBe('knowledge-base');
    expect(config.vectorStore.vectorCollectionName).toBe(vectorStoreConfig.vectorCollectionName);
  });

  it('should expose collectionName alias matching vectorCollectionName', () => {
    expect(config.vectorStore.collectionName).toBe(config.vectorStore.vectorCollectionName);
  });
});
