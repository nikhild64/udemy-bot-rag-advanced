import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { ConfigurationError, ProviderError } from '@/shared/errors';
import { config } from '@/config';

export interface NvidiaEmbeddingProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly dimension?: number;
}

interface NvidiaEmbeddingResponseItem {
  readonly object?: string;
  readonly embedding?: number[];
  readonly index?: number;
}

interface NvidiaEmbeddingResponse {
  readonly id?: string;
  readonly object?: string;
  readonly data?: NvidiaEmbeddingResponseItem[];
  readonly model?: string;
}

export class NvidiaEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'NVIDIA';
  readonly modelName: string;
  readonly dimension: number;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: NvidiaEmbeddingProviderOptions = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.embeddings.nvidiaApiKey;
    this.modelName = options.model !== undefined ? options.model : config.embeddings.nvidiaEmbeddingModel;
    this.baseUrl = (options.baseUrl !== undefined ? options.baseUrl : config.embeddings.nvidiaBaseUrl).replace(/\/+$/, '');
    this.dimension = options.dimension !== undefined ? options.dimension : config.embeddings.dimension;
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : config.embeddings.timeoutMs;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;

    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ConfigurationError('NVIDIA_API_KEY is required when using NVIDIA embedding provider');
    }

    if (!this.modelName || !this.modelName.trim()) {
      throw new ConfigurationError('NVIDIA_EMBEDDING_MODEL is required when using NVIDIA embedding provider');
    }
  }

  private get endpointUrl(): string {
    return `${this.baseUrl}/embeddings`;
  }

  async embedSingle(text: string, inputType: 'passage' | 'query' = 'passage'): Promise<number[]> {
    const batchResult = await this.embed([text], inputType);
    if (!batchResult[0]) {
      throw new ProviderError('NVIDIA API returned empty embedding vector array for single text input');
    }
    return batchResult[0];
  }

  async embedBatch(texts: string[], inputType: 'passage' | 'query' = 'passage'): Promise<number[][]> {
    return this.embed(texts, inputType);
  }

  async embed(texts: string[], inputType: 'passage' | 'query' = 'passage'): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.maxRetries) {
      if (attempt > 0) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      attempt++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
          response = await fetch(this.endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              input: texts,
              model: this.modelName,
              input_type: inputType,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Status ${status} ${response.statusText}`;
          try {
            const errJson = (await response.json()) as { message?: string; error?: { message?: string } };
            if (errJson.message) errorMessage += `: ${errJson.message}`;
            else if (errJson.error && errJson.error.message) errorMessage += `: ${errJson.error.message}`;
          } catch {
            // Ignore non-json response body
          }

          if (status === 401 || status === 403) {
            throw new ProviderError(`Authentication failure with NVIDIA Embedding API: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Rate limit exceeded for NVIDIA Embedding API: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Rate limit exceeded for NVIDIA Embedding API after retries: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`NVIDIA Embedding API server error: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Provider unavailable: ${errorMessage}`, {
              statusCode: status,
            });
          }

          throw new ProviderError(`NVIDIA Embedding API request failed: ${errorMessage}`, {
            statusCode: status,
          });
        }

        const data = (await response.json()) as NvidiaEmbeddingResponse;

        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
          throw new ProviderError('Invalid embedding response format received from NVIDIA API: missing data array');
        }

        const sortedItems = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        const embeddings = sortedItems.map((item) => {
          if (!item.embedding || !Array.isArray(item.embedding)) {
            throw new ProviderError('Invalid embedding item format: missing embedding vector');
          }
          return item.embedding;
        });

        return embeddings;
      } catch (err) {
        if (err instanceof ProviderError) {
          if (err.statusCode === 429 || (err.statusCode !== undefined && err.statusCode >= 500)) {
            lastError = err;
            continue;
          }
          throw err;
        }
        lastError = err;
      }
    }

    if (lastError instanceof ProviderError) {
      throw lastError;
    }

    const causeMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ProviderError(`Embedding provider unavailable or request timed out after retries: ${causeMsg}`, {
      cause: lastError instanceof Error ? lastError : undefined,
    });
  }
}
