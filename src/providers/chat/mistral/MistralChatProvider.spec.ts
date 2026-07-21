import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MistralChatProvider } from './MistralChatProvider';
import { ProviderError, ConfigurationError } from '@/shared/errors';

describe('MistralChatProvider', () => {
  const mockApiKey = 'test-api-key';
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createProvider = (options = {}) =>
    new MistralChatProvider({
      apiKey: mockApiKey,
      maxRetries: 1,
      timeoutMs: 1000,
      ...options,
    });

  it('throws ConfigurationError if API key is missing', () => {
    expect(() => new MistralChatProvider({ apiKey: '' })).toThrow(ConfigurationError);
  });

  it('generates a chat response successfully', async () => {
    const provider = createProvider();
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello world',
            },
          },
        ],
      }),
    } as Response);

    const response = await provider.generateResponse(
      [{ role: 'user', content: 'Hi' }],
      { task: 'chat' }
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.message.content).toBe('Hello world');
    expect(response.message.role).toBe('assistant');
  });

  it('resolves the correct model for query-transformation task', async () => {
    const provider = createProvider();
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Success' } }],
      }),
    } as Response);

    await provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'query-transformation' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const fetchOptions = fetchCall[1] as RequestInit;
    const body = JSON.parse(fetchOptions.body as string);
    // Depends on config.chat.queryTransformationModel default which is 'mistral-small-latest'
    expect(body.model).toBe('mistral-small-latest');
  });

  it('throws ConfigurationError on unknown task', async () => {
    const provider = createProvider();
    await expect(provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'unknown-task' as any })).rejects.toThrow(ConfigurationError);
  });

  it('throws ProviderError on empty messages array', async () => {
    const provider = createProvider();
    await expect(provider.generateResponse([], { task: 'chat' })).rejects.toThrow(ProviderError);
  });

  it('retries on rate limit (429) and eventually succeeds', async () => {
    const provider = createProvider();

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Retried successfully' } }],
        }),
      } as Response);

    const responsePromise = provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'chat' });
    
    await vi.runAllTimersAsync();
    
    const response = await responsePromise;
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(response.message.content).toBe('Retried successfully');
  });

  it('throws ProviderError after max retries', async () => {
    const provider = createProvider({ maxRetries: 2 });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    const promise = provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'chat' });
    promise.catch(() => {}); // Prevent unhandled rejection warning
    
    // Fast-forward through all retries
    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toThrow(/Internal Server Error/);
    expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('throws ProviderError on 401 without retrying', async () => {
    const provider = createProvider();

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    } as Response);

    await expect(provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'chat' })).rejects.toThrow(ProviderError);
    await expect(provider.generateResponse([{ role: 'user', content: 'Hi' }], { task: 'chat' })).rejects.toThrow(/Authentication failure/);
    // Called 2 times because we did it twice in the asserts
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
