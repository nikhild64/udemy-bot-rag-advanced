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
});

export interface IngestionConfig {
  readonly inputDirectory: string;
  readonly extractionDirectory: string;
  readonly supportedTranscriptFormats: readonly TranscriptFormat[];
  readonly parsePreferredOnly: boolean;
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
  };
}

export const ingestionConfig: IngestionConfig = loadIngestionConfig();

