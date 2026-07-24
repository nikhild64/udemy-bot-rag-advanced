import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { notebookChatRoutes } from './notebook-chat.routes';
import { globalErrorHandler } from '../middlewares/error.handler';

vi.mock('../middlewares/auth.middleware', () => ({
  requireAuth: vi.fn((req, _reply, done) => {
    (req as any).auth = { userId: 'user_test_123' };
    (req as any).userId = 'user_test_123';
    done();
  }),
}));

describe('Notebook Chat Routes', () => {
  let app: FastifyInstance;
  let mockNotebookChatOrchestrator: any;
  let mockMessageService: any;

  beforeEach(async () => {
    app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(globalErrorHandler);

    mockNotebookChatOrchestrator = {
      chat: vi.fn(),
      stream: vi.fn(),
    };

    mockMessageService = {
      getNotebookMessages: vi.fn(),
    };

    app.decorate('notebookChatOrchestrator', mockNotebookChatOrchestrator);
    app.decorate('messageService', mockMessageService);

    await app.register(notebookChatRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/notebooks/:notebookId/chat', () => {
    it('should return 200 and NotebookChatResponse for valid query', async () => {
      const mockResponse = {
        message: {
          id: 'msg_asst_1',
          notebookId: 'nb_123',
          role: 'ASSISTANT',
          content: 'Here is the answer.',
          citations: [],
          metadata: {},
          createdAt: new Date().toISOString(),
        },
        citations: [],
        retrievedChunks: [],
        metadata: {
          notebookId: 'nb_123',
          messageId: 'msg_asst_1',
          retrievalDurationMs: 12,
          completionDurationMs: 15,
          totalDurationMs: 27,
          promptCharacters: 150,
          citationCount: 0,
        },
      };

      mockNotebookChatOrchestrator.chat.mockResolvedValue(mockResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_123/chat',
        payload: {
          query: 'Explain machine learning',
          topK: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResponse);
      expect(mockNotebookChatOrchestrator.chat).toHaveBeenCalledWith({
        notebookId: 'nb_123',
        userId: 'user_test_123',
        query: 'Explain machine learning',
        topK: 5,
        filters: undefined,
        temperature: undefined,
        maxTokens: undefined,
        model: undefined,
      });
    });

    it('should return 400 when query is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_123/chat',
        payload: {
          query: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/notebooks/:notebookId/chat/stream', () => {
    it('should stream Server-Sent Events', async () => {
      mockNotebookChatOrchestrator.stream.mockImplementation(async function* () {
        yield { type: 'start' };
        yield { type: 'citation', data: { chunkId: 'c1', excerpt: 'text' } };
        yield { type: 'token', data: 'Hello ' };
        yield { type: 'token', data: 'world' };
        yield { type: 'done', data: { messageId: 'msg_1' } };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_123/chat/stream',
        payload: {
          query: 'Hello',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toContain('event: start');
      expect(response.body).toContain('event: citation');
      expect(response.body).toContain('event: token');
      expect(response.body).toContain('event: done');
    });
  });

  describe('GET /api/notebooks/:notebookId/messages', () => {
    it('should return historical messages for a notebook', async () => {
      const messages = [
        { id: 'm1', notebookId: 'nb_123', role: 'USER', content: 'Hi' },
        { id: 'm2', notebookId: 'nb_123', role: 'ASSISTANT', content: 'Hello' },
      ];
      mockMessageService.getNotebookMessages.mockResolvedValue(messages);

      const response = await app.inject({
        method: 'GET',
        url: '/api/notebooks/nb_123/messages?limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: messages });
      expect(mockMessageService.getNotebookMessages).toHaveBeenCalledWith(
        'nb_123',
        'user_test_123',
        10,
      );
    });
  });

  describe('DELETE /api/notebooks/:notebookId/messages/:messageId', () => {
    it('should delete specified message and all subsequent messages', async () => {
      mockMessageService.deleteMessageAndSubsequent = vi.fn().mockResolvedValue(3);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/notebooks/nb_123/messages/msg_target',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        deletedCount: 3,
        message: 'Deleted message and 2 subsequent messages',
      });
      expect(mockMessageService.deleteMessageAndSubsequent).toHaveBeenCalledWith(
        'msg_target',
        'nb_123',
        'user_test_123',
      );
    });
  });
});
