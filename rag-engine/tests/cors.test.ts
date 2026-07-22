import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('CORS and Helmet configuration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow CORS and set appropriate headers when calling from https://chaicodeudemy.vercel.app', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://chaicodeudemy.vercel.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://chaicodeudemy.vercel.app');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should set cross-origin policy in Helmet headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://chaicodeudemy.vercel.app',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['access-control-allow-origin']).toBe('https://chaicodeudemy.vercel.app');
  });
});
