import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';
import { chatRoutes } from './chat.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(chatRoutes);
}
