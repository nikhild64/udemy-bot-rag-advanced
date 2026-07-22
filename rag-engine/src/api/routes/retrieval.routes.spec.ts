import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { retrievalRoutes } from './retrieval.routes';
import { globalErrorHandler } from '../middlewares/error.handler';

vi.mock('../middlewares/auth.middleware', () => ({
  requireAuth: vi.fn((req, _reply, done) => {
    (req as any).auth = { userId: 'user_test_123' };
    (req as any).userId = 'user_test_123';
    done();
  }),
}));

describe('Retrieval Routes', () => {
  let app: FastifyInstance;
  let mockRetrievalOrchestrator: any;

  beforeEach(async () => {
    app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(globalErrorHandler);

    mockRetrievalOrchestrator = {
      retrieve: vi.fn(),
    };

    app.decorate('retrievalOrchestrator', mockRetrievalOrchestrator);

    await app.register(retrievalRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/notebooks/:notebookId/retrieve', () => {
    it('should return 200 and RetrievalResult for valid request', async () => {
      const mockResult = {
        context: 'Formatted context text',
        chunks: [],
        citations: [],
        metadata: {
          notebookId: 'nb_999',
          originalQuery: 'What is vector search?',
          transformedQuery: 'What is vector search?',
          retrievalDurationMs: 15,
          rerankDurationMs: 10,
          totalDurationMs: 30,
          candidateCount: 1,
          finalChunkCount: 1,
          citationCount: 0,
          appliedFilters: null,
        },
      };

      mockRetrievalOrchestrator.retrieve.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_999/retrieve',
        payload: {
          query: 'What is vector search?',
          topK: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResult);
      expect(mockRetrievalOrchestrator.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          notebookId: 'nb_999',
          userId: 'user_test_123',
          query: 'What is vector search?',
          topK: 5,
        }),
      );
    });

    it('should return 400 when query is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_999/retrieve',
        payload: {
          query: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
