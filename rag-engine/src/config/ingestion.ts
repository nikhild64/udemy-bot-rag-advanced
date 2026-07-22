import dotenv from 'dotenv';
import { z } from 'zod';
import { TranscriptFormat } from '@/types';

dotenv.config();

const ingestionSchema = z.object({
  DATA_INPUT_DIRECTORY: z.string().min(1).default('./data/input'),
  DATA_EXTRACTION_DIRECTORY: z.string().min(1).default('./data/extracted'),
  INGESTION_PARSE_PREFERRED_ONLY: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return val;
  }, z.boolean()).default(true),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  INGESTION_RETRY_COUNT: z.coerce.number().default(3),
  INGESTION_RETRY_DELAY_MS: z.coerce.number().default(1000),
  SOURCE_CHUNK_SIZE: z.coerce.number().default(500),
  SOURCE_CHUNK_OVERLAP: z.coerce.number().default(50),
  EMBEDDING_BATCH_SIZE: z.coerce.number().default(50),
});

export interface IngestionConfig {
  readonly inputDirectory: string;
  readonly extractionDirectory: string;
  readonly supportedTranscriptFormats: readonly TranscriptFormat[];
  readonly parsePreferredOnly: boolean;
  readonly workerConcurrency: number;
  readonly retryCount: number;
  readonly retryDelayMs: number;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly embeddingBatchSize: number;
}

function loadIngestionConfig(): IngestionConfig {
  const result = ingestionSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Ingestion configuration validation failed: ${errorDetails}`);
  }

  return {
    inputDirectory: result.data.DATA_INPUT_DIRECTORY,
    extractionDirectory: result.data.DATA_EXTRACTION_DIRECTORY,
    supportedTranscriptFormats: [TranscriptFormat.VTT, TranscriptFormat.SRT],
    parsePreferredOnly: result.data.INGESTION_PARSE_PREFERRED_ONLY,
    workerConcurrency: result.data.WORKER_CONCURRENCY,
    retryCount: result.data.INGESTION_RETRY_COUNT,
    retryDelayMs: result.data.INGESTION_RETRY_DELAY_MS,
    chunkSize: result.data.SOURCE_CHUNK_SIZE,
    chunkOverlap: result.data.SOURCE_CHUNK_OVERLAP,
    embeddingBatchSize: result.data.EMBEDDING_BATCH_SIZE,
  };
}

export const ingestionConfig: IngestionConfig = loadIngestionConfig();


