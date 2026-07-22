import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CleanupService } from '@/services/CleanupService';
import { requireAuth } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '@/shared/errors';

const cleanupService = new CleanupService();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function cleanupRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/cleanup', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const body = (request.body as {
      deleteFailedSources?: boolean;
      clearPendingUploads?: boolean;
      retryFailedJobs?: boolean;
    }) || {};

    const result = await cleanupService.runResourceCleanup(userId, body);
    await reply.status(200).send(result);
  });
}
