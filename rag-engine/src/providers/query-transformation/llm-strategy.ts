import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { RewriteQueryTransformationStrategy } from './rewrite-strategy';

export class LLMQueryTransformationStrategy implements QueryTransformationStrategy {
  private readonly rewriteStrategy: RewriteQueryTransformationStrategy;

  constructor(chatProvider: ChatProvider) {
    this.rewriteStrategy = new RewriteQueryTransformationStrategy(chatProvider);
  }

  public async transform(query: string): Promise<QueryTransformationResult> {
    const result = await this.rewriteStrategy.transform(query);
    return {
      ...result,
      strategy: result.strategy.includes('fallback') ? 'llm_fallback' : 'llm',
    };
  }
}
