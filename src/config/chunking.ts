import dotenv from 'dotenv';
import { z } from 'zod';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_MIN_SIZE,
} from '@/shared/constants';

dotenv.config();

const chunkingSchema = z.object({
  CHUNK_MAX_CHARACTERS: z.coerce.number().int().positive().default(DEFAULT_CHUNK_SIZE),
  CHUNK_OVERLAP_CHARACTERS: z.coerce.number().int().nonnegative().default(DEFAULT_CHUNK_OVERLAP),
  CHUNK_MIN_CHARACTERS: z.coerce.number().int().nonnegative().default(DEFAULT_CHUNK_MIN_SIZE),
});

export interface ChunkingConfig {
  readonly maxCharacters: number;
  readonly overlapCharacters: number;
  readonly minCharacters: number;
}

function loadChunkingConfig(): ChunkingConfig {
  const result = chunkingSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Chunking configuration validation failed: ${errorDetails}`);
  }

  return {
    maxCharacters: result.data.CHUNK_MAX_CHARACTERS,
    overlapCharacters: result.data.CHUNK_OVERLAP_CHARACTERS,
    minCharacters: result.data.CHUNK_MIN_CHARACTERS,
  };
}

export const chunkingConfig: ChunkingConfig = loadChunkingConfig();
