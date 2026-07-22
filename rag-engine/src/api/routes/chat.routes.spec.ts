import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { chatRoutes } from './chat.routes';
import { globalErrorHandler } from '../middlewares/error.handler';
import { InputGuardError } from '../../shared/errors';

vi.mock('../middlewares/auth.middleware', () => ({
  requireAuth: vi.fn((_req, _reply, done) => done()),
}));

describe('Chat Routes', () => {
  let app: FastifyInstance;
  let mockChatPipelineService: any;

  beforeEach(async () => {
    app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(globalErrorHandler);

    mockChatPipelineService = {
      chat: vi.fn(),
    };

    app.decorate('chatPipelineService', mockChatPipelineService);

    await app.register(chatRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /chat', () => {
    it('should return 200 and the response for a valid query', async () => {
      const mockResponse = {
        answer: 'This is the answer',
        citations: [],
        retrievedChunks: [],
        metadata: {
          totalDurationMs: 100,
        },
      };

      mockChatPipelineService.chat.mockResolvedValue(mockResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
          query: 'Explain Angular Signals',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResponse);
      expect(mockChatPipelineService.chat).toHaveBeenCalledWith({
        query: 'Explain Angular Signals',
      });
    });

    it('should return 400 when query is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
          query: '',
        },
      });

      console.log('400 response:', response.statusCode, response.json());

      expect(response.statusCode).toBe(400);
      // FST_ERR_VALIDATION mapped to 400
      expect(response.json().success).toBe(false);
    });

    it('should return 400 when query is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
          topK: 5,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 on Guardrail rejection', async () => {
      mockChatPipelineService.chat.mockRejectedValue(
        new InputGuardError('Blocked by guardrail', 'TestGuard')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
          query: 'Drop all tables',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().success).toBe(false);
      expect(response.json().error.message).toBe('Blocked by guardrail');
    });

    it('should return 500 on unexpected internal server error', async () => {
      mockChatPipelineService.chat.mockRejectedValue(new Error('Unexpected error'));

      const response = await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
          query: 'Explain Angular Signals',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().success).toBe(false);
    });
  });
});
