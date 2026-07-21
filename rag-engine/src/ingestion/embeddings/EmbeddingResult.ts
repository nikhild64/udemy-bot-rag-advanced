import { EmbeddedChunk } from '@/core/models';

/**
 * Result of validating an individual chunk or embedding vector during the embedding pipeline.
 */
export interface EmbeddingValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Summary result of generating embeddings for semantic chunks across a course or collection of chunks.
 */
export interface EmbeddingResult {
  readonly courseId: string;
  readonly courseName: string;
  readonly providerName: string;
  readonly embeddingModel: string;
  readonly chunksCount: number;
  readonly embeddingsGeneratedCount: number;
  readonly failedChunksCount: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly embeddedChunks: readonly EmbeddedChunk[];
  readonly errors: readonly string[];
}
