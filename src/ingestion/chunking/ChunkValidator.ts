import { Chunk } from '@/core/models';
import { ChunkValidationResult } from './ChunkingResult';
import { ChunkingConfig } from '@/config';

export interface IChunkValidator {
  /**
   * Validates an array of generated domain Chunk models against validation rules and optional configuration limits.
   */
  validate(chunks: readonly Chunk[], config?: Partial<ChunkingConfig>): ChunkValidationResult;
}

/**
 * Service responsible for validating semantic chunks for errors such as:
 * empty chunks, duplicate chunk IDs, invalid timestamps, invalid cue ordering, and invalid overlap.
 */
export class ChunkValidator implements IChunkValidator {
  validate(chunks: readonly Chunk[], config?: Partial<ChunkingConfig>): ChunkValidationResult {
    const errors: string[] = [];

    if (!chunks || chunks.length === 0) {
      return {
        valid: false,
        errors: ['No chunks generated: chunk list is empty or null'],
      };
    }

    if (config) {
      const overlap = config.overlapCharacters ?? 0;
      const max = config.maxCharacters ?? Infinity;
      if (overlap < 0 || overlap >= max) {
        errors.push(
          `Invalid overlap configuration: overlapCharacters (${overlap}) must be non-negative and strictly less than maxCharacters (${max})`,
        );
      }
    }

    const seenIds = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      // Validate ID existence and uniqueness
      if (!chunk.id || chunk.id.trim().length === 0) {
        errors.push(`Chunk at index ${i} is missing a valid chunk ID`);
      } else if (seenIds.has(chunk.id)) {
        errors.push(`Duplicate chunk ID detected: "${chunk.id}"`);
      } else {
        seenIds.add(chunk.id);
      }

      // Validate empty text
      if (!chunk.text || chunk.text.trim().length === 0) {
        errors.push(`Empty chunk detected: chunk "${chunk.id || i}" contains no text content`);
      }

      // Validate timestamps
      const startTime = chunk.startTime ?? chunk.metadata.startTime;
      const endTime = chunk.endTime ?? chunk.metadata.endTime;

      if (startTime !== undefined && endTime !== undefined) {
        if (startTime < 0 || endTime < 0) {
          errors.push(
            `Invalid timestamps in chunk "${chunk.id || i}": negative timestamp values (start: ${startTime}, end: ${endTime})`,
          );
        }
        if (startTime > endTime) {
          errors.push(
            `Invalid timestamps in chunk "${chunk.id || i}": startTime (${startTime}) > endTime (${endTime})`,
          );
        }
      }

      // Validate cue ordering
      const cueRange = chunk.metadata.originalCueRange;
      if (cueRange) {
        if (
          cueRange.startOrder !== undefined &&
          cueRange.endOrder !== undefined &&
          cueRange.startOrder > cueRange.endOrder
        ) {
          errors.push(
            `Invalid cue ordering in chunk "${chunk.id || i}": startOrder (${cueRange.startOrder}) > endOrder (${cueRange.endOrder})`,
          );
        }
      }

      // Validate consecutive chunk overlap / temporal continuity
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        if (prevChunk) {
          const prevStart = prevChunk.startTime ?? prevChunk.metadata.startTime;
          if (prevStart !== undefined && startTime !== undefined) {
            if (startTime < prevStart) {
              errors.push(
                `Invalid overlap/temporal ordering between consecutive chunks: chunk "${chunk.id}" starts at ${startTime}, which is before previous chunk "${prevChunk.id}" start ${prevStart}`,
              );
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
