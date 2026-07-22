import { ChatRole } from '@/types';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { logger } from '@/shared/logger';
import { QueryValidator } from './validators/query.validator';

export class RewriteQueryTransformationStrategy implements QueryTransformationStrategy {
  constructor(private readonly chatProvider: ChatProvider) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return QueryValidator.createFallbackResult(query, 'rewrite', 'Query is empty');
    }

    try {
      const response = await this.chatProvider.generateResponse(
        [
          {
            role: ChatRole.SYSTEM,
            content: `You are a search query optimization assistant.

Rewrite the user's query to maximize semantic retrieval quality.
Preserve the user's original intent.
Remove conversational filler, greetings, and unnecessary preamble.
Do not answer the question.
Do not introduce new facts.
Do not change the meaning.
Return ONLY the rewritten search query.`,
          },
          {
            role: ChatRole.USER,
            content: `Original Query\n\n${trimmedQuery}`,
          },
        ],
        { task: 'query-transformation', temperature: 0 }
      );

      const transformedText = response.message.content.trim();

      if (QueryValidator.isValidSingleQuery(transformedText)) {
        return {
          originalQuery: query,
          transformedQuery: transformedText,
          transformedQueries: [transformedText],
          strategy: 'rewrite',
          metadata: {
            transformed: true,
            originalLength: query.length,
            transformedLength: transformedText.length,
          },
        };
      } else {
        logger.warn(
          { originalQuery: query, transformedQuery: transformedText },
          'Rewrite query transformation validation failed'
        );
        return QueryValidator.createFallbackResult(query, 'rewrite', 'Validation failed');
      }
    } catch (error) {
      logger.error(
        { originalQuery: query, error: error instanceof Error ? error.message : String(error) },
        'Rewrite query transformation provider failed'
      );
      return QueryValidator.createFallbackResult(query, 'rewrite', 'Provider error');
    }
  }
}
