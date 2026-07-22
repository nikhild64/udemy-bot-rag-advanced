import { RetrievalEvaluator } from '../../core/contracts/crag-evaluator.contract';
import { ChatProvider } from '../../core/contracts/chat-provider.contract';
import { SimilarityScoreEvaluator } from './SimilarityScoreEvaluator';
import { LLMEvaluator } from './LLMEvaluator';
import { HybridEvaluator } from './HybridEvaluator';
import { config } from '../../config';

export class CRAGEvaluatorFactory {
  public static create(
    strategy?: string,
    chatProvider?: ChatProvider
  ): RetrievalEvaluator {
    const selectedStrategy = strategy || config.crag.strategy;
    const similarityThreshold = config.crag.similarityThreshold;
    const minConfidence = config.crag.minChunkConfidence;

    switch (selectedStrategy) {
      case 'similarity':
        return new SimilarityScoreEvaluator(similarityThreshold, minConfidence);

      case 'llm':
        if (!chatProvider) {
          return new SimilarityScoreEvaluator(similarityThreshold, minConfidence);
        }
        return new LLMEvaluator(chatProvider, similarityThreshold, minConfidence);

      case 'hybrid':
      default:
        if (!chatProvider) {
          return new SimilarityScoreEvaluator(similarityThreshold, minConfidence);
        }
        return new HybridEvaluator(chatProvider, similarityThreshold, minConfidence);
    }
  }
}
