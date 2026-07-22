import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';

export class NoOpQueryTransformationStrategy implements QueryTransformationStrategy {
  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmed = query.trim() || query;
    return {
      originalQuery: query,
      transformedQuery: trimmed,
      transformedQueries: [trimmed],
      strategy: 'noop',
      metadata: {},
    };
  }
}

