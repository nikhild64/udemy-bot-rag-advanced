import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MistralEmbeddingProvider, EmbeddingProviderFactory } from '../src/providers/embeddings';
import { ConfigurationError, ProviderError } from '../src/shared/errors';

describe('MistralEmbeddingProvider & EmbeddingProviderFactory', () => {
  const validOptions = {
    apiKey: 'test-mistral-api-key',
    model: 'mistral-embed',
    apiUrl: 'https://api.mistral.ai/v1/embeddings',
    maxRetries: 1, // Keep low for fast unit tests
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Configuration & Initialization', () => {
    it('should initialize successfully with valid API key and model', () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      expect(provider.providerName).toBe('Mistral');
      expect(provider.modelName).toBe('mistral-embed');
      expect(provider.dimension).toBe(1024);
    });

    it('should throw ConfigurationError if MISTRAL_API_KEY is missing or empty', () => {
      expect(() => new MistralEmbeddingProvider({ ...validOptions, apiKey: '' })).toThrow(ConfigurationError);
      expect(() => new MistralEmbeddingProvider({ ...validOptions, apiKey: '   ' })).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError if MISTRAL_EMBEDDING_MODEL is missing or empty', () => {
      expect(() => new MistralEmbeddingProvider({ ...validOptions, model: '' })).toThrow(ConfigurationError);
    });
  });

  describe('EmbeddingProviderFactory', () => {
    it('should create MistralEmbeddingProvider when requested or by default', () => {
      const provider = EmbeddingProviderFactory.create('mistral', validOptions);
      expect(provider).toBeInstanceOf(MistralEmbeddingProvider);
    });

    it('should throw ConfigurationError for unsupported provider names', () => {
      expect(() => EmbeddingProviderFactory.create('openai')).toThrow(ConfigurationError);
      expect(() => EmbeddingProviderFactory.create('unsupported-provider')).toThrow(ConfigurationError);
    });
  });

  describe('embed() & batch processing', () => {
    it('should return empty array when embedding zero texts', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      const result = await provider.embed([]);
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should successfully generate embeddings for batch of texts sorting by response index', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      const mockResponse = {
        id: 'embd-123',
        object: 'list',
        data: [
          { object: 'embedding', embedding: [0.4, 0.5, 0.6], index: 1 },
          { object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 },
        ],
        model: 'mistral-embed',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await provider.embed(['hello', 'world']);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
    });

    it('should support embedSingle() and embedBatch() methods', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      const mockResponse = {
        id: 'embd-123',
        data: [{ object: 'embedding', embedding: [0.9, 0.8], index: 0 }],
      };

      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      const single = await provider.embedSingle('test string');
      expect(single).toEqual([0.9, 0.8]);

      const batch = await provider.embedBatch(['test string']);
      expect(batch).toEqual([[0.9, 0.8]]);
    });
  });

  describe('Error Handling & Retries', () => {
    it('should throw ProviderError with authentication failure on 401 Unauthorized immediately', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401, statusText: 'Unauthorized' }),
        ),
      );

      await expect(provider.embed(['test'])).rejects.toThrow(ProviderError);
      await expect(provider.embed(['test'])).rejects.toThrow(/Authentication failure/);
      // Should not retry on 401
      expect(fetch).toHaveBeenCalledTimes(2); // 1 for first expect, 1 for second expect
    });

    it('should retry transient 429 Too Many Requests up to maxRetries before throwing ProviderError', async () => {
      const provider = new MistralEmbeddingProvider({ ...validOptions, maxRetries: 1 });
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Rate limit hit' }), { status: 429, statusText: 'Too Many Requests' }),
        ),
      );

      await expect(provider.embed(['test'])).rejects.toThrow(/Rate limit exceeded/);
      expect(fetch).toHaveBeenCalledTimes(2); // Initial attempt + 1 retry
    });

    it('should retry on 500 server errors and recover if subsequent attempt succeeds', async () => {
      const provider = new MistralEmbeddingProvider({ ...validOptions, maxRetries: 2 });
      const mockResponse = {
        data: [{ object: 'embedding', embedding: [0.5, 0.5], index: 0 }],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const result = await provider.embed(['test']);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([[0.5, 0.5]]);
    });

    it('should throw ProviderError on invalid response format or missing data array', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ object: 'error', data: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      await expect(provider.embed(['test'])).rejects.toThrow(/Invalid embedding response format/);
    });

    it('should throw ProviderError on missing or empty embedding vector inside response item', async () => {
      const provider = new MistralEmbeddingProvider(validOptions);
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [{ object: 'embedding', embedding: [], index: 0 }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      await expect(provider.embed(['test'])).rejects.toThrow(/vector is missing or empty/);
    });
  });
});
