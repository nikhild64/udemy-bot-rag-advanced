import { Chunk } from '@/core/models';
import { EmbeddingValidationResult } from './EmbeddingResult';

export interface IEmbeddingValidator {
  /**
   * Validates a chunk before sending it to the embedding provider.
   */
  validateChunkBeforeEmbed(chunk: Chunk): EmbeddingValidationResult;

  /**
   * Validates the embedding vector returned by the provider.
   */
  validateEmbeddingVector(
    chunk: Chunk,
    vector: readonly number[] | undefined | null,
    expectedDimension?: number,
  ): EmbeddingValidationResult;
}

export class EmbeddingValidator implements IEmbeddingValidator {
  validateChunkBeforeEmbed(chunk: Chunk): EmbeddingValidationResult {
    const errors: string[] = [];

    if (!chunk) {
      errors.push('Chunk object cannot be null or undefined');
      return { valid: false, errors };
    }

    if (chunk.text === undefined || chunk.text === null || chunk.text.trim().length === 0) {
      errors.push(`Chunk text cannot be empty (chunk ID: ${chunk.id ?? 'unknown'})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateEmbeddingVector(
    chunk: Chunk,
    vector: readonly number[] | undefined | null,
    expectedDimension?: number,
  ): EmbeddingValidationResult {
    const errors: string[] = [];
    const chunkId = chunk?.id ?? 'unknown';

    if (vector === undefined || vector === null) {
      errors.push(`Missing provider response: embedding vector is undefined or null for chunk ID: ${chunkId}`);
      return { valid: false, errors };
    }

    if (!Array.isArray(vector) || vector.length === 0) {
      errors.push(`Empty embedding vector returned for chunk ID: ${chunkId}`);
      return { valid: false, errors };
    }

    if (expectedDimension !== undefined && expectedDimension > 0 && vector.length !== expectedDimension) {
      errors.push(
        `Incorrect embedding dimension for chunk ID: ${chunkId}. Expected ${expectedDimension}, got ${vector.length}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
