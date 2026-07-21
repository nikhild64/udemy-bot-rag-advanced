import { RerankRequest, RerankResult } from '../models';

/**
 * Contract for a reranker provider that takes a set of retrieved chunks
 * and reorders them to improve relevance based on the original query.
 */
export interface RerankerProvider<T = unknown> {
  rerank(request: RerankRequest<T>): Promise<RerankResult<T>>;
}
