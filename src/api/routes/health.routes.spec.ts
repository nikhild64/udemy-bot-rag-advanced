import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();
    await app.register(healthRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 and ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: 'rag-engine',
        version: '0.1.0',
      });
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when pipeline is initialized', async () => {
      // Decorate mock pipeline service
      app.decorate('chatPipelineService', {});

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ready',
        service: 'rag-engine',
        version: '0.1.0',
      });
    });

    it('should return 503 when pipeline is not initialized', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: 'unavailable',
        service: 'rag-engine',
        version: '0.1.0',
        error: 'Pipeline not initialized',
      });
    });
  });
});
