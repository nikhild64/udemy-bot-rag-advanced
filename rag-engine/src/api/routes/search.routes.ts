import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SearchService } from '@/services/SearchService';
import { requireAuth } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '@/shared/errors';

const searchService = new SearchService();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/search', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const { q } = request.query as { q?: string };
    const results = await searchService.searchUserWorkspace(userId, q || '');
    await reply.status(200).send(results);
  });
}
