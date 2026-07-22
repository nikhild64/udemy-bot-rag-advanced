import { AppError, AppErrorOptions } from './app.error';

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', options: AppErrorOptions = {}) {
    super(message, { ...options, statusCode: options.statusCode ?? 401, code: options.code ?? 'UNAUTHORIZED' });
  }
}
