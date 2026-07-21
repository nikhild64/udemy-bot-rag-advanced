import { performance } from 'node:perf_hooks';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { logger } from '@/shared/logger';

export class QueryTransformationService {
  constructor(private readonly strategy: QueryTransformationStrategy) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    logger.info({ query }, 'Query transformation started');
    
    const start = performance.now();
    const result = await this.strategy.transform(query);
    const durationMs = Math.round(performance.now() - start);

    logger.debug(
      { 
        strategy: result.strategy,
        originalQuery: result.originalQuery,
        transformedQuery: result.transformedQuery,
        durationMs
      },
      'Query transformation completed'
    );

    return result;
  }
}
