import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ingestionSchema = z.object({
  DATA_INPUT_DIRECTORY: z.string().min(1).default('./data/input'),
  DATA_EXTRACTION_DIRECTORY: z.string().min(1).default('./data/extracted'),
});

export interface IngestionConfig {
  readonly inputDirectory: string;
  readonly extractionDirectory: string;
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
  };
}

export const ingestionConfig: IngestionConfig = loadIngestionConfig();
