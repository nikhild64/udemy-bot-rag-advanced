import { FastifyInstance } from 'fastify';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { diPlugin } from './di.plugin';

/**
 * Centralized plugin registration
 * Registers cross-cutting Fastify plugins (e.g. Swagger, rate limits) and DI.
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // Add Zod type provider compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
}
