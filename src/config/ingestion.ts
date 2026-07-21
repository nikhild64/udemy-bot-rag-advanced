import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ingestionSchema = z.object({
  DATA_INPUT_DIRECTORY: z.string().min(1).default('./data/input'),
});

export interface IngestionConfig {
  readonly inputDirectory: string;
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
  };
}

export const ingestionConfig: IngestionConfig = loadIngestionConfig();
