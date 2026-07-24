import { FastifyInstance } from 'fastify';
import {
  postNotebookChatController,
  postNotebookChatStreamController,
  getNotebookMessagesController,
  deleteNotebookMessageController,
} from '../controllers/notebook-chat.controller';
import {
  generatePodcastController,
  generateLearningPathController,
  getNotebookArtifactsController,
} from '../controllers/generate.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export async function notebookChatRoutes(app: FastifyInstance): Promise<void> {
  // Non-streaming notebook chat
  app.post(
    '/api/notebooks/:notebookId/chat',
    { preHandler: [requireAuth] },
    postNotebookChatController,
  );
  app.post(
    '/api/v1/notebooks/:id/chat',
    { preHandler: [requireAuth] },
    postNotebookChatController,
  );

  // SSE streaming notebook chat
  app.post(
    '/api/notebooks/:notebookId/chat/stream',
    { preHandler: [requireAuth] },
    postNotebookChatStreamController,
  );
  app.post(
    '/api/v1/notebooks/:id/chat/stream',
    { preHandler: [requireAuth] },
    postNotebookChatStreamController,
  );

  // Notebook message history
  app.get(
    '/api/notebooks/:notebookId/messages',
    { preHandler: [requireAuth] },
    getNotebookMessagesController,
  );
  app.get(
    '/api/v1/notebooks/:id/messages',
    { preHandler: [requireAuth] },
    getNotebookMessagesController,
  );

  // Delete message and all subsequent messages
  app.delete(
    '/api/notebooks/:notebookId/messages/:messageId',
    { preHandler: [requireAuth] },
    deleteNotebookMessageController,
  );

  // ── Generation Routes ──────────────────────────────────────────────────────

  // Fetch saved artifact statuses & results for a notebook
  app.get(
    '/api/notebooks/:notebookId/artifacts',
    { preHandler: [requireAuth] },
    getNotebookArtifactsController,
  );

  // Generate a two-person podcast script from notebook sources
  app.post(
    '/api/notebooks/:notebookId/generate/podcast',
    { preHandler: [requireAuth] },
    generatePodcastController,
  );

  // Generate a structured learning path from notebook sources
  app.post(
    '/api/notebooks/:notebookId/generate/learning-path',
    { preHandler: [requireAuth] },
    generateLearningPathController,
  );
}
