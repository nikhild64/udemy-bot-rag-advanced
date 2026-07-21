import { Chunk, Transcript } from '@/core/models';
import { ChunkingConfig } from '@/config';

/**
 * Context and options passed to a chunking strategy when processing a transcript.
 */
export interface ChunkingStrategyContext {
  readonly courseId: string;
  readonly moduleId: string;
  readonly lessonId: string;
  readonly transcriptId: string;
  readonly sourceFile?: string | undefined;
  readonly config?: Partial<ChunkingConfig> | undefined;
}

/**
 * Strategy interface for splitting a transcript into semantically meaningful chunks.
 * Providers or strategies must implement this interface without generating embeddings.
 */
export interface ChunkingStrategy {
  /**
   * Unique identifier/name of the chunking strategy.
   */
  readonly name: string;

  /**
   * Split a transcript into an array of chunks according to the strategy's algorithm.
   */
  chunk(
    transcript: Transcript,
    context: ChunkingStrategyContext,
  ): Promise<readonly Chunk[]> | readonly Chunk[];
}
