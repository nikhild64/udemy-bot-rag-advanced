export const RETRIEVAL_DEFAULTS = {
  DEFAULT_TOP_K: 5,
  MAX_TOP_K: 20,
  DEFAULT_MINIMUM_SCORE: 0.7,
} as const;

export interface RetrievalOptions {
  topK?: number;
  minimumScore?: number;
  filters?: Record<string, unknown>;
}
