import { RetrievalEvaluator } from '../../core/contracts/crag-evaluator.contract';
import { CRAGEvaluationResult, CRAGDecision } from '../../core/models/crag.model';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { logger } from '../../shared/logger';

export class MultiMetricEvaluator implements RetrievalEvaluator {
  constructor(
    private readonly similarityThreshold: number = 0.7,
    private readonly minChunkConfidence: number = 0.5
  ) {}

  public async evaluate(query: string, chunks: RetrievedChunk[]): Promise<CRAGEvaluationResult> {
    const documentsEvaluated = chunks.length;

    if (documentsEvaluated === 0) {
      logger.debug({ query }, 'MultiMetricEvaluator: No chunks retrieved');
      return {
        decision: 'reject',
        score: 0,
        confidenceScore: 0,
        confidenceLabel: '0.00 - Low Confidence',
        averageSimilarity: 0,
        maxSimilarity: 0,
        chunkDiversity: 0,
        sourceDiversity: 0,
        contextCoverage: 0,
        metadataQuality: 0,
        reasoning: 'No chunks retrieved for the query.',
        documentsEvaluated: 0,
      };
    }

    // 1. Similarity Scores
    const scores = chunks.map((c) => c.score || 0);
    const averageSimilarity = scores.reduce((a, b) => a + b, 0) / documentsEvaluated;
    const maxSimilarity = Math.max(...scores);

    // 2. Chunk Diversity (Measure distinct terms / text uniqueness)
    const uniqueTexts = new Set(chunks.map((c) => (c.text || '').trim().toLowerCase()));
    const chunkDiversity = Math.min(1, uniqueTexts.size / documentsEvaluated);

    // 3. Source Diversity (Coverage across distinct source documents)
    const uniqueSources = new Set(
      chunks.map((c: any) => c.sourceId || c.sourceReference?.sourceId || c.citation?.courseId || 'default')
    );
    const sourceDiversity = Math.min(1, uniqueSources.size / documentsEvaluated);

    // 4. Context Coverage (Match query terms against retrieved text)
    const queryTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((term) => term.length > 2);

    let matchedTermsCount = 0;
    const combinedText = chunks.map((c) => (c.text || '').toLowerCase()).join(' ');

    if (queryTerms.length > 0) {
      for (const term of queryTerms) {
        if (combinedText.includes(term)) {
          matchedTermsCount++;
        }
      }
    }
    const contextCoverage = queryTerms.length > 0 ? Math.min(1, matchedTermsCount / queryTerms.length) : 1;

    // 5. Metadata Quality (Check presence of title, page, timestamp, or sourceName)
    let metadataQualityScore = 0;
    for (const chunk of chunks) {
      const c = chunk as any;
      if (c.sourceName || c.sourceReference || c.citation?.courseName) metadataQualityScore += 0.5;
      if (c.page !== undefined || c.timestamp !== undefined || c.startTime !== undefined || c.metadata) metadataQualityScore += 0.5;
    }
    const metadataQuality = Math.min(1, metadataQualityScore / documentsEvaluated);

    // Weighted Overall Confidence Score
    const confidenceScore = Math.min(
      1,
      Math.max(
        0,
        averageSimilarity * 0.5 +
          contextCoverage * 0.2 +
          chunkDiversity * 0.15 +
          sourceDiversity * 0.1 +
          metadataQuality * 0.05
      )
    );

    const confidenceLabel =
      confidenceScore >= 0.8
        ? `${confidenceScore.toFixed(2)} - High Confidence`
        : confidenceScore >= 0.5
          ? `${confidenceScore.toFixed(2)} - Medium Confidence`
          : `${confidenceScore.toFixed(2)} - Low Confidence`;

    let decision: CRAGDecision;
    let reasoning: string;

    if (confidenceScore >= this.similarityThreshold) {
      decision = 'accept';
      reasoning = `MultiMetric confidence (${confidenceScore.toFixed(2)}) meets acceptance threshold (${this.similarityThreshold}). High context relevance and coverage.`;
    } else if (maxSimilarity >= this.minChunkConfidence || confidenceScore >= this.minChunkConfidence) {
      decision = 'correct';
      reasoning = `MultiMetric confidence (${confidenceScore.toFixed(2)}) is moderate. Query transformation & corrective retrieval recommended.`;
    } else {
      decision = 'reject';
      reasoning = `MultiMetric confidence (${confidenceScore.toFixed(2)}) is below minimum confidence (${this.minChunkConfidence}). Context insufficient.`;
    }

    logger.debug(
      {
        confidenceScore,
        confidenceLabel,
        decision,
        averageSimilarity,
        chunkDiversity,
        sourceDiversity,
        contextCoverage,
      },
      'MultiMetricEvaluator completed evaluation'
    );

    return {
      decision,
      score: confidenceScore,
      confidenceScore,
      confidenceLabel,
      averageSimilarity,
      maxSimilarity,
      chunkDiversity,
      sourceDiversity,
      contextCoverage,
      metadataQuality,
      reasoning,
      documentsEvaluated,
    };
  }
}
