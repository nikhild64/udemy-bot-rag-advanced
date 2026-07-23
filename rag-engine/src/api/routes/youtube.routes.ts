import { FastifyInstance } from 'fastify';
import { getYouTubeMetadataController } from '../controllers/youtube.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function youtubeRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/sources/youtube/metadata',
    { preHandler: [requireAuth] },
    getYouTubeMetadataController,
  );
}
