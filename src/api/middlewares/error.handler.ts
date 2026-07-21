import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config';
import { logger } from '../../shared';

export interface ErrorResponse {
  readonly success: boolean;
  readonly error: {
    readonly message: string;
    readonly stack?: string;
  };
}

export function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  const isServerException = statusCode >= 500;

  if (isServerException) {
    logger.error(
      {
        err: error,
        url: request.url,
        method: request.method,
      },
      'Unexpected server error occurred',
    );
  } else {
    logger.warn(
      {
        err: error,
        url: request.url,
        method: request.method,
        statusCode,
      },
      'Client error handled',
    );
  }

  const isProduction = config.app.env === 'production';
  const message =
    isServerException && isProduction
      ? 'Internal Server Error'
      : error.message || 'Internal Server Error';

  const responsePayload: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(isProduction ? {} : { stack: error.stack }),
    },
  };

  void reply.status(statusCode).send(responsePayload);
}
