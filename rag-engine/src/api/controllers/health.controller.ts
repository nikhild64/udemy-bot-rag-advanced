import { FastifyReply, FastifyRequest } from 'fastify';
import { vectorStoreConfig } from '../../config';

export interface HealthResponse {
  readonly status: string;
  readonly service: string;
  readonly version: string;
  readonly error?: string;
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
    if (!request.server.chatPipelineService) {
      throw new Error('Pipeline not initialized');
    }

    // Ping Qdrant to verify connectivity
    const qdrantUrl = new URL('/readyz', vectorStoreConfig.qdrantUrl).toString();
    const qdrantResponse = await fetch(qdrantUrl, {
      headers: vectorStoreConfig.qdrantApiKey ? { 'api-key': vectorStoreConfig.qdrantApiKey } : {},
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!qdrantResponse.ok) {
      throw new Error(`Qdrant connectivity failed with status ${qdrantResponse.status}`);
    }

    const responsePayload: HealthResponse = {
      status: 'ready',
      service: 'rag-engine',
      version: '0.1.0',
    };

    await reply.status(200).send(responsePayload);
  } catch (error) {
    const responsePayload: HealthResponse = {
      status: 'unavailable',
      service: 'rag-engine',
      version: '0.1.0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    await reply.status(503).send(responsePayload);
  }
}
