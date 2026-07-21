import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ChatPipelineFactory } from '../../chat/ChatPipelineFactory';
import { ChatPipelineService } from '../../chat/ChatPipelineService';

declare module 'fastify' {
  interface FastifyInstance {
    chatPipelineService: ChatPipelineService;
  }
}

/**
 * Dependency Injection Plugin
 * Initializes core services and decorates the Fastify instance so controllers can access them.
 */
export const diPlugin = fp(async (app: FastifyInstance) => {
  // Initialize the Chat Pipeline
  const chatPipelineService = ChatPipelineFactory.create();

  // Decorate fastify instance
  app.decorate('chatPipelineService', chatPipelineService);

  app.log.info('Dependency Injection plugin registered successfully.');
});
