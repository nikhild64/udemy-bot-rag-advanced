import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';
import { chatRoutes } from './chat.routes';
import { notebookRoutes } from './notebook.routes';
import { sourceRoutes } from './source.routes';
import { retrievalRoutes } from './retrieval.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(chatRoutes);
  await app.register(notebookRoutes);
  await app.register(sourceRoutes);
  await app.register(retrievalRoutes);
}

