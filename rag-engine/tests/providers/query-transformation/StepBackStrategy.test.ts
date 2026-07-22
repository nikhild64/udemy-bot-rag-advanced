import { describe, it, expect, vi } from 'vitest';
import { StepBackQueryTransformationStrategy } from '@/providers/query-transformation/step-back-strategy';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { ChatRole } from '@/types';

describe('StepBackQueryTransformationStrategy', () => {
  const mockChatProvider: ChatProvider = {
    generateResponse: vi.fn(),
    streamResponse: vi.fn(),
  };

  it('should generate a conceptual step-back query alongside original query', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: 'What is dependency injection?',
      },
    });

    const strategy = new StepBackQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('How does Angular dependency injection resolve providers?');

    expect(result.strategy).toBe('step-back');
    expect(result.transformedQueries).toEqual([
      'How does Angular dependency injection resolve providers?',
      'What is dependency injection?',
    ]);
  });

  it('should fall back if step-back query generation fails validation', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: 'Here is the step-back query: **Dependency Injection**',
      },
    });

    const strategy = new StepBackQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('How does Angular dependency injection resolve providers?');

    expect(result.strategy).toBe('step-back_fallback');
    expect(result.transformedQueries).toEqual(['How does Angular dependency injection resolve providers?']);
  });
});
