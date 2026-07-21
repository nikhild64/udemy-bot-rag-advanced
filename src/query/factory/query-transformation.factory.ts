import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { NoOpQueryTransformationStrategy } from '@/providers/query-transformation/noop-strategy';
import { config } from '@/config';
import { AppError } from '@/shared/errors';

export class QueryTransformationFactory {
  public static create(strategyName?: string): QueryTransformationStrategy {
    const strategy = strategyName || config.retrieval.queryTransformationStrategy;

    switch (strategy.toLowerCase()) {
      case 'noop':
        return new NoOpQueryTransformationStrategy();
      default:
        throw new AppError(`Unsupported query transformation strategy: ${strategy}`, {
          statusCode: 400,
          metadata: { strategy },
        });
    }
  }
}
