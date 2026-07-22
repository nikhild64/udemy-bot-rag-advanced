import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ChatPipelineFactory } from '../../chat/ChatPipelineFactory';
import { ChatPipelineService } from '../../chat/ChatPipelineService';
import { NotebookService, SourceService, StorageService, UploadService, VectorStoreService } from '@/services';
import { PrismaUserRepository, PrismaNotebookRepository, PrismaSourceRepository, PrismaMessageRepository } from '@/repositories';

declare module 'fastify' {
  interface FastifyInstance {
    chatPipelineService: ChatPipelineService;
    notebookService: NotebookService;
    sourceService: SourceService;
    uploadService: UploadService;
    storageService: StorageService;
    vectorStoreService: VectorStoreService;
    userRepository: PrismaUserRepository;
    notebookRepository: PrismaNotebookRepository;
    sourceRepository: PrismaSourceRepository;
    messageRepository: PrismaMessageRepository;
  }
}

/**
 * Dependency Injection Plugin
 * Initializes core repositories and domain services, decorating the Fastify instance for controllers.
 */
export const diPlugin = fp(async (app: FastifyInstance) => {
  // Initialize Core Services & Repositories
  const chatPipelineService = ChatPipelineFactory.create();

  const userRepository = new PrismaUserRepository();
  const notebookRepository = new PrismaNotebookRepository();
  const sourceRepository = new PrismaSourceRepository();
  const messageRepository = new PrismaMessageRepository();

  const storageService = new StorageService();
  const vectorStoreService = new VectorStoreService();
  const notebookService = new NotebookService(notebookRepository, userRepository);
  const sourceService = new SourceService(sourceRepository, notebookRepository);
  const uploadService = new UploadService(sourceRepository, notebookRepository, storageService);

  // Decorate fastify instance
  app.decorate('chatPipelineService', chatPipelineService);
  app.decorate('userRepository', userRepository);
  app.decorate('notebookRepository', notebookRepository);
  app.decorate('sourceRepository', sourceRepository);
  app.decorate('messageRepository', messageRepository);
  app.decorate('storageService', storageService);
  app.decorate('uploadService', uploadService);
  app.decorate('vectorStoreService', vectorStoreService);
  app.decorate('notebookService', notebookService);
  app.decorate('sourceService', sourceService);

  app.log.info('Dependency Injection plugin registered successfully with Multi-Tenant repositories and domain services.');
});
