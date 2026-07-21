import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { ConfigurationError, ProviderError } from '@/shared/errors';
import { config } from '@/config';

export interface MistralEmbeddingProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly apiUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

interface MistralEmbeddingResponseItem {
  readonly object?: string;
  readonly embedding?: number[];
  readonly index?: number;
}

interface MistralEmbeddingResponse {
  readonly id?: string;
  readonly object?: string;
  readonly data?: MistralEmbeddingResponseItem[];
  readonly model?: string;
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'Mistral';
  readonly modelName: string;
  readonly dimension = 1024;

  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: MistralEmbeddingProviderOptions = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.embeddings.mistralApiKey;
    this.modelName = options.model !== undefined ? options.model : config.embeddings.mistralEmbeddingModel;
    this.apiUrl = options.apiUrl !== undefined ? options.apiUrl : config.embeddings.mistralApiUrl;
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : config.embeddings.timeoutMs;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;

    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ConfigurationError('MISTRAL_API_KEY is required when using Mistral embedding provider');
    }

    if (!this.modelName || !this.modelName.trim()) {
      throw new ConfigurationError('MISTRAL_EMBEDDING_MODEL is required when using Mistral embedding provider');
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    const batchResult = await this.embed([text]);
    if (!batchResult[0]) {
      throw new ProviderError('Mistral API returned empty embedding vector array for single text input');
    }
    return batchResult[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
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
          response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: this.modelName,
              input: texts,
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
            // Ignore non-json body
          }

          if (status === 401 || status === 403) {
            throw new ProviderError(`Authentication failure with Mistral API: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Rate limit exceeded for Mistral API: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Rate limit exceeded for Mistral API after retries: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Mistral API server error: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Provider unavailable: ${errorMessage}`, {
              statusCode: status,
            });
          }

          throw new ProviderError(`Mistral API request failed: ${errorMessage}`, {
            statusCode: status,
          });
        }

        const data = (await response.json()) as MistralEmbeddingResponse;
        if (!data || !data.data || !Array.isArray(data.data)) {
          throw new ProviderError(
            'Invalid embedding response format received from Mistral API: missing or malformed data array',
          );
        }

        const sortedItems = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        const vectors: number[][] = [];

        for (const item of sortedItems) {
          if (!item.embedding || !Array.isArray(item.embedding) || item.embedding.length === 0) {
            throw new ProviderError('Invalid embedding response received from Mistral API: vector is missing or empty');
          }
          vectors.push(item.embedding);
        }

        if (vectors.length !== texts.length) {
          throw new ProviderError(
            `Mismatch in returned embedding vectors count (${vectors.length}) vs input texts count (${texts.length})`,
          );
        }

        return vectors;
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
    throw new ProviderError(`Provider unavailable or request timed out after retries: ${causeMsg}`, {
      cause: lastError instanceof Error ? lastError : undefined,
    });
  }
}
