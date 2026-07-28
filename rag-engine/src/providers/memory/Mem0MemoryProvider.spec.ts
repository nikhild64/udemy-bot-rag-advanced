import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mem0MemoryProvider } from './Mem0MemoryProvider';
import { MemoryConfig } from '../../config/memory';

describe('Mem0MemoryProvider', () => {
  const mockConfig: MemoryConfig = {
    enabled: true,
    apiKey: 'test-mem0-api-key',
    topK: 5,
    apiUrl: 'https://api.mem0.ai/v1',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty list when disabled or no API key is provided', async () => {
    const disabledProvider = new Mem0MemoryProvider({
      enabled: false,
      apiKey: '',
      topK: 5,
      apiUrl: 'https://api.mem0.ai/v1',
    });

    const results = await disabledProvider.search({ query: 'test', userId: 'user_123' });
    expect(results).toEqual([]);
  });

  it('should search memories from Mem0 API', async () => {
    const mockMemoriesResponse = [
      { id: 'mem_1', memory: 'User is a TypeScript developer', score: 0.95 },
      { id: 'mem_2', memory: 'User prefers concise answers', score: 0.88 },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMemoriesResponse,
    } as any);

    const provider = new Mem0MemoryProvider(mockConfig);
    const results = await provider.search({ query: 'how to structure backend', userId: 'user_123' });

    expect(results).toHaveLength(2);
    expect(results[0]?.memory).toBe('User is a TypeScript developer');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mem0.ai/v1/memories/search/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Token test-mem0-api-key' }),
      })
    );
  });

  it('should send interaction messages to Mem0 add endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Success' }),
    } as any);

    const provider = new Mem0MemoryProvider(mockConfig);
    await provider.add({
      userId: 'user_123',
      messages: [
        { role: 'user', content: 'I prefer Fastify over Express' },
        { role: 'assistant', content: 'Got it, Fastify is great!' },
      ],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.mem0.ai/v1/memories/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'I prefer Fastify over Express' },
            { role: 'assistant', content: 'Got it, Fastify is great!' },
          ],
          user_id: 'user_123',
          infer: true,
          custom_prompt:
            "Extract ONLY explicit personal facts, tech stack, skill level, learning goals, or preferences ABOUT THE USER (e.g. 'User wants to master Angular', 'User prefers TypeScript', 'User works as a frontend engineer'). Absolutely DO NOT extract what the AI assistant suggested, recommended, or explained. Never store assistant advice or general Q&A summaries. Focus strictly on the USER's profile, stated goals, and preferences. If no user facts exist, return no memories.",
        }),
      })
    );
  });

  it('should handle API errors gracefully during search', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as any);

    const provider = new Mem0MemoryProvider(mockConfig);
    const results = await provider.search({ query: 'test', userId: 'user_123' });

    expect(results).toEqual([]);
  });
});
