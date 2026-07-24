import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NvidiaEmbeddingProvider, EmbeddingProviderFactory } from '../src/providers/embeddings';
import { ConfigurationError, ProviderError } from '../src/shared/errors';

describe('NvidiaEmbeddingProvider & EmbeddingProviderFactory', () => {
  const validOptions = {
    apiKey: 'nvapi-test-key',
    model: 'nvidia/nv-embedqa-e5-v5',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    maxRetries: 1,
    dimension: 1024,
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
      const provider = new NvidiaEmbeddingProvider(validOptions);
      expect(provider.providerName).toBe('NVIDIA');
      expect(provider.modelName).toBe('nvidia/nv-embedqa-e5-v5');
      expect(provider.dimension).toBe(1024);
    });

    it('should throw ConfigurationError if NVIDIA_API_KEY is missing or empty', () => {
      expect(() => new NvidiaEmbeddingProvider({ ...validOptions, apiKey: '' })).toThrow(ConfigurationError);
      expect(() => new NvidiaEmbeddingProvider({ ...validOptions, apiKey: '   ' })).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError if NVIDIA_EMBEDDING_MODEL is missing or empty', () => {
      expect(() => new NvidiaEmbeddingProvider({ ...validOptions, model: '' })).toThrow(ConfigurationError);
    });
  });

  describe('EmbeddingProviderFactory integration', () => {
    it('should create NvidiaEmbeddingProvider when requested', () => {
      const provider = EmbeddingProviderFactory.create('nvidia', validOptions);
      expect(provider).toBeInstanceOf(NvidiaEmbeddingProvider);
      expect(provider.providerName).toBe('NVIDIA');
    });
  });

  describe('embed() & batch processing', () => {
    it('should return empty array when embedding zero texts', async () => {
      const provider = new NvidiaEmbeddingProvider(validOptions);
      const result = await provider.embed([]);
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should send input_type: "passage" by default and parse sorted embeddings', async () => {
      const provider = new NvidiaEmbeddingProvider(validOptions);

      const mockResponse = {
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.embed(['text 1', 'text 2']);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, requestOptions] = (fetch as any).mock.calls[0];
      expect(url).toBe('https://integrate.api.nvidia.com/v1/embeddings');

      const parsedBody = JSON.parse(requestOptions.body);
      expect(parsedBody.input).toEqual(['text 1', 'text 2']);
      expect(parsedBody.model).toBe('nvidia/nv-embedqa-e5-v5');
      expect(parsedBody.input_type).toBe('passage');

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    });

    it('should pass input_type: "query" when requested for query embedding', async () => {
      const provider = new NvidiaEmbeddingProvider(validOptions);

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.5, 0.6] }],
        }),
      });

      const result = await provider.embedSingle('user query', 'query');
      expect(result).toEqual([0.5, 0.6]);

      const [, requestOptions] = (fetch as any).mock.calls[0];
      const parsedBody = JSON.parse(requestOptions.body);
      expect(parsedBody.input_type).toBe('query');
    });

    it('should handle API errors appropriately', async () => {
      const provider = new NvidiaEmbeddingProvider(validOptions);

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API Key' }),
      });

      await expect(provider.embed(['text'])).rejects.toThrow(ProviderError);
    });
  });
});
