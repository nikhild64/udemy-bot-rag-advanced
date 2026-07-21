import { FastifyInstance } from 'fastify';
import { getHealthStatus, getReadyStatus } from '../controllers/health.controller';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', getHealthStatus);
  app.get('/ready', getReadyStatus);
}
