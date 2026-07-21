export interface IndexingReport {
  readonly courseId: string;
  readonly courseName: string;
  readonly totalChunks: number;
  readonly successfulEmbeddings: number;
  readonly successfulUploads: number;
  readonly failedChunks: number;
  readonly durationMs: number;
  readonly retryCount: number;
  readonly success: boolean;
  readonly errors: readonly string[];
}
