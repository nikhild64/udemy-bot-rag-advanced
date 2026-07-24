export interface NotebookRetrievalOptions {
  notebookId: string;
  userId?: string | undefined;
  query?: string | undefined;
  topK?: number | undefined;
  candidateLimit?: number | undefined;
  similarityThreshold?: number | undefined;
  maxContextTokens?: number | undefined;
  filters?: Record<string, unknown> | undefined;
  transformationStrategy?: string | undefined;
  rerankerProvider?: string | undefined;
}

export interface NotebookRetrievedChunk {
  chunkId: string;
  text: string;
  score: number;
  originalScore?: number | undefined;
  rerankScore?: number | undefined;
  notebookId: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  page?: number | null | undefined;
  timestamp?: number | null | undefined;
  metadata: Record<string, unknown>;
}

export interface Citation {
  citationId: string;
  notebookId: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  page?: number | null | undefined;
  timestamp?: number | null | undefined;
  chunkId: string;
  snippet: string;
  similarityScore: number;
}

export type NotebookCitation = Citation;

export interface NotebookRetrievalMetadata {
  notebookId: string;
  originalQuery: string;
  transformedQuery: string;
  retrievalDurationMs: number;
  rerankDurationMs: number;
  totalDurationMs: number;
  candidateCount: number;
  finalChunkCount: number;
  citationCount: number;
  appliedFilters: Record<string, unknown> | null;
  confidenceScore?: number | undefined;
  confidenceLabel?: string | undefined;
  evaluationDecision?: 'accept' | 'correct' | 'reject' | undefined;
  retryCount?: number | undefined;
  queryRewrites?: string[] | undefined;
  acceptedChunkCount?: number | undefined;
  rejectedChunkCount?: number | undefined;
}

export interface NotebookRetrievalResult {
  context: string;
  chunks: NotebookRetrievedChunk[];
  citations: Citation[];
  confidenceScore?: number | undefined;
  confidenceLabel?: string | undefined;
  metadata: NotebookRetrievalMetadata;
}
