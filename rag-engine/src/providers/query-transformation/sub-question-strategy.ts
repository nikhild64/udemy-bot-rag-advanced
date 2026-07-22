import { ChatRole } from '@/types';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { logger } from '@/shared/logger';
import { QueryValidator } from './validators/query.validator';

export class SubQuestionQueryTransformationStrategy implements QueryTransformationStrategy {
  constructor(private readonly chatProvider: ChatProvider) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return QueryValidator.createFallbackResult(query, 'sub-question', 'Query is empty');
    }

    try {
      const response = await this.chatProvider.generateResponse(
        [
          {
            role: ChatRole.SYSTEM,
            content: `You are a search query decomposition assistant.

Break down complex, compound, or multi-part user questions into 2 to 4 focused, independent sub-questions for vector search retrieval.
Each sub-question must focus on a distinct entity or aspect of the question.

Do NOT answer the questions.
Do NOT include conversational filler, preamble, or markdown headers.
Return each sub-question on a separate line.`,
          },
          {
            role: ChatRole.USER,
            content: `Original Question:\n\n${trimmedQuery}`,
          },
        ],
        { task: 'query-transformation', temperature: 0 }
      );

      const rawContent = response.message.content.trim();

      // Extract lines and clean prefix bullets/numbers
      const rawLines = rawContent
        .split('\n')
        .map((line) => line.replace(/^[\d\s.\-*#]+/, '').trim())
        .filter(Boolean);

      const validSubQuestions = QueryValidator.filterValidQueries(rawLines);

      if (validSubQuestions.length > 0) {
        const uniqueSubQuestions = Array.from(new Set(validSubQuestions));

        return {
          originalQuery: query,
          transformedQuery: uniqueSubQuestions.join('; '),
          transformedQueries: uniqueSubQuestions,
          strategy: 'sub-question',
          metadata: {
            transformed: true,
            subQuestionsCount: uniqueSubQuestions.length,
            subQuestions: uniqueSubQuestions,
          },
        };
      } else {
        logger.warn(
          { originalQuery: query, rawContent },
          'Sub-question query transformation produced no valid sub-questions'
        );
        return QueryValidator.createFallbackResult(query, 'sub-question', 'Validation failed');
      }
    } catch (error) {
      logger.error(
        { originalQuery: query, error: error instanceof Error ? error.message : String(error) },
        'Sub-question query transformation provider failed'
      );
      return QueryValidator.createFallbackResult(query, 'sub-question', 'Provider error');
    }
  }
}
