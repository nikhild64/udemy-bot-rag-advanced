import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { sourceRoutes } from '@/api/routes/source.routes';
import { globalErrorHandler } from '@/api/middlewares/error.handler';
import { SourceService } from '@/services/SourceService';
import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';

describe('GET /api/sources/:sourceId/status Route', () => {
  let app: FastifyInstance;
  let queue: IngestionQueue;
  let mockSourceService: any;

  const mockSource = {
    id: 'src_100',
    notebookId: 'nb_1',
    title: 'Test Doc',
    status: 'Processing',
    metadata: {},
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    app = fastify();
    app.setErrorHandler(globalErrorHandler);

    app.addHook('onRequest', async (req) => {
      req.auth = { userId: 'user_123' };
    });

    mockSourceService = {
      getSource: vi.fn().mockResolvedValue(mockSource),
    };

    app.decorate('sourceService', mockSourceService as unknown as SourceService);

    queue = new IngestionQueue();
    await queue.clear();

    await app.register(sourceRoutes);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('should return 200 with live progress when job is processing in queue', async () => {
    await queue.updateProgress('src_100', 'Embedding', 75, 'Processing');

    const response = await app.inject({
      method: 'GET',
      url: '/api/sources/src_100/status',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.sourceId).toBe('src_100');
    expect(json.status).toBe('Processing');
    expect(json.progress).toBe(75);
    expect(json.currentStage).toBe('Embedding');
  });

  it('should fallback to database source status when queue status is absent', async () => {
    mockSourceService.getSource.mockResolvedValueOnce({
      ...mockSource,
      status: 'Indexed',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sources/src_100/status',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.sourceId).toBe('src_100');
    expect(json.status).toBe('Indexed');
    expect(json.progress).toBe(100);
    expect(json.currentStage).toBe('Completed');
  });
});
