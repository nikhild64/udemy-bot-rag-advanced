/**
 * Options for constructing an AppError instance.
 */
export interface AppErrorOptions {
  readonly cause?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly statusCode?: number;
  readonly code?: string;
}

/**
 * Base custom error class for the application.
 * All custom domain, provider, and operational errors must extend this class.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'APP_ERROR';
    if (options.metadata) {
      this.metadata = options.metadata;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
