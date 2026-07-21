import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when a semantic chunking operation fails.
 * Includes scenarios such as empty transcript, invalid transcript, chunk generation failure, or strategy failure.
 */
export class ChunkingError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'CHUNKING_ERROR',
      ...options,
    });
  }
}
