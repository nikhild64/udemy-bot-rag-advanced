import { FastifyReply, FastifyRequest } from 'fastify';
import { RetrievalOrchestrator } from '@/retrieval/notebook/RetrievalOrchestrator';
import { notebookRetrievalSchema } from '../schemas/retrieval.schema';
import { UnauthorizedError } from '@/shared/errors';

export async function retrieveNotebookContextController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { notebookId, id } = request.params as { notebookId?: string; id?: string };
  const targetNotebookId = notebookId || id;

  if (!targetNotebookId) {
    throw new UnauthorizedError('Notebook ID is required');
  }

  const body = notebookRetrievalSchema.parse(request.body);

  const orchestrator: RetrievalOrchestrator =
    request.server.retrievalOrchestrator || new RetrievalOrchestrator();

  const result = await orchestrator.retrieve({
    notebookId: targetNotebookId,
    userId,
    query: body.query,
    topK: body.topK,
    candidateLimit: body.candidateLimit,
    similarityThreshold: body.similarityThreshold,
    maxContextTokens: body.maxContextTokens,
    filters: body.filters,
    transformationStrategy: body.transformationStrategy,
    rerankerProvider: body.rerankerProvider,
  });

  await reply.status(200).send(result);
}
