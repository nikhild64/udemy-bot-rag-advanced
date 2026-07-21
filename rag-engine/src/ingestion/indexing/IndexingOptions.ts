import { IngestionContextOptions } from '../orchestrator/IngestionContext';

export interface IndexingOptions extends IngestionContextOptions {
  readonly batchSize?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
}
