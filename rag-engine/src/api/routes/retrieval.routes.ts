import { FastifyInstance } from 'fastify';
import { retrieveNotebookContextController } from '../controllers/retrieval.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function retrievalRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/notebooks/:notebookId/retrieve',
    { preHandler: [requireAuth] },
    retrieveNotebookContextController,
  );
  app.post(
    '/api/v1/notebooks/:id/retrieve',
    { preHandler: [requireAuth] },
    retrieveNotebookContextController,
  );
}
