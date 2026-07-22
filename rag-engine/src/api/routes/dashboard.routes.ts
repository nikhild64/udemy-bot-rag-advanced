import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DashboardService } from '@/services/DashboardService';
import { requireAuth } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '@/shared/errors';

const dashboardService = new DashboardService();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard/summary', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const summary = await dashboardService.getDashboardSummary(userId);
    await reply.status(200).send(summary);
  });
}
