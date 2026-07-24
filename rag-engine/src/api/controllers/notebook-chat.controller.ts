import { FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'stream';
import { NotebookChatOrchestrator } from '@/chat/notebook/NotebookChatOrchestrator';
import { NotebookChatOptions } from '@/chat/notebook/types';
import { MessageService } from '@/services/MessageService';
import { notebookChatBodySchema } from '../schemas/notebook-chat.schema';
import { UnauthorizedError, ValidationError } from '@/shared/errors';

export async function postNotebookChatController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, id } = request.params as { notebookId?: string; id?: string };
  const targetNotebookId = notebookId || id;
  if (!targetNotebookId) {
    throw new ValidationError('Notebook ID is required');
  }

  const body = notebookChatBodySchema.parse(request.body);

  const orchestrator: NotebookChatOrchestrator =
    request.server.notebookChatOrchestrator || new NotebookChatOrchestrator();

  const chatOptions: NotebookChatOptions = {
    notebookId: targetNotebookId,
    userId,
    query: body.query,
    ...(body.topK !== undefined ? { topK: body.topK } : {}),
    ...(body.filters !== undefined ? { filters: body.filters } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
  };

  const response = await orchestrator.chat(chatOptions);

  await reply.status(200).send(response);
}

export async function postNotebookChatStreamController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, id } = request.params as { notebookId?: string; id?: string };
  const targetNotebookId = notebookId || id;
  if (!targetNotebookId) {
    throw new ValidationError('Notebook ID is required');
  }

  const body = notebookChatBodySchema.parse(request.body);

  const orchestrator: NotebookChatOrchestrator =
    request.server.notebookChatOrchestrator || new NotebookChatOrchestrator();

  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');

  const streamOptions: NotebookChatOptions = {
    notebookId: targetNotebookId,
    userId,
    query: body.query,
    ...(body.topK !== undefined ? { topK: body.topK } : {}),
    ...(body.filters !== undefined ? { filters: body.filters } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
  };

  async function* sseGenerator() {
    try {
      const stream = orchestrator.stream(streamOptions);

      for await (const event of stream) {
        let dataStr = '';
        if (event.type === 'token') {
          dataStr = JSON.stringify({ content: event.data });
        } else if (event.type === 'citation' || event.type === 'done' || event.type === 'error') {
          dataStr = JSON.stringify(event.data || {});
        }

        let sseEvent = `event: ${event.type}\n`;
        if (dataStr) {
          sseEvent += `data: ${dataStr}\n`;
        }
        sseEvent += '\n';

        yield sseEvent;

        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }
    } catch (err) {
      const errorData = JSON.stringify({ message: err instanceof Error ? err.message : 'Streaming failed' });
      yield `event: error\ndata: ${errorData}\n\n`;
    }
  }

  return reply.send(Readable.from(sseGenerator()));
}

export async function getNotebookMessagesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, id } = request.params as { notebookId?: string; id?: string };
  const targetNotebookId = notebookId || id;
  if (!targetNotebookId) {
    throw new ValidationError('Notebook ID is required');
  }

  const query = request.query as { limit?: string };
  const limit = query.limit ? parseInt(query.limit, 10) : 50;

  const messageService: MessageService =
    request.server.messageService || new MessageService();

  const messages = await messageService.getNotebookMessages(targetNotebookId, userId, limit);

  await reply.status(200).send({ data: messages });
}

export async function deleteNotebookMessageController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, messageId, id } = request.params as { notebookId?: string; messageId?: string; id?: string };
  const targetNotebookId = notebookId || id;
  if (!targetNotebookId || !messageId) {
    throw new ValidationError('Notebook ID and Message ID are required');
  }

  const messageService: MessageService =
    request.server.messageService || new MessageService();

  const deletedCount = await messageService.deleteMessageAndSubsequent(messageId, targetNotebookId, userId);

  await reply.status(200).send({
    success: true,
    deletedCount,
    message: `Deleted message and ${Math.max(0, deletedCount - 1)} subsequent messages`,
  });
}

export async function getSuggestedQuestionsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, id } = request.params as { notebookId?: string; id?: string };
  const targetNotebookId = notebookId || id;
  if (!targetNotebookId) {
    throw new ValidationError('Notebook ID is required');
  }

  const orchestrator: NotebookChatOrchestrator =
    request.server.notebookChatOrchestrator || new NotebookChatOrchestrator();

  const questions = await orchestrator.generateSuggestedQuestions(targetNotebookId, userId);

  await reply.status(200).send({ questions });
}
