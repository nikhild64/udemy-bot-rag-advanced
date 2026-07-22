import { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from '@clerk/fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId?: string;
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  let auth = (request as any).auth;
  if (!auth) {
    try {
      auth = getAuth(request);
    } catch {
      // clerkPlugin may not be registered in isolated unit test environments
    }
  }

  if (!auth || !auth.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication token'
    });
  }
}
