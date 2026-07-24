import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const embeddingsSchema = z
  .object({
    EMBEDDING_PROVIDER: z.string().min(1).default('mistral'),
    MISTRAL_API_KEY: z.string().default(''),
    MISTRAL_EMBEDDING_MODEL: z.string().min(1).default('mistral-embed'),
    NVIDIA_API_KEY: z.string().default(''),
    NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
    NVIDIA_EMBEDDING_MODEL: z.string().default('nvidia/nv-embedqa-e5-v5'),
    EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(100),
    EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().default(4),
    EMBEDDING_WAVE_DELAY_MS: z.coerce.number().int().min(0).default(0),
    EMBEDDING_TIMEOUT: z.coerce.number().int().positive().default(30000),
    MISTRAL_API_URL: z.string().default('https://api.mistral.ai/v1/embeddings'),
    EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),
  })
  .superRefine((data, ctx) => {
    const provider = data.EMBEDDING_PROVIDER.toLowerCase();
    if (provider === 'mistral' && (!data.MISTRAL_API_KEY || !data.MISTRAL_API_KEY.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MISTRAL_API_KEY is required when EMBEDDING_PROVIDER is mistral',
        path: ['MISTRAL_API_KEY'],
      });
    } else if (provider === 'nvidia' && (!data.NVIDIA_API_KEY || !data.NVIDIA_API_KEY.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NVIDIA_API_KEY is required when EMBEDDING_PROVIDER is nvidia',
        path: ['NVIDIA_API_KEY'],
      });
    }
  });

export interface EmbeddingsConfig {
  readonly provider: string;
  readonly mistralApiKey: string;
  readonly mistralEmbeddingModel: string;
  readonly nvidiaApiKey: string;
  readonly nvidiaBaseUrl: string;
  readonly nvidiaEmbeddingModel: string;
  readonly batchSize: number;
  readonly concurrency: number;
  readonly waveDelayMs: number;
  readonly timeoutMs: number;
  readonly mistralApiUrl: string;
  readonly dimension: number;
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
    nvidiaApiKey: result.data.NVIDIA_API_KEY,
    nvidiaBaseUrl: result.data.NVIDIA_BASE_URL,
    nvidiaEmbeddingModel: result.data.NVIDIA_EMBEDDING_MODEL,
    batchSize: result.data.EMBEDDING_BATCH_SIZE,
    concurrency: result.data.EMBEDDING_CONCURRENCY,
    waveDelayMs: result.data.EMBEDDING_WAVE_DELAY_MS,
    timeoutMs: result.data.EMBEDDING_TIMEOUT,
    mistralApiUrl: result.data.MISTRAL_API_URL,
    dimension: result.data.EMBEDDING_DIMENSION,
  };
}

export const embeddingsConfig: EmbeddingsConfig = loadEmbeddingsConfig();
