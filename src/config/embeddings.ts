import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const embeddingsSchema = z.object({
  EMBEDDING_PROVIDER: z.string().min(1).default('mistral'),
  MISTRAL_API_KEY: z.string().default(''),
  MISTRAL_EMBEDDING_MODEL: z.string().min(1).default('mistral-embed'),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  EMBEDDING_TIMEOUT: z.coerce.number().int().positive().default(30000),
  MISTRAL_API_URL: z.string().default('https://api.mistral.ai/v1/embeddings'),
});

export interface EmbeddingsConfig {
  readonly provider: string;
  readonly mistralApiKey: string;
  readonly mistralEmbeddingModel: string;
  readonly batchSize: number;
  readonly timeoutMs: number;
  readonly mistralApiUrl: string;
}

function loadEmbeddingsConfig(): EmbeddingsConfig {
  const result = embeddingsSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Embeddings configuration validation failed: ${errorDetails}`);
  }

  return {
    provider: result.data.EMBEDDING_PROVIDER,
    mistralApiKey: result.data.MISTRAL_API_KEY,
    mistralEmbeddingModel: result.data.MISTRAL_EMBEDDING_MODEL,
    batchSize: result.data.EMBEDDING_BATCH_SIZE,
    timeoutMs: result.data.EMBEDDING_TIMEOUT,
    mistralApiUrl: result.data.MISTRAL_API_URL,
  };
}

export const embeddingsConfig: EmbeddingsConfig = loadEmbeddingsConfig();
