import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { Citation } from '../../retrieval/Citation';

export type CRAGDecision = 'accept' | 'correct' | 'reject';

export interface CRAGEvaluationResult {
  readonly decision: CRAGDecision;
  readonly score: number;
  readonly averageSimilarity: number;
  readonly maxSimilarity: number;
  readonly reasoning?: string;
  readonly documentsEvaluated: number;
}

export interface CRAGMetrics {
  readonly evaluationStrategy: string;
  readonly similarityScore: number;
  readonly confidenceScore: number;
  readonly retryCount: number;
  readonly finalDecision: CRAGDecision;
  readonly retrievalLatencyMs: number;
  readonly documentsAccepted: number;
  readonly documentsDiscarded: number;
  readonly correctiveActionsTaken: string[];
}

export interface CRAGResult {
  readonly decision: CRAGDecision;
  readonly chunks: RetrievedChunk[];
  readonly citations: Citation[];
  readonly metrics: CRAGMetrics;
}
