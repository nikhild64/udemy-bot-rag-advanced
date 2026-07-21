import { Chunk } from '@/core/models';

/**
 * Result of validating a generated chunk or array of chunks.
 */
export interface ChunkValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Summary result of chunking an individual transcript.
 */
export interface TranscriptChunkingResult {
  readonly transcriptId: string;
  readonly lessonId: string;
  readonly courseId: string;
  readonly moduleId: string;
  readonly chunksCount: number;
  readonly averageChunkSize: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly chunks: readonly Chunk[];
  readonly errors: readonly string[];
}

/**
 * Summary result of chunking all parsed transcripts across a course or manifest.
 */
export interface ChunkingResult {
  readonly courseId: string;
  readonly courseName: string;
  readonly lessonsCount: number;
  readonly transcriptsChunkedCount: number;
  readonly failedTranscriptsCount: number;
  readonly totalChunksCount: number;
  readonly averageChunkSize: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly chunks: readonly Chunk[];
  readonly transcriptResults: readonly TranscriptChunkingResult[];
  readonly errors: readonly string[];
}
