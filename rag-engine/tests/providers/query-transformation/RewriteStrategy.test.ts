import { describe, it, expect, vi } from 'vitest';
import { RewriteQueryTransformationStrategy } from '@/providers/query-transformation/rewrite-strategy';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { ChatRole } from '@/types';

describe('RewriteQueryTransformationStrategy', () => {
  const mockChatProvider: ChatProvider = {
    generateResponse: vi.fn(),
    streamResponse: vi.fn(),
  };

  it('should optimize user query cleanly', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: 'Angular Signals reactive state management',
      },
    });

    const strategy = new RewriteQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('How do Angular Signals work?');

    expect(result.strategy).toBe('rewrite');
    expect(result.transformedQuery).toBe('Angular Signals reactive state management');
    expect(result.transformedQueries).toEqual(['Angular Signals reactive state management']);
    expect(result.metadata.transformed).toBe(true);
  });

  it('should fall back to original query if validation fails', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: 'Here is the rewritten query: **Angular**',
      },
    });

    const strategy = new RewriteQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('How do Angular Signals work?');

    expect(result.strategy).toBe('rewrite_fallback');
    expect(result.transformedQuery).toBe('How do Angular Signals work?');
    expect(result.transformedQueries).toEqual(['How do Angular Signals work?']);
  });

  it('should fall back to original query if provider throws an error', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockRejectedValueOnce(new Error('LLM API Error'));

    const strategy = new RewriteQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('How do Angular Signals work?');

    expect(result.strategy).toBe('rewrite_fallback');
    expect(result.metadata.reason).toBe('Provider error');
  });
});
