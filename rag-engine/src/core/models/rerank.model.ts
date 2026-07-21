export interface RerankRequest<T = unknown> {
  readonly query: string;
  readonly chunks: readonly T[];
}

export interface RerankResult<T = unknown> {
  readonly query: string;
  readonly originalCount: number;
  readonly rerankedCount: number;
  readonly chunks: readonly T[];
  readonly provider: string;
  readonly metadata?: Record<string, unknown>;
}
