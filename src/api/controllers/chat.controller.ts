import { FastifyReply, FastifyRequest } from 'fastify';
import { ChatRequest } from '../../core/models';

export async function postChat(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const chatRequest = request.body;
  
  // Pipeline is injected on the Fastify instance via DI plugin
  const pipeline = request.server.chatPipelineService;

  const response = await pipeline.chat(chatRequest);

  await reply.status(200).send(response);
}
