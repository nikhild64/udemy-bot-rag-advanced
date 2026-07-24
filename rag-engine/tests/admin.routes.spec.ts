import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { LogLevel } from '@prisma/client';

vi.mock('../src/repositories/PrismaSystemLogRepository', () => {
  const mockLogs = [
    {
      id: 'log-1',
      level: 'ERROR',
      message: 'Failed to process embeddings',
      context: 'EmbeddingProvider',
      metadata: { error: 'Timeout' },
      createdAt: new Date(),
    },
    {
      id: 'log-2',
      level: 'WARN',
      message: 'High latency detected',
      context: 'HTTP Handler',
      metadata: { statusCode: 429 },
      createdAt: new Date(),
    },
  ];

  return {
    PrismaSystemLogRepository: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(mockLogs[0]),
      findMany: vi.fn().mockImplementation(async (query: any) => {
        let data = [...mockLogs];
        if (query.level) {
          data = data.filter((l) => l.level === query.level);
        }
        return {
          data,
          pagination: { page: query.page || 1, limit: query.limit || 50, total: data.length, totalPages: 1 },
        };
      }),
      getStats: vi.fn().mockResolvedValue({
        total: 2,
        errorCount: 1,
        warnCount: 1,
        infoCount: 0,
        debugCount: 0,
      }),
      deleteAll: vi.fn().mockResolvedValue({ count: 2 }),
      prune: vi.fn().mockResolvedValue({ count: 1 }),
    })),
  };
});

vi.mock('../src/repositories/PrismaUserRepository', () => {
  return {
    PrismaUserRepository: vi.fn().mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'admin_user') {
          return { id: 'admin_user', email: 'admin@example.com', role: 'ADMIN' };
        }
        return { id: 'regular_user', email: 'user@example.com', role: 'USER' };
      }),
    })),
  };
});

describe('Admin Routes & Authorization', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 Unauthorized when request has no auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 403 Forbidden for non-admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs',
      headers: {
        'x-user-id': 'regular_user',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('should return 200 OK and logs for admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs',
      headers: {
        'x-user-id': 'admin_user',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('should return filtered logs by level for admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs?level=ERROR',
      headers: {
        'x-user-id': 'admin_user',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].level).toBe('ERROR');
  });

  it('should return log summary stats on GET /api/v1/admin/logs/stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/logs/stats',
      headers: {
        'x-user-id': 'admin_user',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.errorCount).toBe(1);
  });

  it('should allow admin user to delete all logs on DELETE /api/v1/admin/logs', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/logs',
      headers: {
        'x-user-id': 'admin_user',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(2);
  });
});
