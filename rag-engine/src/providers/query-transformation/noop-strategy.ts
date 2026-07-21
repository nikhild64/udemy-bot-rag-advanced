import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';

export class NoOpQueryTransformationStrategy implements QueryTransformationStrategy {
  public async transform(query: string): Promise<QueryTransformationResult> {
    return {
      originalQuery: query,
      transformedQuery: query.trim() || query,
      strategy: 'noop',
      metadata: {},
    };
  }
}
