import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';
import { chatRoutes } from './chat.routes';
import { notebookRoutes } from './notebook.routes';
import { sourceRoutes } from './source.routes';
import { retrievalRoutes } from './retrieval.routes';
import { notebookChatRoutes } from './notebook-chat.routes';
import { metricsRoutes } from './metrics.routes';
import { searchRoutes } from './search.routes';
import { dashboardRoutes } from './dashboard.routes';
import { preferenceRoutes } from './preferences.routes';
import { cleanupRoutes } from './cleanup.routes';
import { youtubeRoutes } from './youtube.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(chatRoutes);
  await app.register(notebookRoutes);
  await app.register(youtubeRoutes); // Register before sourceRoutes to avoid :id conflict
  await app.register(sourceRoutes);
  await app.register(retrievalRoutes);
  await app.register(notebookChatRoutes);
  await app.register(searchRoutes);
  await app.register(dashboardRoutes);
  await app.register(preferenceRoutes);
  await app.register(cleanupRoutes);
}
