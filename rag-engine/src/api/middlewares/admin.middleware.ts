import { FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from './auth.middleware';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { UserRole } from '@prisma/client';

const userRepository = new PrismaUserRepository();

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // Ensure user is authenticated first
  const authResponse = await requireAuth(request, reply);
  if (reply.sent) return authResponse;

  const userId = request.auth?.userId;
  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User authentication required',
    });
  }

  // Check admin env overrides (comma separated IDs or emails)
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) {
    return; // Granted via env override
  }

  // Check Database user role
  const user = await userRepository.findById(userId);
  if (user && user.role === UserRole.ADMIN) {
    return; // Granted via DB role
  }

  return reply.status(403).send({
    error: 'Forbidden',
    message: 'Admin access privileges required to perform this action',
  });
}
