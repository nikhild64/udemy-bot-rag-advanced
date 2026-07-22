import { FastifyInstance } from 'fastify';
import {
  createNotebookController,
  listNotebooksController,
  getNotebookByIdController,
  updateNotebookController,
  deleteNotebookController,
} from '../controllers/notebook.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function notebookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/notebooks', { preHandler: [requireAuth] }, createNotebookController);
  app.get('/api/notebooks', { preHandler: [requireAuth] }, listNotebooksController);
  app.get('/api/notebooks/:id', { preHandler: [requireAuth] }, getNotebookByIdController);
  app.patch('/api/notebooks/:id', { preHandler: [requireAuth] }, updateNotebookController);
  app.delete('/api/notebooks/:id', { preHandler: [requireAuth] }, deleteNotebookController);
}
