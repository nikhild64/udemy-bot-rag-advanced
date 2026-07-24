import { EmbeddingProvider } from './EmbeddingProvider';
import { MistralEmbeddingProvider, MistralEmbeddingProviderOptions } from './MistralEmbeddingProvider';
import { NvidiaEmbeddingProvider, NvidiaEmbeddingProviderOptions } from './NvidiaEmbeddingProvider';
import { ConfigurationError } from '@/shared/errors';
import { config } from '@/config';

export class EmbeddingProviderFactory {
  static create(providerName?: string, options?: Record<string, unknown>): EmbeddingProvider {
    const name = (providerName ?? config.embeddings.provider ?? 'mistral').toLowerCase();

    switch (name) {
      case 'mistral':
        return new MistralEmbeddingProvider(options as MistralEmbeddingProviderOptions);
      case 'nvidia':
        return new NvidiaEmbeddingProvider(options as NvidiaEmbeddingProviderOptions);
      default:
        throw new ConfigurationError(`Unsupported embedding provider: ${name}`);
    }
  }
}
