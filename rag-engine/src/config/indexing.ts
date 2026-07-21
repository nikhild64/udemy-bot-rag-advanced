import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const indexingSchema = z.object({
  INDEXING_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  INDEXING_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  INDEXING_RETRY_DELAY: z.coerce.number().int().min(0).default(1000),
});

export interface IndexingConfig {
  readonly batchSize: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

function loadIndexingConfig(): IndexingConfig {
  const result = indexingSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Indexing configuration validation failed: ${errorDetails}`);
  }

  return {
    batchSize: result.data.INDEXING_BATCH_SIZE,
    maxRetries: result.data.INDEXING_MAX_RETRIES,
    retryDelayMs: result.data.INDEXING_RETRY_DELAY,
  };
}

export const indexingConfig: IndexingConfig = loadIndexingConfig();
