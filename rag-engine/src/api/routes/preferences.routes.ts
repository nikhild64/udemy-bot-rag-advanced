import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UserPreferenceService } from '@/services/UserPreferenceService';
import { requireAuth } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '@/shared/errors';

const preferenceService = new UserPreferenceService();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function preferenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/user/preferences', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const pref = await preferenceService.getUserPreferences(userId);
    await reply.status(200).send(pref);
  });

  app.put('/api/user/preferences', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const body = (request.body as Record<string, any>) || {};
    const updated = await preferenceService.updateUserPreferences(userId, body);
    await reply.status(200).send(updated);
  });
}
