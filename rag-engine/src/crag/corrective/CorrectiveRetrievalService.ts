import { RetrievalService } from '../../retrieval/RetrievalService';
import { QueryTransformationStrategy } from '../../core/contracts/query-transformation-strategy.contract';
import { CRAGRetryPolicy } from '../retry/CRAGRetryPolicy';
import { RetrievalResult } from '../../retrieval/RetrievalResult';
import { logger } from '../../shared/logger';
import { config } from '../../config';

export interface CorrectiveRetrievalOptions {
  readonly topK: number;
  readonly attemptCount: number;
  readonly filters?: Record<string, unknown> | undefined;
  readonly correctiveStrategy?: string | undefined;
}

export interface CorrectiveRetrievalOutcome {
  readonly retrievalResult: RetrievalResult;
  readonly actionTaken: string;
  readonly newTopK: number;
}

export class CorrectiveRetrievalService {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly queryTransformationStrategy: QueryTransformationStrategy,
    private readonly retryPolicy: CRAGRetryPolicy
  ) {}

  public async executeCorrectiveRetrieval(
    query: string,
    options: CorrectiveRetrievalOptions
  ): Promise<CorrectiveRetrievalOutcome> {
    const { topK, attemptCount, filters } = options;
    const strategyMode = options.correctiveStrategy || config.crag.correctiveStrategy;
    const nextTopK = this.retryPolicy.calculateNextTopK(topK);

    let actionTaken: string;
    let retrievalResult: RetrievalResult;

    let activeStrategy = strategyMode;
    if (strategyMode === 'adaptive') {
      activeStrategy = attemptCount === 0 ? 'rewrite' : 'increase_limit';
    }

    logger.info(
      { query, attemptCount, activeStrategy, currentTopK: topK, nextTopK },
      'Executing corrective retrieval strategy'
    );

    switch (activeStrategy) {
      case 'rewrite':
      case 'stepback':
      case 'subquestion': {
        actionTaken = `Applied query transformation strategy '${activeStrategy}' with expanded topK (${nextTopK})`;
        const transformResult = await this.queryTransformationStrategy.transform(query);
        const searchQueries = transformResult.transformedQueries && transformResult.transformedQueries.length > 0
          ? transformResult.transformedQueries
          : [transformResult.transformedQuery || query];

        if (searchQueries.length > 1) {
          retrievalResult = await this.retrievalService.searchMulti(searchQueries, { topK: nextTopK, filters });
        } else {
          retrievalResult = await this.retrievalService.search({ query: searchQueries[0]!, topK: nextTopK, filters });
        }
        break;
      }

      case 'increase_limit':
      case 'relaxed_threshold':
      default: {
        actionTaken = `Increased retrieval topK limit from ${topK} to ${nextTopK}`;
        retrievalResult = await this.retrievalService.search({ query, topK: nextTopK, filters });
        break;
      }
    }

    logger.debug(
      { totalResults: retrievalResult.totalResults, actionTaken },
      'Corrective retrieval execution completed'
    );

    return {
      retrievalResult,
      actionTaken,
      newTopK: nextTopK,
    };
  }
}
