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

export async function postChatStream(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const chatRequest = request.body;
  const pipeline = request.server.chatPipelineService;

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  try {
    const stream = pipeline.stream(chatRequest);

    for await (const event of stream) {
      let data = '';
      if (event.type === 'token') {
        data = JSON.stringify({ content: event.data });
      } else if (event.type === 'citation' || event.type === 'error') {
        data = JSON.stringify(event.data);
      }
      
      let sseEvent = `event: ${event.type}\n`;
      if (data) {
        sseEvent += `data: ${data}\n`;
      }
      sseEvent += '\n';

      reply.raw.write(sseEvent);
      
      if (event.type === 'done' || event.type === 'error') {
        break;
      }
    }
  } catch (err) {
    const errorData = JSON.stringify({ message: err instanceof Error ? err.message : 'Streaming failed' });
    reply.raw.write(`event: error\ndata: ${errorData}\n\n`);
  } finally {
    reply.raw.end();
  }
}
