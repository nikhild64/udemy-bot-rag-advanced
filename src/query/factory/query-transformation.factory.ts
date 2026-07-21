import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { NoOpQueryTransformationStrategy } from '@/providers/query-transformation/noop-strategy';
import { config } from '@/config';
import { AppError } from '@/shared/errors';

import { LLMQueryTransformationStrategy } from '@/providers/query-transformation/llm-strategy';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';

export class QueryTransformationFactory {
  public static create(strategyName?: string): QueryTransformationStrategy {
    const strategy = strategyName || config.retrieval.queryTransformationStrategy;

    switch (strategy.toLowerCase()) {
      case 'noop':
        return new NoOpQueryTransformationStrategy();
      case 'llm':
        return new LLMQueryTransformationStrategy(ChatProviderFactory.create());
      default:
        throw new AppError(`Unsupported query transformation strategy: ${strategy}`, {
          statusCode: 400,
          metadata: { strategy },
        });
    }
  }
}
