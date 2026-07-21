import { RerankerProvider } from '@/core/contracts';
import { retrievalConfig } from '@/config/retrieval';
import { NoOpRerankerProvider } from '@/providers/reranker/noop/NoOpRerankerProvider';
import { LLMRerankerProvider } from '@/providers/reranker/llm/LLMRerankerProvider';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';

export class RerankerProviderFactory {
  public static create<T = unknown>(): RerankerProvider<T> {
    const providerName = retrievalConfig.rerankerProvider.toLowerCase();

    switch (providerName) {
      case 'noop':
        return new NoOpRerankerProvider<T>();
      case 'llm': {
        const chatProvider = ChatProviderFactory.create();
        return new LLMRerankerProvider<T>(chatProvider);
      }
      default:
        throw new Error(`Unsupported reranker provider: ${providerName}`);
    }
  }
}
