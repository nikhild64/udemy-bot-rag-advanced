import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { notebookRoutes } from '@/api/routes/notebook.routes';
import { globalErrorHandler } from '@/api/middlewares/error.handler';
import { NotebookService } from '@/services/NotebookService';

vi.mock('@/services/NotebookService');

describe('Notebook Routes', () => {
  let app: FastifyInstance;
  let mockNotebookService: any;

  beforeEach(async () => {
    app = fastify();
    app.setErrorHandler(globalErrorHandler);

    // Mock auth middleware by injecting request.auth
    app.addHook('onRequest', async (req) => {
      req.auth = { userId: 'user_123' };
    });

    await app.register(notebookRoutes);

    mockNotebookService = vi.mocked(NotebookService).prototype;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/notebooks', () => {
    it('should create a notebook for authenticated user', async () => {
      const mockNotebook = {
        id: 'nb_1',
        title: 'AI Research',
        description: 'Notes on AI',
        userId: 'user_123',
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockNotebookService.createNotebook.mockResolvedValue(mockNotebook as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks',
        payload: {
          title: 'AI Research',
          description: 'Notes on AI',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(mockNotebook);
      expect(mockNotebookService.createNotebook).toHaveBeenCalledWith(
        'user_123',
        'AI Research',
        'Notes on AI',
        undefined,
      );
    });

    it('should return 400 when title is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/notebooks', () => {
    it('should return paginated list of user notebooks', async () => {
      const mockResult = {
        data: [{ id: 'nb_1', title: 'AI Research', userId: 'user_123' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockNotebookService.listUserNotebooks.mockResolvedValue(mockResult as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/notebooks?page=1&limit=20',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResult);
      expect(mockNotebookService.listUserNotebooks).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  describe('GET /api/notebooks/:id', () => {
    it('should return notebook when owned by user', async () => {
      const mockNotebook = { id: 'nb_1', title: 'AI Research', userId: 'user_123' };
      mockNotebookService.getNotebook.mockResolvedValue(mockNotebook as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/notebooks/nb_1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockNotebook);
      expect(mockNotebookService.getNotebook).toHaveBeenCalledWith('nb_1', 'user_123');
    });
  });

  describe('PATCH /api/notebooks/:id', () => {
    it('should update notebook fields', async () => {
      const updatedNotebook = { id: 'nb_1', title: 'Updated Title', userId: 'user_123' };
      mockNotebookService.updateNotebook.mockResolvedValue(updatedNotebook as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/notebooks/nb_1',
        payload: { title: 'Updated Title' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(updatedNotebook);
      expect(mockNotebookService.updateNotebook).toHaveBeenCalledWith('nb_1', 'user_123', {
        title: 'Updated Title',
      });
    });
  });

  describe('DELETE /api/notebooks/:id', () => {
    it('should delete notebook', async () => {
      mockNotebookService.deleteNotebook.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/notebooks/nb_1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, message: 'Notebook deleted successfully' });
      expect(mockNotebookService.deleteNotebook).toHaveBeenCalledWith('nb_1', 'user_123');
    });
  });
});
