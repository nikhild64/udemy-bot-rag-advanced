import { performance } from 'node:perf_hooks';
import { logger } from '@/shared/logger';
import { RerankerProvider } from '@/core/contracts';
import { RerankResult } from '@/core/models';

export class RerankingService {
  constructor(private readonly rerankerProvider: RerankerProvider<unknown>) {}

  public async rerank<T>(query: string, chunks: T[]): Promise<RerankResult<T>> {
    logger.debug({ query, chunkCount: chunks.length }, 'Reranking started');
    
    const startRerank = performance.now();
    
    let result: RerankResult<T>;
    try {
      result = await (this.rerankerProvider as RerankerProvider<T>).rerank({
        query,
        chunks,
      });
    } catch (error) {
      logger.error({ err: error }, 'Reranking provider failed');
      throw error;
    }

    const durationMs = Math.round(performance.now() - startRerank);
    
    logger.info(
      { 
        provider: result.provider,
        originalCount: result.originalCount,
        rerankedCount: result.rerankedCount,
        durationMs,
      },
      'Reranking completed'
    );

    return result;
  }
}
