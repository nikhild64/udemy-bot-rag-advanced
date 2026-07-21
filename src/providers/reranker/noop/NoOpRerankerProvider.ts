import { RerankerProvider } from '@/core/contracts';
import { RerankRequest, RerankResult } from '@/core/models';

export class NoOpRerankerProvider<T = unknown> implements RerankerProvider<T> {
  public async rerank(request: RerankRequest<T>): Promise<RerankResult<T>> {
    return {
      query: request.query,
      originalCount: request.chunks.length,
      rerankedCount: request.chunks.length,
      chunks: request.chunks,
      provider: 'noop',
    };
  }
}
