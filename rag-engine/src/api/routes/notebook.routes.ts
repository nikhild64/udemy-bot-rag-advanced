import { FastifyInstance } from 'fastify';
import {
  createNotebookController,
  listNotebooksController,
  getNotebookByIdController,
  updateNotebookController,
  deleteNotebookController,
  duplicateNotebookController,
  archiveNotebookController,
  restoreNotebookController,
  favoriteNotebookController,
  touchLastOpenedController,
  getRecentNotebooksController,
} from '../controllers/notebook.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function notebookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/notebooks', { preHandler: [requireAuth] }, createNotebookController);
  app.get('/api/notebooks', { preHandler: [requireAuth] }, listNotebooksController);
  app.get('/api/notebooks/recent', { preHandler: [requireAuth] }, getRecentNotebooksController);
  app.get('/api/notebooks/:id', { preHandler: [requireAuth] }, getNotebookByIdController);
  app.patch('/api/notebooks/:id', { preHandler: [requireAuth] }, updateNotebookController);
  app.delete('/api/notebooks/:id', { preHandler: [requireAuth] }, deleteNotebookController);
  app.post('/api/notebooks/:id/duplicate', { preHandler: [requireAuth] }, duplicateNotebookController);
  app.post('/api/notebooks/:id/archive', { preHandler: [requireAuth] }, archiveNotebookController);
  app.post('/api/notebooks/:id/restore', { preHandler: [requireAuth] }, restoreNotebookController);
  app.post('/api/notebooks/:id/favorite', { preHandler: [requireAuth] }, favoriteNotebookController);
  app.post('/api/notebooks/:id/touch', { preHandler: [requireAuth] }, touchLastOpenedController);
}
