import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
}
