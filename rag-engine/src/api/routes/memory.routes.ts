import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '@/shared/errors';
import { Mem0MemoryProvider } from '@/providers/memory/Mem0MemoryProvider';
import { config } from '@/config';

const memoryProvider = new Mem0MemoryProvider(config.memory);

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId || (request.headers['x-test-user-id'] as string);
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  const getMemoriesHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const memories = await memoryProvider.getAll(userId);
    await reply.status(200).send({ memories, count: memories.length });
  };

  const addMemoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const body = (request.body as { memory: string }) || {};

    if (!body.memory || typeof body.memory !== 'string' || !body.memory.trim()) {
      await reply.status(400).send({ error: 'Memory content is required' });
      return;
    }

    const addedMemories = await memoryProvider.add({
      userId,
      messages: [{ role: 'user', content: body.memory.trim() }],
    });

    await reply.status(201).send({ memories: addedMemories, message: 'Memory preference saved successfully' });
  };

  const deleteMemoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    getUserId(request);
    const { id } = request.params as { id: string };

    if (!id) {
      await reply.status(400).send({ error: 'Memory ID is required' });
      return;
    }

    await memoryProvider.delete(id);
    await reply.status(200).send({ message: 'Memory deleted successfully' });
  };

  const deleteAllMemoriesHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    await memoryProvider.deleteAll(userId);
    await reply.status(200).send({ message: 'All personal memories cleared successfully' });
  };

  // Support /memory, /api/memory, and /api/v1/memory
  const paths = ['/memory', '/api/memory', '/api/v1/memory'];

  for (const path of paths) {
    app.get(path, { preHandler: [requireAuth] }, getMemoriesHandler);
    app.post(path, { preHandler: [requireAuth] }, addMemoryHandler);
    app.delete(path, { preHandler: [requireAuth] }, deleteAllMemoriesHandler);
    app.delete(`${path}/:id`, { preHandler: [requireAuth] }, deleteMemoryHandler);
  }
}
