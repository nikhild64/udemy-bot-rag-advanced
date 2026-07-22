import { performance } from 'node:perf_hooks';
import { NotebookService } from '@/services/NotebookService';
import { QueryTransformationService } from '@/query/services/query-transformation.service';
import { QueryTransformationFactory } from '@/query/factory/query-transformation.factory';
import { RerankingService } from '@/reranking/RerankingService';
import { RerankerProviderFactory } from '@/reranking/RerankerProviderFactory';
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

export class RetrievalOrchestrator {
  private readonly notebookService: NotebookService;
  private readonly queryTransformationService: QueryTransformationService;
  private readonly retriever: INotebookRetriever;
  private readonly rerankingService: RerankingService;

  constructor(
    notebookService?: NotebookService,
    queryTransformationService?: QueryTransformationService,
    retriever?: INotebookRetriever,
    rerankingService?: RerankingService,
  ) {
    this.notebookService = notebookService ?? new NotebookService();
    this.queryTransformationService =
      queryTransformationService ??
      new QueryTransformationService(QueryTransformationFactory.create());
    this.retriever = retriever ?? new DenseNotebookRetriever();
    this.rerankingService =
      rerankingService ?? new RerankingService(RerankerProviderFactory.create());
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

    logger.info({ notebookId, userId, query: rawQuery }, 'Starting notebook retrieval orchestration');

    // 2. Validate Notebook Security & Tenant Access
    await this.notebookService.getNotebook(notebookId, userId);

    // 3. Execute Query Transformation
    let transformedQuery = rawQuery;
    try {
      const transformationResult = await this.queryTransformationService.transform(rawQuery);
      transformedQuery = transformationResult.transformedQuery || rawQuery;
    } catch (err) {
      logger.warn({ notebookId, err }, 'Query transformation failed, falling back to raw query');
    }

    // 4. Vector Retrieval (Tenant Isolated)
    const startRetrieval = performance.now();
    let candidates: NotebookRetrievedChunk[] = [];
    try {
      candidates = await this.retriever.retrieve(transformedQuery, options);
    } catch (err) {
      logger.error({ notebookId, err }, 'Retriever failed during notebook orchestration');
      throw err instanceof AppError ? err : new AppError('Retrieval failed', { statusCode: 500, cause: err });
    }
    const retrievalDurationMs = Math.round(performance.now() - startRetrieval);

    // 5. Reranking
    const startRerank = performance.now();
    let rerankedChunks: NotebookRetrievedChunk[] = candidates;
    if (candidates.length > 0) {
      try {
        const rerankResult = await this.rerankingService.rerank(transformedQuery, candidates);
        rerankedChunks = Array.from(rerankResult.chunks) as NotebookRetrievedChunk[];
      } catch (err) {
        logger.warn({ notebookId, err }, 'Reranking failed, preserving vector search ordering');
      }
    }
    const rerankDurationMs = Math.round(performance.now() - startRerank);

    // TopK trimming
    const topK = options.topK && options.topK > 0 ? options.topK : 5;
    const topKChunks = rerankedChunks.slice(0, topK);

    // 6. Context Building
    const maxTokens = options.maxContextTokens ?? 4000;
    const { context, includedChunks } = ContextBuilder.buildContext(topKChunks, maxTokens);

    // 7. Citation Generation
    const citations = CitationBuilder.buildCitations(includedChunks);

    const totalDurationMs = Math.round(performance.now() - totalStart);

    const metadata = {
      notebookId,
      originalQuery: rawQuery,
      transformedQuery,
      retrievalDurationMs,
      rerankDurationMs,
      totalDurationMs,
      candidateCount: candidates.length,
      finalChunkCount: includedChunks.length,
      citationCount: citations.length,
      appliedFilters: options.filters ?? null,
    };

    logger.info(
      {
        notebookId,
        candidateCount: candidates.length,
        finalChunkCount: includedChunks.length,
        citationCount: citations.length,
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
      metadata,
    };
  }
}
