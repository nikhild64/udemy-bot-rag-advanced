import { FastifyReply, FastifyRequest } from 'fastify';
import { NotebookService } from '@/services/NotebookService';
import { createNotebookSchema, updateNotebookSchema, listNotebooksQuerySchema } from '../schemas/notebook.schema';
import { UnauthorizedError } from '@/shared/errors';

const notebookService = new NotebookService();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function createNotebookController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const body = createNotebookSchema.parse(request.body);

  const notebook = await notebookService.createNotebook(
    userId,
    body.title,
    body.description ?? undefined,
    body.settings ?? undefined,
  );

  await reply.status(201).send(notebook);
}

export async function listNotebooksController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const query = listNotebooksQuerySchema.parse(request.query);

  const result = await notebookService.listUserNotebooks(userId, query);

  await reply.status(200).send(result);
}

export async function getNotebookByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };

  const notebook = await notebookService.getNotebook(id, userId);

  await reply.status(200).send(notebook);
}

export async function updateNotebookController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };
  const body = updateNotebookSchema.parse(request.body);

  const notebook = await notebookService.updateNotebook(id, userId, body);

  await reply.status(200).send(notebook);
}

export async function deleteNotebookController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };

  await notebookService.deleteNotebook(id, userId);

  await reply.status(200).send({ success: true, message: 'Notebook deleted successfully' });
}
