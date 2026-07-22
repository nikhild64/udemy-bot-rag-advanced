import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import {
  NoOpQueryTransformationStrategy,
  RewriteQueryTransformationStrategy,
  StepBackQueryTransformationStrategy,
  SubQuestionQueryTransformationStrategy,
  CompositeQueryTransformationStrategy,
  LLMQueryTransformationStrategy,
} from '@/providers/query-transformation';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';
import { AppError } from '@/shared/errors';

export class QueryTransformationStrategySelector {
  /**
   * Instantiates a single strategy by its canonical name.
   */
  public static createSingleStrategy(name: string): QueryTransformationStrategy {
    const normalized = name.trim().toLowerCase();

    switch (normalized) {
      case 'noop':
        return new NoOpQueryTransformationStrategy();
      case 'rewrite':
        return new RewriteQueryTransformationStrategy(ChatProviderFactory.create());
      case 'llm':
        return new LLMQueryTransformationStrategy(ChatProviderFactory.create());
      case 'step-back':
      case 'stepback':
        return new StepBackQueryTransformationStrategy(ChatProviderFactory.create());
      case 'sub-question':
      case 'subquestion':
        return new SubQuestionQueryTransformationStrategy(ChatProviderFactory.create());
      default:
        throw new AppError(`Unsupported query transformation strategy: ${name}`, {
          statusCode: 400,
          metadata: { strategy: name },
        });
    }
  }

  /**
   * Selects and builds strategy instance(s) from string expression.
   * Supports single strategies ('noop'), 'all', 'auto', or comma-separated lists ('rewrite,step-back').
   */
  public static select(strategyExpression: string): QueryTransformationStrategy {
    const trimmed = strategyExpression.trim();

    if (!trimmed) {
      return this.select('all');
    }

    // Split by comma
    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return this.select('all');
    }

    // Check for 'all' or 'auto'
    const containsAllOrAuto = parts.some(
      (p) => p.toLowerCase() === 'all' || p.toLowerCase() === 'auto'
    );

    if (containsAllOrAuto) {
      const allStrategies = [
        new RewriteQueryTransformationStrategy(ChatProviderFactory.create()),
        new StepBackQueryTransformationStrategy(ChatProviderFactory.create()),
        new SubQuestionQueryTransformationStrategy(ChatProviderFactory.create()),
      ];
      return new CompositeQueryTransformationStrategy(allStrategies, 'auto');
    }

    if (parts.length === 1) {
      return this.createSingleStrategy(parts[0]!);
    }

    // Multiple comma-separated strategies specified
    const strategies = parts.map((part) => this.createSingleStrategy(part));
    return new CompositeQueryTransformationStrategy(strategies, parts.join(','));
  }
}
