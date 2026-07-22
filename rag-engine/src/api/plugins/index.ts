import { FastifyInstance } from 'fastify';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { diPlugin } from './di.plugin';
import { config } from '../../config';
import { clerkPlugin } from '@clerk/fastify';

/**
 * Centralized plugin registration
 * Registers cross-cutting Fastify plugins (e.g. Swagger, rate limits) and DI.
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // Add Zod type provider compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security Headers
  await app.register(fastifyHelmet, {
    global: true,
  });

  // CORS Configuration
  await app.register(fastifyCors, {
    origin: process.env.FRONTEND_ORIGIN || (config.app.env === 'development' ? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ] : false),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  // Response Compression
  await app.register(fastifyCompress, {
    global: true,
  });

  // Rate Limiting
  await app.register(fastifyRateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute', // per minute per IP
  });

  // Register Swagger
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Knowledge Engine API',
        description: 'REST API for the Knowledge Engine Chat Pipeline',
        version: '0.1.0',
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
  });

  // Register Swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register Dependency Injection
  await app.register(diPlugin);

  const PUBLIC_PATHS = ['/health', '/status', '/ready', '/docs'];
  const isPublicPath = (url: string | undefined): boolean => {
    if (!url) return false;
    const path = url.split('?')[0];
    if (!path) return false;
    return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  };

  // Register Clerk Authentication (bypassing public endpoints like /health, /status, /ready, /docs)
  await app.register(async (scopedApp) => {
    const originalAddHook = scopedApp.addHook.bind(scopedApp);
    scopedApp.addHook = function (name: any, hook: any) {
      if (name === 'preHandler') {
        const wrappedHook = async (request: any, reply: any) => {
          const url = request.raw?.url || request.url;
          if (isPublicPath(url)) {
            return; // Skip Clerk authentication middleware on public routes
          }
          return hook(request, reply);
        };
        return originalAddHook(name, wrappedHook);
      }
      return originalAddHook(name, hook);
    };

    await scopedApp.register(clerkPlugin, {
      publishableKey: config.auth.publishableKey,
      secretKey: config.auth.secretKey,
    });
  });
}
