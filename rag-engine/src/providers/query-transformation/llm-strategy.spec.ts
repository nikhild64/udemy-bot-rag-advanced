import { ChatRole } from '@/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMQueryTransformationStrategy } from './llm-strategy';
import { ChatProvider } from '@/core/contracts/chat-provider.contract';
import { ProviderError } from '@/shared/errors';

describe('LLMQueryTransformationStrategy', () => {
  let mockChatProvider: ChatProvider;
  let strategy: LLMQueryTransformationStrategy;

  beforeEach(() => {
    mockChatProvider = {
      generateResponse: vi.fn(),
    };
    strategy = new LLMQueryTransformationStrategy(mockChatProvider);
  });

  it('transforms query successfully', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValue({
      message: { role: ChatRole.ASSISTANT, content: 'How does Expo Router implement file-based routing in React Native applications?' }
    });

    const result = await strategy.transform('expo routing');
    
    expect(result.strategy).toBe('llm');
    expect(result.originalQuery).toBe('expo routing');
    expect(result.transformedQuery).toBe('How does Expo Router implement file-based routing in React Native applications?');
    expect(result.metadata.transformed).toBe(true);
    
    expect(mockChatProvider.generateResponse).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(mockChatProvider.generateResponse).mock.calls[0];
    const messages = callArgs![0];
    const options = callArgs![1];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('You are a search query optimization assistant');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('expo routing');
    expect(options).toBeDefined();
    expect(options.task).toBe('query-transformation');
  });

  it('returns fallback result if provider throws', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockRejectedValue(new ProviderError('API down'));

    const result = await strategy.transform('expo routing');
    
    expect(result.strategy).toBe('llm_fallback');
    expect(result.transformedQuery).toBe('expo routing');
    expect(result.metadata.transformed).toBe(false);
  });

  it('returns fallback result if response contains markdown', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValue({
      message: { role: ChatRole.ASSISTANT, content: '```How does Expo Router work```' }
    });

    const result = await strategy.transform('expo routing');
    expect(result.strategy).toBe('llm_fallback');
    expect(result.transformedQuery).toBe('expo routing');
  });

  it('returns fallback result if response contains multiple queries', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValue({
      message: { role: ChatRole.ASSISTANT, content: 'How does Expo Router work?\nExplain Expo Router.' }
    });

    const result = await strategy.transform('expo routing');
    expect(result.strategy).toBe('llm_fallback');
  });

  it('returns fallback result if response contains conversational text', async () => {
    vi.mocked(mockChatProvider.generateResponse).mockResolvedValue({
      message: { role: ChatRole.ASSISTANT, content: 'Here is the rewritten query: How does Expo Router work?' }
    });

    const result = await strategy.transform('expo routing');
    expect(result.strategy).toBe('llm_fallback');
  });

  it('returns fallback result for empty input', async () => {
    const result = await strategy.transform('   ');
    expect(result.strategy).toBe('llm_fallback');
    expect(result.transformedQuery).toBe('   ');
    expect(mockChatProvider.generateResponse).not.toHaveBeenCalled();
  });
});
