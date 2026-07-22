import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import { metrics } from '../../infrastructure/metrics/MetricsCollector';
import { logger } from '../../shared/logger';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    startTime: number;
  }
}

export const requestLoggerPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  app.addHook('onRequest', async (request, reply) => {
    const headerRequestId = request.headers['x-request-id'];
    const requestId =
      typeof headerRequestId === 'string' && headerRequestId.length > 0
        ? headerRequestId
        : randomUUID();

    request.requestId = requestId;
    request.startTime = Date.now();

    reply.header('x-request-id', requestId);
  });

  app.addHook('onResponse', async (request, reply) => {
    const latency = Date.now() - (request.startTime || Date.now());
    const route = request.routeOptions?.url || request.url;
    const statusCode = reply.statusCode;

    // Record API metrics
    metrics.recordApiRequest(route, statusCode, latency);

    // Emit structured log
    logger.info(
      {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        route,
        statusCode,
        latencyMs: latency,
        userId: (request as unknown as { auth?: { userId?: string } }).auth?.userId || null,
      },
      `API ${request.method} ${request.url} ${statusCode} - ${latency}ms`,
    );
  });
});
