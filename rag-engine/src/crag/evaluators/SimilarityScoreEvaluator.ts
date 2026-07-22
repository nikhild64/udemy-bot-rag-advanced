import { RetrievalEvaluator } from '../../core/contracts/crag-evaluator.contract';
import { CRAGEvaluationResult } from '../../core/models/crag.model';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { logger } from '../../shared/logger';

export class SimilarityScoreEvaluator implements RetrievalEvaluator {
  constructor(
    private readonly similarityThreshold: number = 0.7,
    private readonly minChunkConfidence: number = 0.5
  ) {}

  public async evaluate(query: string, chunks: RetrievedChunk[]): Promise<CRAGEvaluationResult> {
    const documentsEvaluated = chunks.length;

    if (documentsEvaluated === 0) {
      logger.debug({ query }, 'SimilarityScoreEvaluator: No chunks retrieved');
      return {
        decision: 'reject',
        score: 0,
        averageSimilarity: 0,
        maxSimilarity: 0,
        reasoning: 'No chunks retrieved for the query.',
        documentsEvaluated: 0,
      };
    }

    const scores = chunks.map(c => c.score);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    const averageSimilarity = sum / documentsEvaluated;
    const maxSimilarity = Math.max(...scores);

    let decision: 'accept' | 'correct' | 'reject';
    let reasoning: string;

    if (averageSimilarity >= this.similarityThreshold) {
      decision = 'accept';
      reasoning = `Average similarity (${averageSimilarity.toFixed(3)}) exceeds threshold (${this.similarityThreshold}).`;
    } else if (maxSimilarity >= this.minChunkConfidence) {
      decision = 'correct';
      reasoning = `Average similarity (${averageSimilarity.toFixed(3)}) is below threshold (${this.similarityThreshold}), but max similarity (${maxSimilarity.toFixed(3)}) meets min confidence (${this.minChunkConfidence}).`;
    } else {
      decision = 'reject';
      reasoning = `Max similarity (${maxSimilarity.toFixed(3)}) is below min confidence (${this.minChunkConfidence}). Context insufficient.`;
    }

    logger.debug(
      { averageSimilarity, maxSimilarity, decision, documentsEvaluated },
      'SimilarityScoreEvaluator completed'
    );

    return {
      decision,
      score: Math.min(1, Math.max(0, averageSimilarity)),
      averageSimilarity,
      maxSimilarity,
      reasoning,
      documentsEvaluated,
    };
  }
}
