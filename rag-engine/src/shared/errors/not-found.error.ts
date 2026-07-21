import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when a requested domain entity or resource is not found.
 */
export class NotFoundError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND_ERROR',
      ...options,
    });
  }
}
