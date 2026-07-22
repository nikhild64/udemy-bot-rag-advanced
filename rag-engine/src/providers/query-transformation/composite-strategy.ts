import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { logger } from '@/shared/logger';
import { QueryValidator } from './validators/query.validator';

export class CompositeQueryTransformationStrategy implements QueryTransformationStrategy {
  constructor(
    private readonly strategies: QueryTransformationStrategy[],
    private readonly name: string = 'composite'
  ) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return QueryValidator.createFallbackResult(query, this.name, 'Query is empty');
    }

    if (!this.strategies || this.strategies.length === 0) {
      return {
        originalQuery: query,
        transformedQuery: trimmedQuery,
        transformedQueries: [trimmedQuery],
        strategy: this.name,
        metadata: { strategiesCount: 0 },
      };
    }

    // Execute all transformation strategies concurrently
    const results = await Promise.allSettled(
      this.strategies.map((strategy) => strategy.transform(query))
    );

    const aggregatedQueries: string[] = [];
    const appliedStrategies: string[] = [];
    const strategyMetadata: Record<string, unknown> = {};

    for (let i = 0; i < results.length; i++) {
      const res = results[i]!;
      if (res.status === 'fulfilled') {
        const stratResult = res.value;
        appliedStrategies.push(stratResult.strategy);
        strategyMetadata[`strategy_${i}_${stratResult.strategy}`] = stratResult.metadata;

        if (Array.isArray(stratResult.transformedQueries)) {
          for (const q of stratResult.transformedQueries) {
            if (q && q.trim()) {
              aggregatedQueries.push(q.trim());
            }
          }
        } else if (stratResult.transformedQuery) {
          aggregatedQueries.push(stratResult.transformedQuery.trim());
        }
      } else {
        logger.warn(
          { originalQuery: query, error: res.reason },
          `Sub-strategy index ${i} failed in CompositeQueryTransformationStrategy`
        );
      }
    }

    // Always include original query if not present, and deduplicate
    const uniqueQueries = Array.from(new Set(aggregatedQueries.filter(Boolean)));
    if (uniqueQueries.length === 0) {
      uniqueQueries.push(trimmedQuery);
    }

    return {
      originalQuery: query,
      transformedQuery: uniqueQueries[0]!,
      transformedQueries: uniqueQueries,
      strategy: this.name,
      metadata: {
        appliedStrategies,
        uniqueQueriesCount: uniqueQueries.length,
        subMetadata: strategyMetadata,
      },
    };
  }
}
