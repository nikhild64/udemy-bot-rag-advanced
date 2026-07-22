import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { metrics } from '../../infrastructure/metrics/MetricsCollector';

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const currentMetrics = metrics.getMetrics();
    return reply.status(200).send(currentMetrics);
  });
}
