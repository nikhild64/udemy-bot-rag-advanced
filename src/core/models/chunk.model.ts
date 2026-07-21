/**
 * Metadata describing the origin and properties of a semantic chunk.
 */
export interface ChunkMetadata {
  readonly courseId: string;
  readonly moduleId: string;
  readonly lessonId: string;
  readonly transcriptId: string;
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
  readonly sourceTranscriptPath?: string;
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
