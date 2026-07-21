import { VectorStore } from './VectorStore';
import { QdrantVectorStore, QdrantVectorStoreOptions } from './QdrantVectorStore';
import { ConfigurationError } from '@/shared/errors';
import { config } from '@/config';

export class VectorStoreFactory {
  static create(providerName?: string, options?: Record<string, unknown>): VectorStore {
    const name = (providerName ?? config.vectorStore.provider ?? 'qdrant').toLowerCase();

    switch (name) {
      case 'qdrant':
        return new QdrantVectorStore(options as QdrantVectorStoreOptions);
      default:
        throw new ConfigurationError(`Unsupported vector store provider: ${name}`);
    }
  }
}
