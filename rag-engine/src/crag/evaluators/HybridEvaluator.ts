import { RetrievalEvaluator } from '../../core/contracts/crag-evaluator.contract';
import { ChatProvider } from '../../core/contracts/chat-provider.contract';
import { CRAGEvaluationResult } from '../../core/models/crag.model';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { SimilarityScoreEvaluator } from './SimilarityScoreEvaluator';
import { LLMEvaluator } from './LLMEvaluator';
import { logger } from '../../shared/logger';

export class HybridEvaluator implements RetrievalEvaluator {
  private readonly similarityEvaluator: SimilarityScoreEvaluator;
  private readonly llmEvaluator: LLMEvaluator;

  constructor(
    chatProvider: ChatProvider,
    similarityThreshold: number = 0.7,
    private readonly minChunkConfidence: number = 0.5,
    private readonly highSimilarityThreshold: number = 0.85
  ) {
    this.similarityEvaluator = new SimilarityScoreEvaluator(similarityThreshold, minChunkConfidence);
    this.llmEvaluator = new LLMEvaluator(chatProvider, similarityThreshold, minChunkConfidence);
  }

  public async evaluate(query: string, chunks: RetrievedChunk[]): Promise<CRAGEvaluationResult> {
    const documentsEvaluated = chunks.length;
    if (documentsEvaluated === 0) {
      return this.similarityEvaluator.evaluate(query, chunks);
    }

    const scores = chunks.map(c => c.score);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    const averageSimilarity = sum / documentsEvaluated;
    const maxSimilarity = Math.max(...scores);

    // Fast-path 1: High similarity average -> Automatic Accept
    if (averageSimilarity >= this.highSimilarityThreshold) {
      logger.debug(
        { averageSimilarity, highThreshold: this.highSimilarityThreshold },
        'HybridEvaluator: High average similarity fast-path accepted'
      );
      return {
        decision: 'accept',
        score: Math.min(1, averageSimilarity),
        averageSimilarity,
        maxSimilarity,
        reasoning: `High average similarity (${averageSimilarity.toFixed(3)}) fast-path accepted without LLM.`,
        documentsEvaluated,
      };
    }

    // Fast-path 2: Low max similarity -> Automatic Reject
    if (maxSimilarity < this.minChunkConfidence) {
      logger.debug(
        { maxSimilarity, minConfidence: this.minChunkConfidence },
        'HybridEvaluator: Low max similarity fast-path rejected'
      );
      return {
        decision: 'reject',
        score: Math.max(0, averageSimilarity),
        averageSimilarity,
        maxSimilarity,
        reasoning: `Max similarity (${maxSimilarity.toFixed(3)}) below min confidence (${this.minChunkConfidence}). Fast-path rejected without LLM.`,
        documentsEvaluated,
      };
    }

    // Ambiguous region: Delegate to LLMEvaluator for reasoning
    logger.debug(
      { averageSimilarity, maxSimilarity },
      'HybridEvaluator: Ambiguous score range, delegating to LLMEvaluator'
    );
    return this.llmEvaluator.evaluate(query, chunks);
  }
}
