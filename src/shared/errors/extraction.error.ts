import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when an archive extraction operation fails.
 */
export class ExtractionError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'EXTRACTION_ERROR',
      ...options,
    });
  }
}
