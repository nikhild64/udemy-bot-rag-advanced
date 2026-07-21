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
