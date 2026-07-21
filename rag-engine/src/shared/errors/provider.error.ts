import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when an external provider operation fails.
 */
export class ProviderError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 502,
      code: 'PROVIDER_ERROR',
      ...options,
    });
  }
}
