import { FastifyInstance } from 'fastify';

/**
 * Centralized plugin registration
 * Future phases will register cross-cutting Fastify plugins (e.g. CORS, Swagger, rate limits) here.
 */
export async function registerPlugins(_app: FastifyInstance): Promise<void> {
  // Plugin registrations for future implementation phases
}
