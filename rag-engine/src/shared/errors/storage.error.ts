import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when cloud storage operations fail.
 */
export class StorageError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'STORAGE_ERROR',
      ...options,
    });
  }
}
