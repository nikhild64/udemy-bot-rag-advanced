import { FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'stream';
import { ChatRequest } from '../../core/models';

export async function postChat(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const chatRequest = request.body as ChatRequest;
  
  // Pipeline is injected on the Fastify instance via DI plugin
  const pipeline = request.server.chatPipelineService;

  const response = await pipeline.chat(chatRequest);

  await reply.status(200).send(response);
}

export async function postChatStream(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const chatRequest = request.body as ChatRequest;
  const pipeline = request.server.chatPipelineService;

  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');

  async function* sseGenerator() {
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

        yield sseEvent;
        
        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }
    } catch (err) {
      const errorData = JSON.stringify({ message: err instanceof Error ? err.message : 'Streaming failed' });
      yield `event: error\ndata: ${errorData}\n\n`;
    }
  }

  return reply.send(Readable.from(sseGenerator()));
}
