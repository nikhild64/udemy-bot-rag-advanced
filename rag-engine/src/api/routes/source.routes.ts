import { FastifyInstance } from 'fastify';
import {
  createSourceController,
  batchCreateSourcesController,
  listSourcesController,
  getSourceByIdController,
  updateSourceController,
  deleteSourceController,
  uploadSourceFileController,
  getSourceStatusController,
  reindexSourceController,
  retrySourceController,
  cancelSourceController,
  getSourceMetadataController,
  downloadSourceFileController,
  viewSourceController,
} from '../controllers/source.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/notebooks/:id/sources/batch', { preHandler: [requireAuth] }, batchCreateSourcesController);
  app.post('/api/notebooks/:id/sources', { preHandler: [requireAuth] }, createSourceController);
  app.get('/api/notebooks/:id/sources', { preHandler: [requireAuth] }, listSourcesController);
  app.get('/api/sources/:sourceId/status', { preHandler: [requireAuth] }, getSourceStatusController);
  app.get('/api/sources/:sourceId/view', { preHandler: [requireAuth] }, viewSourceController);
  app.get('/api/sources/:id', { preHandler: [requireAuth] }, getSourceByIdController);
  app.patch('/api/sources/:id', { preHandler: [requireAuth] }, updateSourceController);
  app.delete('/api/sources/:id', { preHandler: [requireAuth] }, deleteSourceController);
  app.post('/api/sources/:sourceId/upload', { preHandler: [requireAuth] }, uploadSourceFileController);
  app.post('/api/sources/:id/reindex', { preHandler: [requireAuth] }, reindexSourceController);
  app.post('/api/sources/:id/retry', { preHandler: [requireAuth] }, retrySourceController);
  app.post('/api/sources/:id/cancel', { preHandler: [requireAuth] }, cancelSourceController);
  app.get('/api/sources/:id/metadata', { preHandler: [requireAuth] }, getSourceMetadataController);
  app.get('/api/sources/:id/download', { preHandler: [requireAuth] }, downloadSourceFileController);
}

