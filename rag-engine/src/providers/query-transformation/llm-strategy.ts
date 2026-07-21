import { ChatRole } from '@/types';
import { QueryTransformationStrategy } from '@/core/contracts/query-transformation-strategy.contract';
import { QueryTransformationResult } from '@/core/models/query-transformation.model';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { logger } from '@/shared/logger';

export class LLMQueryTransformationStrategy implements QueryTransformationStrategy {
  constructor(private readonly chatProvider: ChatProvider) {}

  public async transform(query: string): Promise<QueryTransformationResult> {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      return this.createFallbackResult(query, 'Query is empty');
    }

    try {
      const response = await this.chatProvider.generateResponse(
        [
          {
            role: ChatRole.SYSTEM,
            content: `You are a search query optimization assistant.

Rewrite the user's query to maximize semantic retrieval quality.

Preserve the user's original intent.

Do not answer the question.

Do not introduce new facts.

Do not change the meaning.

Return ONLY the rewritten query.`,
          },
          {
            role: ChatRole.USER,
            content: `Original Query\n\n${trimmedQuery}`,
          },
        ],
        { task: 'query-transformation', temperature: 0 } // Low temperature for deterministic output
      );

      const transformedText = response.message.content.trim();

      if (this.isValid(transformedText)) {
        return {
          originalQuery: query,
          transformedQuery: transformedText,
          strategy: 'llm',
          metadata: {
            transformed: true,
            originalLength: query.length,
            transformedLength: transformedText.length,
          },
        };
      } else {
        logger.warn(
          { originalQuery: query, transformedQuery: transformedText },
          'LLM query transformation validation failed'
        );
        return this.createFallbackResult(query, 'Validation failed');
      }
    } catch (error) {
      logger.error(
        { originalQuery: query, error: error instanceof Error ? error.message : String(error) },
        'LLM query transformation provider failed'
      );
      return this.createFallbackResult(query, 'Provider error');
    }
  }

  private isValid(text: string): boolean {
    if (!text) return false;
    
    // Check for markdown (backticks, headers)
    if (text.includes('```') || text.includes('**') || text.startsWith('#')) {
      return false;
    }

    // Check for multiple queries (newlines)
    if (text.includes('\n')) {
      return false;
    }

    // Check for conversational explanations (e.g. "Here is the rewritten query:", "The rewritten query is:")
    const lowerText = text.toLowerCase();
    if (lowerText.startsWith('here is') || lowerText.startsWith('the rewritten query') || lowerText.startsWith('sure')) {
      return false;
    }

    // Reasonable length check
    if (text.length > 500) {
      return false;
    }

    return true;
  }

  private createFallbackResult(originalQuery: string, reason: string): QueryTransformationResult {
    return {
      originalQuery,
      transformedQuery: originalQuery,
      strategy: 'llm_fallback',
      metadata: {
        transformed: false,
        reason,
      },
    };
  }
}
