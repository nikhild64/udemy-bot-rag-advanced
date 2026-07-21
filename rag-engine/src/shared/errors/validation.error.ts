import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      ...options,
    });
  }
}
