import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when an ingestion orchestration operation fails unexpectedly.
 */
export class IngestionError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'INGESTION_ERROR',
      ...options,
    });
  }
}
