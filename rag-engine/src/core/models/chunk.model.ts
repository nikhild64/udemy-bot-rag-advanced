/**
 * Metadata describing the origin and properties of a semantic chunk.
 */
export interface ChunkMetadata {
  readonly courseId: string;
  readonly courseTitle?: string | undefined;
  readonly moduleId: string;
  readonly moduleTitle?: string | undefined;
  readonly lessonId: string;
  readonly lessonTitle?: string | undefined;
  readonly transcriptId: string;
  readonly transcriptFile?: string | undefined;
  readonly chunkIndex?: number;
  readonly startTime?: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly characterCount?: number;
  readonly cueCount?: number;
  readonly originalCueRange?: {
    readonly startCueId: string;
    readonly endCueId: string;
    readonly startOrder?: number;
    readonly endOrder?: number;
  };
  readonly language?: string | undefined;
  readonly [key: string]: unknown;
}

/**
 * Represents a small semantic portion of a transcript used for embedding and retrieval.
 */
export interface Chunk {
  readonly id: string;
  readonly text: string;
  readonly metadata: ChunkMetadata;
  readonly courseId?: string;
  readonly moduleId?: string;
  readonly lessonId?: string;
  readonly transcriptId?: string;
  readonly chunkIndex?: number;
  readonly startTime?: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly characterCount?: number;
  readonly cueCount?: number;
}

/**
 * Represents a semantic chunk enriched with an embedding vector and provider metadata.
 */
export interface EmbeddedChunk extends Chunk {
  readonly embedding: readonly number[];
  readonly embeddingModel: string;
  readonly embeddingDimension: number;
  readonly providerName: string;
  readonly provider?: string;
}

