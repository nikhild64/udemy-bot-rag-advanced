import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { config } from '@/config';
import { QueryTransformationStrategySelector } from '../selectors/strategy-selector';

export class QueryTransformationFactory {
  public static create(strategyName?: string): QueryTransformationStrategy {
    const strategy = strategyName || config.retrieval.queryTransformationStrategy;
    return QueryTransformationStrategySelector.select(strategy);
  }
}
