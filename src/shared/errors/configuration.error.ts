import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when configuration loading or validation fails.
 */
export class ConfigurationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'CONFIGURATION_ERROR',
      ...options,
    });
  }
}
