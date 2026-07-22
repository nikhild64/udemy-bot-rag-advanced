import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when a source loading operation fails.
 */
export class SourceLoaderError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'SOURCE_LOADER_ERROR',
      ...options,
    });
  }
}
