import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { sourceRoutes } from '@/api/routes/source.routes';
import { globalErrorHandler } from '@/api/middlewares/error.handler';
import { SourceService } from '@/services/SourceService';
import { SourceType, SourceStatus } from '@prisma/client';

vi.mock('@/services/SourceService');

describe('Source Routes', () => {
  let app: FastifyInstance;
  let mockSourceService: any;

  beforeEach(async () => {
    app = fastify();
    app.setErrorHandler(globalErrorHandler);

    // Mock auth middleware by injecting request.auth
    app.addHook('onRequest', async (req) => {
      req.auth = { userId: 'user_123' };
    });

    await app.register(sourceRoutes);

    mockSourceService = vi.mocked(SourceService).prototype;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/notebooks/:id/sources', () => {
    it('should create source metadata with PendingUpload state', async () => {
      const mockSource = {
        id: 'src_1',
        notebookId: 'nb_1',
        type: SourceType.PDF,
        displayName: 'My Document',
        title: 'My Document',
        status: SourceStatus.PendingUpload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSourceService.createSource.mockResolvedValue(mockSource as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_1/sources',
        payload: {
          type: 'PDF',
          displayName: 'My Document',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(mockSource);
      expect(mockSourceService.createSource).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          notebookId: 'nb_1',
          type: 'PDF',
          displayName: 'My Document',
        }),
      );
    });

    it('should return 400 when source type is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/notebooks/nb_1/sources',
        payload: {
          type: 'INVALID_TYPE',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/notebooks/:id/sources', () => {
    it('should return paginated list of sources for a notebook', async () => {
      const mockResult = {
        data: [{ id: 'src_1', notebookId: 'nb_1', displayName: 'My Document', type: SourceType.PDF }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockSourceService.listSources.mockResolvedValue(mockResult as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/notebooks/nb_1/sources?page=1&limit=20&type=PDF',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResult);
      expect(mockSourceService.listSources).toHaveBeenCalledWith(
        'nb_1',
        'user_123',
        expect.objectContaining({ page: 1, limit: 20, type: 'PDF' }),
      );
    });
  });

  describe('GET /api/sources/:id', () => {
    it('should return source metadata when owned by user', async () => {
      const mockSource = { id: 'src_1', notebookId: 'nb_1', displayName: 'My Document' };
      mockSourceService.getSource.mockResolvedValue(mockSource as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sources/src_1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockSource);
      expect(mockSourceService.getSource).toHaveBeenCalledWith('src_1', 'user_123');
    });
  });

  describe('PATCH /api/sources/:id', () => {
    it('should update source metadata', async () => {
      const updatedSource = { id: 'src_1', displayName: 'Renamed Document' };
      mockSourceService.updateSource.mockResolvedValue(updatedSource as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/sources/src_1',
        payload: { displayName: 'Renamed Document' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(updatedSource);
      expect(mockSourceService.updateSource).toHaveBeenCalledWith('src_1', 'user_123', {
        displayName: 'Renamed Document',
      });
    });
  });

  describe('DELETE /api/sources/:id', () => {
    it('should delete source metadata', async () => {
      mockSourceService.deleteSource.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/sources/src_1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, message: 'Source deleted successfully' });
      expect(mockSourceService.deleteSource).toHaveBeenCalledWith('src_1', 'user_123');
    });
  });
});
