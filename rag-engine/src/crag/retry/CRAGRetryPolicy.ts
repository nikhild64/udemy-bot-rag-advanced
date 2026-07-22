import { logger } from '../../shared/logger';
import { config } from '../../config';

export interface RetryPolicyOptions {
  readonly maxRetries?: number;
  readonly retrievalLimitIncrement?: number;
  readonly maxRetrievalLimit?: number;
}

export class CRAGRetryPolicy {
  public readonly maxRetries: number;
  public readonly limitIncrement: number;
  public readonly maxRetrievalLimit: number;

  constructor(options?: RetryPolicyOptions) {
    this.maxRetries = options?.maxRetries ?? config.crag.maxRetries;
    this.limitIncrement = options?.retrievalLimitIncrement ?? config.crag.retrievalLimitIncrement;
    this.maxRetrievalLimit = options?.maxRetrievalLimit ?? config.crag.maxRetrievalLimit;
  }

  public canRetry(currentAttempt: number): boolean {
    const allowed = currentAttempt < this.maxRetries;
    if (!allowed) {
      logger.debug(
        { currentAttempt, maxRetries: this.maxRetries },
        'CRAGRetryPolicy: Maximum retry attempts reached'
      );
    }
    return allowed;
  }

  public calculateNextTopK(currentTopK: number): number {
    const nextTopK = Math.min(currentTopK + this.limitIncrement, this.maxRetrievalLimit);
    logger.debug(
      { currentTopK, limitIncrement: this.limitIncrement, maxRetrievalLimit: this.maxRetrievalLimit, nextTopK },
      'CRAGRetryPolicy: Calculated next topK'
    );
    return nextTopK;
  }
}
