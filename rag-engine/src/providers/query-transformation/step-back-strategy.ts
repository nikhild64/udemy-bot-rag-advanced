import { ChatRole } from '@/types';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { logger } from '@/shared/logger';
import { QueryValidator } from './validators/query.validator';

export class StepBackQueryTransformationStrategy implements QueryTransformationStrategy {
  constructor(private readonly chatProvider: ChatProvider) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return QueryValidator.createFallbackResult(query, 'step-back', 'Query is empty');
    }

    try {
      const response = await this.chatProvider.generateResponse(
        [
          {
            role: ChatRole.SYSTEM,
            content: `You are a search query optimization assistant using the Step-back technique.

Given a specific question, generate a broader, higher-level conceptual question that helps retrieve foundational concepts or background knowledge needed to answer the question.

Do NOT answer the question.
Do NOT repeat the exact specific question.
Return ONLY the step-back conceptual question.`,
          },
          {
            role: ChatRole.USER,
            content: `Original Question:\n\n${trimmedQuery}`,
          },
        ],
        { task: 'query-transformation', temperature: 0 }
      );

      const stepBackQuery = response.message.content.trim();

      if (QueryValidator.isValidSingleQuery(stepBackQuery)) {
        const transformedQueries = Array.from(
          new Set([trimmedQuery, stepBackQuery])
        );

        return {
          originalQuery: query,
          transformedQuery: stepBackQuery,
          transformedQueries,
          strategy: 'step-back',
          metadata: {
            transformed: true,
            stepBackQuery,
            queryCount: transformedQueries.length,
          },
        };
      } else {
        logger.warn(
          { originalQuery: query, stepBackQuery },
          'Step-back query transformation validation failed'
        );
        return QueryValidator.createFallbackResult(query, 'step-back', 'Validation failed');
      }
    } catch (error) {
      logger.error(
        { originalQuery: query, error: error instanceof Error ? error.message : String(error) },
        'Step-back query transformation provider failed'
      );
      return QueryValidator.createFallbackResult(query, 'step-back', 'Provider error');
    }
  }
}
