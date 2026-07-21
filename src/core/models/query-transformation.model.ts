export interface QueryTransformationRequest {
  query: string;
}

export interface QueryTransformationResult {
  originalQuery: string;
  transformedQuery: string;
  strategy: string;
  metadata: Record<string, unknown>;
}
