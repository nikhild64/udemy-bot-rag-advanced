import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NvidiaChatProvider } from '../src/providers/chat/nvidia/NvidiaChatProvider';
import { ChatProviderFactory } from '../src/providers/chat/ChatProviderFactory';
import { ConfigurationError, ProviderError } from '../src/shared/errors';
import { ChatMessage } from '../src/core/models';

describe('NvidiaChatProvider & ChatProviderFactory', () => {
  const validOptions = {
    apiKey: 'nvapi-test-chat-key',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    chatModel: 'meta/llama-3.3-70b-instruct',
    queryTransformationModel: 'meta/llama-3.3-70b-instruct',
    maxRetries: 1,
  };

  const sampleMessages: ChatMessage[] = [
    { role: 'user', content: 'Hello NVIDIA' },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Initialization & Configuration', () => {
    it('should initialize successfully with valid options', () => {
      const provider = new NvidiaChatProvider(validOptions);
      expect(provider).toBeInstanceOf(NvidiaChatProvider);
    });

    it('should throw ConfigurationError if apiKey is missing', () => {
      expect(() => new NvidiaChatProvider({ ...validOptions, apiKey: '' })).toThrow(ConfigurationError);
    });
  });

  describe('ChatProviderFactory integration', () => {
    it('should instantiate NvidiaChatProvider when providerName is nvidia', () => {
      const provider = ChatProviderFactory.create('nvidia');
      expect(provider).toBeInstanceOf(NvidiaChatProvider);
    });
  });

  describe('generateResponse()', () => {
    it('should throw ProviderError if messages array is empty', async () => {
      const provider = new NvidiaChatProvider(validOptions);
      await expect(provider.generateResponse([], { task: 'chat' })).rejects.toThrow(ProviderError);
    });

    it('should format request body correctly and return choice content', async () => {
      const provider = new NvidiaChatProvider(validOptions);

      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello human!' },
            finish_reason: 'stop',
          },
        ],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await provider.generateResponse(sampleMessages, { task: 'chat', temperature: 0.7 });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, req] = (fetch as any).mock.calls[0];
      expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');

      const body = JSON.parse(req.body);
      expect(body.model).toBe('meta/llama-3.3-70b-instruct');
      expect(body.temperature).toBe(0.7);
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello NVIDIA' }]);

      expect(res).toEqual({
        message: {
          role: 'assistant',
          content: 'Hello human!',
        },
      });
    });

    it('should handle 401 authentication errors', async () => {
      const provider = new NvidiaChatProvider(validOptions);

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid token' }),
      });

      await expect(provider.generateResponse(sampleMessages, { task: 'chat' })).rejects.toThrow(ProviderError);
    });
  });

  describe('streamResponse()', () => {
    it('should stream chunks from SSE response body', async () => {
      const provider = new NvidiaChatProvider(validOptions);

      const encoder = new TextEncoder();
      const streamData = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World!"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let streamIndex = 0;
      const customReadableStream = new ReadableStream({
        pull(controller) {
          if (streamIndex < streamData.length) {
            controller.enqueue(encoder.encode(streamData[streamIndex++]));
          } else {
            controller.close();
          }
        },
      });

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        body: customReadableStream,
      });

      const chunks = [];
      for await (const chunk of provider.streamResponse(sampleMessages, { task: 'chat' })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const fullText = chunks.map((c) => c.content).join('');
      expect(fullText).toBe('Hello World!');
    });
  });
});
