import { describe, it, expect, vi } from 'vitest';
import { SubQuestionQueryTransformationStrategy } from '@/providers/query-transformation/sub-question-strategy';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { ChatRole } from '@/types';

describe('SubQuestionQueryTransformationStrategy', () => {
  const mockChatProvider: ChatProvider = {
    generateResponse: vi.fn(),
    streamResponse: vi.fn(),
  };

  it('should decompose compound question into sub-questions', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: `1. What is Docker Compose?
2. What is Kubernetes?
3. How do deployments differ between Docker Compose and Kubernetes?`,
      },
    });

    const strategy = new SubQuestionQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('Compare Docker Compose and Kubernetes deployments.');

    expect(result.strategy).toBe('sub-question');
    expect(result.transformedQueries).toEqual([
      'What is Docker Compose?',
      'What is Kubernetes?',
      'How do deployments differ between Docker Compose and Kubernetes?',
    ]);
  });

  it('should fall back if no valid sub-questions are produced', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
      message: {
        role: ChatRole.ASSISTANT,
        content: 'Invalid response with markdown ```code```',
      },
    });

    const strategy = new SubQuestionQueryTransformationStrategy(mockChatProvider);
    const result = await strategy.transform('Compare Docker Compose and Kubernetes deployments.');

    expect(result.strategy).toBe('sub-question_fallback');
    expect(result.transformedQueries).toEqual(['Compare Docker Compose and Kubernetes deployments.']);
  });
});
