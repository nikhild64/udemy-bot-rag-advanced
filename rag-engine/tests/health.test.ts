import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

// Mock dependencies for readiness checks in vitest environment
vi.mock('../src/shared/database/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../src/shared/redis/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
  }),
}));

vi.mock('../src/services/StorageService', () => {
  return {
    StorageService: vi.fn().mockImplementation(() => ({
      checkHealth: vi.fn().mockResolvedValue(true),
    })),
  };
});

describe('Health & Readiness Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Mock global fetch for Qdrant readyz check
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    app = await buildApp();
    if (!app.hasDecorator('chatPipelineService')) {
      app.decorate('chatPipelineService', {} as any);
    }
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 and valid health payload on /health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('rag-engine');
    expect(payload.version).toBe('0.1.0');
  });

  it('should return 200 and ready dependencies on /ready', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ready');
    expect(payload.dependencies).toBeDefined();
    expect(payload.dependencies.database.status).toBe('healthy');
    expect(payload.dependencies.redis.status).toBe('healthy');
    expect(payload.dependencies.qdrant.status).toBe('healthy');
    expect(payload.dependencies.storage.status).toBe('healthy');
  });
});
