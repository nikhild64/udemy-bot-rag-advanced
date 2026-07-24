import { performance } from 'node:perf_hooks';
import { NotebookService } from '@/services/NotebookService';
import { QueryTransformationService } from '@/query/services/query-transformation.service';
import { QueryTransformationFactory } from '@/query/factory/query-transformation.factory';
import { RerankingService } from '@/reranking/RerankingService';
import { RerankerProviderFactory } from '@/reranking/RerankerProviderFactory';
import { CRAGEvaluatorFactory } from '@/crag/evaluators/CRAGEvaluatorFactory';
import { RetrievalImprover } from '@/crag/corrective/RetrievalImprover';
import { CRAGRetryPolicy } from '@/crag/retry/CRAGRetryPolicy';
import { RetrievalEvaluator } from '@/core/contracts/crag-evaluator.contract';
import { INotebookRetriever } from './INotebookRetriever';
import { DenseNotebookRetriever } from './DenseNotebookRetriever';
import { ContextBuilder } from './ContextBuilder';
import { CitationBuilder } from './CitationBuilder';
import {
  NotebookRetrievalOptions,
  NotebookRetrievalResult,
  NotebookRetrievedChunk,
} from './NotebookRetrievalResult';
import { logger } from '@/shared/logger';
import { AppError, ValidationError } from '@/shared/errors';
import { config } from '@/config';
import { metrics } from '@/infrastructure/metrics/MetricsCollector';
import { RetrievedChunk } from '@/retrieval/RetrievalResult';

export class RetrievalOrchestrator {
  private readonly notebookService: NotebookService;
  private readonly queryTransformationService: QueryTransformationService;
  private readonly retriever: INotebookRetriever;
  private readonly rerankingService: RerankingService;
  private readonly evaluator: RetrievalEvaluator;
  private readonly improver: RetrievalImprover;
  private readonly retryPolicy: CRAGRetryPolicy;

  constructor(
    notebookService?: NotebookService,
    queryTransformationService?: QueryTransformationService,
    retriever?: INotebookRetriever,
    rerankingService?: RerankingService,
    evaluator?: RetrievalEvaluator,
    improver?: RetrievalImprover,
    retryPolicy?: CRAGRetryPolicy,
  ) {
    this.notebookService = notebookService ?? new NotebookService();
    this.queryTransformationService =
      queryTransformationService ??
      new QueryTransformationService(QueryTransformationFactory.create());
    this.retriever = retriever ?? new DenseNotebookRetriever();
    this.rerankingService =
      rerankingService ?? new RerankingService(RerankerProviderFactory.create());
    this.evaluator = evaluator ?? CRAGEvaluatorFactory.create();
    this.improver = improver ?? new RetrievalImprover(this.retriever, this.queryTransformationService);
    this.retryPolicy = retryPolicy ?? new CRAGRetryPolicy();
  }

  public async retrieve(
    options: NotebookRetrievalOptions,
  ): Promise<NotebookRetrievalResult> {
    const totalStart = performance.now();

    // 1. Basic parameter validation
    if (!options.notebookId || typeof options.notebookId !== 'string') {
      throw new ValidationError('notebookId is required and must be a string');
    }
    if (!options.userId || typeof options.userId !== 'string') {
      throw new ValidationError('userId is required and must be a string');
    }
    if (!options.query || typeof options.query !== 'string' || options.query.trim().length === 0) {
      throw new ValidationError('query is required and must be a non-empty string');
    }

    const notebookId = options.notebookId;
    const userId = options.userId;
    const rawQuery = options.query.trim();

    logger.info(
      { context: 'RAG Engine', phase: 'orchestration-start', notebookId, userId, query: rawQuery },
      'Starting notebook retrieval orchestration',
    );

    // 2. Validate Notebook Security & Tenant Access
    await this.notebookService.getNotebook(notebookId, userId);

    // 3. Execute Initial Query Transformation (Phase 1)
    const startTransform = performance.now();
    let transformedQuery = rawQuery;
    try {
      const transformationResult = await this.queryTransformationService.transform(rawQuery);
      transformedQuery = transformationResult.transformedQuery || rawQuery;
    } catch (err) {
      logger.warn(
        { context: 'RAG Engine', phase: 'query-transformation', notebookId, err },
        'Query transformation failed, falling back to raw query',
      );
    }
    const transformationDurationMs = Math.round(performance.now() - startTransform);
    logger.info(
      {
        context: 'RAG Engine',
        phase: 'query-transformation',
        notebookId,
        rawQuery,
        transformedQuery,
        durationMs: transformationDurationMs,
      },
      `[Phase 1] Query Transformation Completed (${transformationDurationMs}ms)`,
    );

    // 4. Vector Retrieval (Phase 2)
    const startRetrieval = performance.now();
    let candidates: NotebookRetrievedChunk[] = [];
    try {
      candidates = await this.retriever.retrieve(transformedQuery, options);
    } catch (err) {
      logger.error(
        { context: 'RAG Engine', phase: 'vector-search', notebookId, err },
        'Retriever failed during notebook orchestration',
      );
      throw err instanceof AppError ? err : new AppError('Retrieval failed', { statusCode: 500, cause: err });
    }
    const retrievalDurationMs = Math.round(performance.now() - startRetrieval);
    logger.info(
      {
        context: 'RAG Engine',
        phase: 'vector-search',
        notebookId,
        resultsCount: candidates.length,
        durationMs: retrievalDurationMs,
      },
      `[Phase 2] Vector Search Completed (${candidates.length} chunks, ${retrievalDurationMs}ms)`,
    );

    // 5. Initial Reranking (Phase 3)
    const startRerank = performance.now();
    let rerankedChunks: NotebookRetrievedChunk[] = candidates;
    if (candidates.length > 0) {
      try {
        const rerankResult = await this.rerankingService.rerank(transformedQuery, candidates);
        rerankedChunks = Array.from(rerankResult.chunks) as NotebookRetrievedChunk[];
      } catch (err) {
        logger.warn(
          { context: 'RAG Engine', phase: 'reranking', notebookId, err },
          'Reranking failed, preserving vector search ordering',
        );
      }
    }
    const rerankDurationMs = Math.round(performance.now() - startRerank);
    logger.info(
      {
        context: 'RAG Engine',
        phase: 'reranking',
        notebookId,
        inputCount: candidates.length,
        outputCount: rerankedChunks.length,
        durationMs: rerankDurationMs,
      },
      `[Phase 3] Reranking Completed (${rerankedChunks.length} chunks, ${rerankDurationMs}ms)`,
    );

    // 6. CRAG Retrieval Evaluation & Corrective Retry Pipeline (Phase 4)
    let currentChunks = [...rerankedChunks];
    let retryCount = 0;
    const queryRewrites: string[] = [];
    let activeQuery = transformedQuery;
    let currentTopK = options.topK && options.topK > 0 ? options.topK : 5;
    let finalDecision: 'accept' | 'correct' | 'reject' = 'accept';
    let evalResult: any = { score: 1.0, decision: 'accept', averageSimilarity: 1.0 };

    if (config.crag.enabled) {
      const startEval = performance.now();
      evalResult = await this.evaluator.evaluate(activeQuery, currentChunks as unknown as RetrievedChunk[]);
      const evalDurationMs = Math.round(performance.now() - startEval);
      logger.info(
        {
          context: 'RAG Engine',
          phase: 'crag-evaluation',
          notebookId,
          decision: evalResult.decision,
          score: evalResult.score,
          durationMs: evalDurationMs,
        },
        `[Phase 4] CRAG Evaluation (${evalResult.decision}, score: ${evalResult.score}, ${evalDurationMs}ms)`,
      );

      while (evalResult.decision === 'correct' && this.retryPolicy.canRetry(retryCount)) {
        logger.info(
          { context: 'RAG Engine', phase: 'crag-corrective-loop', notebookId, retryCount, currentTopK, activeQuery },
          'CRAG triggering corrective retrieval loop',
        );

        const outcome = await this.improver.executeCorrectiveRetrieval({
          notebookId,
          userId,
          query: activeQuery,
          topK: currentTopK,
          attemptCount: retryCount,
          ...(options.filters !== undefined ? { filters: options.filters } : {}),
        });

        queryRewrites.push(outcome.rewrittenQuery);
        activeQuery = outcome.rewrittenQuery;
        currentTopK = outcome.newTopK;

        let newReranked: NotebookRetrievedChunk[] = outcome.chunks;
        if (outcome.chunks.length > 0) {
          try {
            const rerankRes = await this.rerankingService.rerank(outcome.rewrittenQuery, outcome.chunks);
            newReranked = Array.from(rerankRes.chunks) as NotebookRetrievedChunk[];
          } catch (err) {
            logger.warn({ context: 'RAG Engine', phase: 'crag-rerank', notebookId, err }, 'Corrective reranking failed');
          }
        }

        currentChunks = this.improver.mergeAndDeduplicateChunks(currentChunks, newReranked);
        retryCount++;

        evalResult = await this.evaluator.evaluate(activeQuery, currentChunks as unknown as RetrievedChunk[]);
        logger.info(
          {
            context: 'RAG Engine',
            phase: 'crag-re-evaluation',
            notebookId,
            retryCount,
            decision: evalResult.decision,
            score: evalResult.score,
          },
          'Re-evaluated corrective retrieval attempt',
        );
      }

      // Resolve final decision if retries exhausted
      finalDecision = evalResult.decision;
      if (finalDecision === 'correct') {
        if (evalResult.averageSimilarity >= config.crag.minChunkConfidence && currentChunks.length > 0) {
          finalDecision = 'accept';
          logger.info({ context: 'RAG Engine', phase: 'crag-decision', notebookId }, 'CRAG retries exhausted; accepting best available context');
        } else {
          finalDecision = 'reject';
          logger.info({ context: 'RAG Engine', phase: 'crag-decision', notebookId }, 'CRAG retries exhausted; rejecting context due to low confidence');
        }
      }
    } else {
      logger.info({ context: 'RAG Engine', phase: 'crag-status', notebookId }, 'CRAG pipeline disabled; accepting retrieved vector context directly');
    }

    // 7. Context Refinement & Token Trimming (Phase 5)
    const startContext = performance.now();
    const finalTopK = options.topK && options.topK > 0 ? options.topK : 5;
    let includedChunks: NotebookRetrievedChunk[] = [];
    let context = '';
    let citations: any[] = [];
    let rejectedChunkCount = 0;

    if (finalDecision === 'reject') {
      rejectedChunkCount = currentChunks.length;
      includedChunks = [];
      context = '';
      citations = [];
    } else {
      const minConfidence = config.crag.minChunkConfidence;
      const validChunks = currentChunks.filter((c) => (c.score || 0) >= minConfidence);
      rejectedChunkCount = currentChunks.length - validChunks.length;

      const topKChunks = validChunks.slice(0, finalTopK);
      const maxTokens = options.maxContextTokens ?? 4000;
      const built = ContextBuilder.buildContext(topKChunks, maxTokens);
      context = built.context;
      includedChunks = built.includedChunks;

      citations = CitationBuilder.buildCitations(includedChunks);
    }
    const contextDurationMs = Math.round(performance.now() - startContext);
    logger.info(
      {
        context: 'RAG Engine',
        phase: 'context-building',
        notebookId,
        inputChunksCount: currentChunks.length,
        includedChunksCount: includedChunks.length,
        contextLength: context.length,
        citationCount: citations.length,
        durationMs: contextDurationMs,
      },
      `[Phase 5] Context & Citation Building Completed (${includedChunks.length} chunks, ${citations.length} citations, ${contextDurationMs}ms)`,
    );

    const totalDurationMs = Math.round(performance.now() - totalStart);

    const confidenceScore = evalResult.confidenceScore ?? Math.round((evalResult.score || 0) * 1000) / 1000;
    const confidenceLabel =
      evalResult.confidenceLabel ??
      (confidenceScore >= 0.8
        ? `${confidenceScore.toFixed(2)} - High Confidence`
        : confidenceScore >= 0.5
          ? `${confidenceScore.toFixed(2)} - Medium Confidence`
          : `${confidenceScore.toFixed(2)} - Low Confidence`);

    metrics.recordCragEvaluation(finalDecision, confidenceScore, retryCount);

    logger.info(
      {
        context: 'RAG Engine',
        phase: 'retrieval-summary',
        notebookId,
        originalQuery: rawQuery,
        transformedQuery: activeQuery,
        candidateCount: candidates.length,
        finalChunkCount: includedChunks.length,
        citationCount: citations.length,
        confidenceScore,
        confidenceLabel,
        decision: finalDecision,
        retryCount,
        transformationDurationMs,
        retrievalDurationMs,
        rerankDurationMs,
        totalDurationMs,
      },
      `[RAG Summary] Retrieval Orchestration Completed (Total: ${totalDurationMs}ms | Vector: ${retrievalDurationMs}ms | Rerank: ${rerankDurationMs}ms)`,
    );

    const metadata = {
      notebookId,
      originalQuery: rawQuery,
      transformedQuery: activeQuery,
      retrievalDurationMs,
      rerankDurationMs,
      totalDurationMs,
      candidateCount: candidates.length,
      finalChunkCount: includedChunks.length,
      citationCount: citations.length,
      appliedFilters: options.filters ?? null,
      confidenceScore: Math.round(confidenceScore * 1000) / 1000,
      confidenceLabel,
      evaluationDecision: finalDecision,
      retryCount,
      queryRewrites,
      acceptedChunkCount: includedChunks.length,
      rejectedChunkCount,
    };

    logger.info(
      {
        notebookId,
        candidateCount: candidates.length,
        finalChunkCount: includedChunks.length,
        citationCount: citations.length,
        confidenceScore: metadata.confidenceScore,
        confidenceLabel: metadata.confidenceLabel,
        decision: finalDecision,
        retryCount,
        retrievalDurationMs,
        rerankDurationMs,
        totalDurationMs,
      },
      'Notebook retrieval orchestration completed successfully',
    );

    return {
      context,
      chunks: includedChunks,
      citations,
      confidenceScore: metadata.confidenceScore,
      confidenceLabel: metadata.confidenceLabel,
      metadata,
    };
  }
}
