import { FastifyReply, FastifyRequest } from 'fastify';

export interface HealthResponse {
  readonly status: string;
  readonly service: string;
  readonly version: string;
}

export async function getHealthStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const responsePayload: HealthResponse = {
    status: 'ok',
    service: 'rag-engine',
    version: '0.1.0',
  };

  await reply.status(200).send(responsePayload);
}

export async function getReadyStatus(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // Pipeline is constructed synchronously in the DI plugin,
    // so if it's available, the configuration is loaded and Qdrant/Mistral instances are instantiated.
    // Further readiness checks could ping Qdrant here.
    if (!request.server.chatPipelineService) {
      throw new Error('Pipeline not initialized');
    }

    const responsePayload: HealthResponse = {
      status: 'ready',
      service: 'rag-engine',
      version: '0.1.0',
    };

    await reply.status(200).send(responsePayload);
  } catch (error) {
    const responsePayload = {
      status: 'unavailable',
      service: 'rag-engine',
      version: '0.1.0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    await reply.status(503).send(responsePayload);
  }
}
