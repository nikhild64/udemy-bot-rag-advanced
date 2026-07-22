import { INotebookRetriever } from '../../retrieval/notebook/INotebookRetriever';
import { QueryTransformationService } from '../../query/services/query-transformation.service';
import { QueryTransformationFactory } from '../../query/factory/query-transformation.factory';
import { CRAGRetryPolicy } from '../retry/CRAGRetryPolicy';
import { NotebookRetrievedChunk, NotebookRetrievalOptions } from '../../retrieval/notebook/NotebookRetrievalResult';
import { logger } from '../../shared/logger';

export interface RetrievalImproverOptions {
  readonly notebookId: string;
  readonly userId: string;
  readonly query: string;
  readonly topK?: number | undefined;
  readonly filters?: Record<string, unknown> | undefined;
  readonly attemptCount: number;
}

export interface RetrievalImproverResult {
  readonly chunks: NotebookRetrievedChunk[];
  readonly actionTaken: string;
  readonly rewrittenQuery: string;
  readonly newTopK: number;
}

export class RetrievalImprover {
  private readonly queryTransformationService: QueryTransformationService;
  private readonly retryPolicy: CRAGRetryPolicy;

  constructor(
    private readonly retriever: INotebookRetriever,
    queryTransformationService?: QueryTransformationService,
    retryPolicy?: CRAGRetryPolicy
  ) {
    this.queryTransformationService =
      queryTransformationService ??
      new QueryTransformationService(QueryTransformationFactory.create());
    this.retryPolicy = retryPolicy ?? new CRAGRetryPolicy();
  }

  public async executeCorrectiveRetrieval(
    options: RetrievalImproverOptions
  ): Promise<RetrievalImproverResult> {
    const { notebookId, userId, query, attemptCount, filters } = options;
    const currentTopK = options.topK ?? 10;
    const nextTopK = this.retryPolicy.calculateNextTopK(currentTopK);

    logger.info(
      { notebookId, userId, query, attemptCount, currentTopK, nextTopK },
      'RetrievalImprover: Starting corrective retrieval iteration'
    );

    // 1. Intelligent Query Rewriting via Query Transformation Framework
    let rewrittenQuery = query;
    let actionTaken = `Rewrote query using transformation strategy and expanded topK limit to ${nextTopK}`;
    try {
      const transformRes = await this.queryTransformationService.transform(query);
      rewrittenQuery = transformRes.transformedQuery || query;
    } catch (err) {
      logger.warn({ notebookId, err }, 'Query rewriting during corrective retrieval failed, retaining active query');
    }

    // 2. Re-execute Vector Retrieval with STRICT Notebook Isolation
    const retrievalOptions: NotebookRetrievalOptions = {
      notebookId,
      userId,
      query: rewrittenQuery,
      topK: nextTopK,
      ...(filters !== undefined ? { filters } : {}),
    };

    let newCandidates: NotebookRetrievedChunk[] = [];
    try {
      newCandidates = await this.retriever.retrieve(rewrittenQuery, retrievalOptions);
      logger.debug(
        { notebookId, count: newCandidates.length, rewrittenQuery },
        'RetrievalImprover: Retrieved candidates with notebook isolation'
      );
    } catch (err) {
      logger.error({ notebookId, err }, 'RetrievalImprover: Retry retrieval attempt failed');
    }

    return {
      chunks: newCandidates,
      actionTaken,
      rewrittenQuery,
      newTopK: nextTopK,
    };
  }

  public mergeAndDeduplicateChunks(
    existingChunks: NotebookRetrievedChunk[],
    newChunks: NotebookRetrievedChunk[]
  ): NotebookRetrievedChunk[] {
    const seenIds = new Set<string>();
    const seenTexts = new Set<string>();
    const merged: NotebookRetrievedChunk[] = [];

    const allCandidates = [...existingChunks, ...newChunks];

    for (const chunk of allCandidates) {
      if (chunk.chunkId && seenIds.has(chunk.chunkId)) {
        continue;
      }
      const normalizedText = (chunk.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenTexts.has(normalizedText)) {
        continue;
      }

      if (chunk.chunkId) seenIds.add(chunk.chunkId);
      if (normalizedText) seenTexts.add(normalizedText);
      merged.push(chunk);
    }

    // Sort merged chunks descending by score
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));

    logger.debug(
      { initialCount: existingChunks.length, newCount: newChunks.length, mergedCount: merged.length },
      'RetrievalImprover: Merged and deduplicated candidate chunks'
    );

    return merged;
  }
}
