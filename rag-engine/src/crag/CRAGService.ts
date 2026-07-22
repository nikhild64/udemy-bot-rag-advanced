import { performance } from 'node:perf_hooks';
import { RetrievalEvaluator } from '../core/contracts/crag-evaluator.contract';
import { CorrectiveRetrievalService } from './corrective/CorrectiveRetrievalService';
import { ContextFilterService } from './filtering/ContextFilterService';
import { CRAGRetryPolicy } from './retry/CRAGRetryPolicy';
import { CRAGResult, CRAGDecision, CRAGEvaluationResult } from '../core/models/crag.model';
import { RetrievedChunk, RetrievalResult } from '../retrieval/RetrievalResult';
import { logger } from '../shared/logger';
import { config } from '../config';

export interface CRAGProcessOptions {
  readonly query: string;
  readonly topK?: number | undefined;
  readonly filters?: Record<string, unknown> | undefined;
}

export class CRAGService {
  constructor(
    private readonly evaluator: RetrievalEvaluator,
    private readonly correctiveRetrievalService: CorrectiveRetrievalService,
    private readonly contextFilterService: ContextFilterService,
    private readonly retryPolicy: CRAGRetryPolicy
  ) {}

  public async process(
    initialRetrievalResult: RetrievalResult,
    options: CRAGProcessOptions
  ): Promise<CRAGResult> {
    const startTime = performance.now();
    const query = options.query;
    const initialTopK = options.topK ?? 10;
    const filters = options.filters;

    let currentChunks: RetrievedChunk[] = [...initialRetrievalResult.retrievedChunks];
    let currentTopK = initialTopK;
    let retryCount = 0;
    const correctiveActionsTaken: string[] = [];

    let evalResult: CRAGEvaluationResult = await this.evaluator.evaluate(query, currentChunks);
    logger.info(
      { decision: evalResult.decision, score: evalResult.score, averageSimilarity: evalResult.averageSimilarity },
      'Initial CRAG evaluation completed'
    );

    // Corrective Loop
    while (evalResult.decision === 'correct' && this.retryPolicy.canRetry(retryCount)) {
      logger.info({ retryCount, currentTopK }, 'CRAG triggering corrective retrieval loop');

      const outcome = await this.correctiveRetrievalService.executeCorrectiveRetrieval(query, {
        topK: currentTopK,
        attemptCount: retryCount,
        ...(filters !== undefined ? { filters } : {}),
      });

      correctiveActionsTaken.push(outcome.actionTaken);
      currentTopK = outcome.newTopK;
      currentChunks = outcome.retrievalResult.retrievedChunks;
      retryCount++;

      evalResult = await this.evaluator.evaluate(query, currentChunks);
      logger.info(
        { retryCount, decision: evalResult.decision, score: evalResult.score },
        'Re-evaluated corrective retrieval attempt'
      );
    }

    // Final decision resolution if still 'correct' after max retries
    let finalDecision: CRAGDecision = evalResult.decision;
    if (finalDecision === 'correct') {
      // Retries exhausted
      if (evalResult.averageSimilarity >= config.crag.minChunkConfidence && currentChunks.length > 0) {
        finalDecision = 'accept';
        logger.info('CRAG retries exhausted; accepting best available context meeting minimum confidence');
      } else {
        finalDecision = 'reject';
        logger.info('CRAG retries exhausted; rejecting context due to low confidence');
      }
    }

    // Filter context chunks
    const filteredResult = this.contextFilterService.filter(currentChunks);
    const retrievalLatencyMs = Math.round(performance.now() - startTime);

    const result: CRAGResult = {
      decision: finalDecision,
      chunks: finalDecision === 'reject' ? [] : filteredResult.chunks,
      citations: finalDecision === 'reject' ? [] : filteredResult.citations,
      metrics: {
        evaluationStrategy: config.crag.strategy,
        similarityScore: Math.round(evalResult.averageSimilarity * 1000) / 1000,
        confidenceScore: Math.round(evalResult.score * 1000) / 1000,
        retryCount,
        finalDecision,
        retrievalLatencyMs,
        documentsAccepted: finalDecision === 'reject' ? 0 : filteredResult.documentsAccepted,
        documentsDiscarded: filteredResult.documentsDiscarded,
        correctiveActionsTaken,
      },
    };

    logger.info(
      {
        finalDecision: result.decision,
        acceptedChunks: result.chunks.length,
        retryCount: result.metrics.retryCount,
        latencyMs: result.metrics.retrievalLatencyMs,
      },
      'CRAG processing completed'
    );

    return result;
  }
}
