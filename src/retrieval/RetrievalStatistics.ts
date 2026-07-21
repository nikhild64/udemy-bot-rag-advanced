export interface RetrievalStatistics {
  searchDurationMs: number;
  embeddingDurationMs: number;
  retrievedChunksCount: number;
  appliedFilters: Record<string, unknown> | null;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}
