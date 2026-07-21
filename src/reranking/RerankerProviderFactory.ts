import { RerankerProvider } from '@/core/contracts';
import { retrievalConfig } from '@/config/retrieval';
import { NoOpRerankerProvider } from '@/providers/reranker/noop/NoOpRerankerProvider';

export class RerankerProviderFactory {
  public static create<T = unknown>(): RerankerProvider<T> {
    const providerName = retrievalConfig.rerankerProvider.toLowerCase();

    switch (providerName) {
      case 'noop':
        return new NoOpRerankerProvider<T>();
      default:
        throw new Error(`Unsupported reranker provider: ${providerName}`);
    }
  }
}
