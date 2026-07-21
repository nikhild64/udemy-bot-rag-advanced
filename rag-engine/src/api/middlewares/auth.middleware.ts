import { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.auth;

  if (!auth || !auth.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication token'
    });
  }
}
