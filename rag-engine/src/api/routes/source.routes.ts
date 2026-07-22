import { FastifyInstance } from 'fastify';
import {
  createSourceController,
  listSourcesController,
  getSourceByIdController,
  updateSourceController,
  deleteSourceController,
} from '../controllers/source.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/notebooks/:id/sources', { preHandler: [requireAuth] }, createSourceController);
  app.get('/api/notebooks/:id/sources', { preHandler: [requireAuth] }, listSourcesController);
  app.get('/api/sources/:id', { preHandler: [requireAuth] }, getSourceByIdController);
  app.patch('/api/sources/:id', { preHandler: [requireAuth] }, updateSourceController);
  app.delete('/api/sources/:id', { preHandler: [requireAuth] }, deleteSourceController);
}
