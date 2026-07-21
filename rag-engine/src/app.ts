import fastify, { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { globalErrorHandler } from './api/middlewares/error.handler';
import { registerPlugins } from './api/plugins';
import { registerRoutes } from './api/routes';
import { logger } from './shared';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
  });

  // Register global error handler
  app.setErrorHandler(globalErrorHandler);

  // Centralized plugin registration
  await registerPlugins(app);

  // Centralized route registration
  await registerRoutes(app);

  return app;
}
