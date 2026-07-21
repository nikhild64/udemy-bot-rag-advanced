import { AppError, AppErrorOptions } from './app.error';

/**
 * Error thrown when a transcript parsing operation fails.
 * Includes scenarios such as unsupported format, invalid timestamp, corrupt transcript, empty transcript, and empty cue detection.
 */
export class ParsingError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      statusCode: 500,
      code: 'PARSING_ERROR',
      ...options,
    });
  }
}
