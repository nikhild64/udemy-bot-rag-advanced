import { QueryTransformationResult } from '@/core/models/query-transformation.model';

export class QueryValidator {
  private static readonly CONVERSATIONAL_PREFIXES = [
    'here is',
    'here are',
    'sure',
    'certainly',
    'the rewritten query',
    'the step-back query',
    'the sub-question',
    'based on the',
    'as requested',
    'i have rewritten',
    'rewritten query:',
    'optimized query:',
  ];

  private static readonly PROMPT_LEAKAGE_TERMS = [
    'you are a',
    'system prompt',
    'ignore previous',
    'do not answer',
    'search query optimization assistant',
  ];

  /**
   * Validates a single transformed query string.
   */
  public static isValidSingleQuery(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const trimmed = text.trim();
    if (!trimmed) return false;

    // Check maximum length
    if (trimmed.length > 500) return false;

    // Check for multiple lines
    if (trimmed.includes('\n')) return false;

    // Check for markdown syntax
    if (
      trimmed.includes('```') ||
      trimmed.includes('**') ||
      trimmed.startsWith('#')
    ) {
      return false;
    }

    const lower = trimmed.toLowerCase();

    // Check for conversational filler prefixes
    for (const prefix of this.CONVERSATIONAL_PREFIXES) {
      if (lower.startsWith(prefix)) return false;
    }

    // Check for prompt leakage
    for (const term of this.PROMPT_LEAKAGE_TERMS) {
      if (lower.includes(term)) return false;
    }

    return true;
  }

  /**
   * Validates multiple transformed query strings (e.g. sub-questions).
   */
  public static filterValidQueries(queries: string[]): string[] {
    if (!Array.isArray(queries)) return [];

    return queries
      .map((q) => q.trim())
      .filter((q) => this.isValidSingleQuery(q));
  }

  /**
   * Helper to construct a safe fallback QueryTransformationResult when validation fails.
   */
  public static createFallbackResult(
    originalQuery: string,
    strategy: string,
    reason: string
  ): QueryTransformationResult {
    const trimmedOriginal = originalQuery.trim() || originalQuery;
    return {
      originalQuery,
      transformedQuery: trimmedOriginal,
      transformedQueries: [trimmedOriginal],
      strategy: `${strategy}_fallback`,
      metadata: {
        transformed: false,
        reason,
      },
    };
  }
}
