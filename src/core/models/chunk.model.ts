/**
 * Metadata describing the origin of a semantic chunk.
 */
export interface ChunkMetadata {
  readonly courseId: string;
  readonly moduleId: string;
  readonly lessonId: string;
  readonly transcriptId: string;
  readonly startTime?: number;
  readonly endTime?: number;
}

/**
 * Represents a small semantic portion of a transcript used for embedding and retrieval.
 */
export interface Chunk {
  readonly id: string;
  readonly text: string;
  readonly metadata: ChunkMetadata;
}
