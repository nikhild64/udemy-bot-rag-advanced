import { AppError, AppErrorOptions } from './app.error';

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', options: AppErrorOptions = {}) {
    super(message, { ...options, statusCode: options.statusCode ?? 403, code: options.code ?? 'FORBIDDEN' });
  }
}
