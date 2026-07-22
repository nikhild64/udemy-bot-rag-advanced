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
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });

  // CORS Configuration
  const frontendOriginsEnv = process.env.FRONTEND_ORIGIN;
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin header (like server-to-server, curl, mobile apps)
      if (!origin) {
        return cb(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, '');

      // Allow if FRONTEND_ORIGIN is set to '*' or 'true'
      if (frontendOriginsEnv === '*' || frontendOriginsEnv === 'true') {
        return cb(null, true);
      }

      // Check explicit comma-separated origins from FRONTEND_ORIGIN env variable
      if (frontendOriginsEnv) {
        const allowedOrigins = frontendOriginsEnv
          .split(',')
          .map((o) => o.trim().replace(/\/$/, ''));
        if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
          return cb(null, true);
        }
      }

      // Allow known deployment domains (.vercel.app), explicit chaicodeudemy.vercel.app, and local dev origins
      if (
        config.app.env === 'development' ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1') ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin === 'https://chaicodeudemy.vercel.app'
      ) {
        return cb(null, true);
      }

      // Reject origin cleanly without server 500 error
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Clerk-Session-Id',
    ],
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

  // Register Clerk Authentication globally
  await app.register(clerkPlugin, {
    publishableKey: config.auth.publishableKey,
    secretKey: config.auth.secretKey,
  });
}
