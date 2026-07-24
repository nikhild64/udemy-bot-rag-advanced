import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../middlewares/admin.middleware';
import { PrismaSystemLogRepository } from '@/repositories/PrismaSystemLogRepository';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { listLogsQuerySchema, deleteLogsQuerySchema } from '../schemas/admin.schema';
import { UserRole } from '@prisma/client';

const systemLogRepository = new PrismaSystemLogRepository();
const userRepository = new PrismaUserRepository();

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Check admin status for current user
  app.get('/api/v1/admin/me', { preHandler: [requireAdmin] }, async (request, reply) => {
    const userId = request.auth?.userId;
    let user = userId ? await userRepository.findById(userId) : null;
    return reply.send({
      success: true,
      data: {
        userId,
        isAdmin: true,
        role: user?.role ?? UserRole.ADMIN,
      },
    });
  });

  // Get paginated system logs
  app.get('/api/v1/admin/logs', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parseResult = listLogsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { message: 'Invalid log query parameters', details: parseResult.error.format() },
      });
    }

    const result = await systemLogRepository.findMany(parseResult.data);
    return reply.send({
      success: true,
      ...result,
    });
  });

  // Get summary stats for system logs
  app.get('/api/v1/admin/logs/stats', { preHandler: [requireAdmin] }, async (_request, reply) => {
    const stats = await systemLogRepository.getStats();
    return reply.send({
      success: true,
      data: stats,
    });
  });

  // Delete all logs or prune old logs
  app.delete('/api/v1/admin/logs', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parseResult = deleteLogsQuerySchema.safeParse(request.query);
    const query = parseResult.success ? parseResult.data : {};

    let result: { count: number };
    if (query.olderThanDays) {
      result = await systemLogRepository.prune(query.olderThanDays);
    } else {
      // Default: delete all logs
      result = await systemLogRepository.deleteAll();
    }

    return reply.send({
      success: true,
      message: `Deleted ${result.count} log record(s)`,
      deletedCount: result.count,
    });
  });
}
