import { FastifyReply, FastifyRequest } from 'fastify';
import { vectorStoreConfig } from '../../config';
import { prisma } from '../../shared/database/prisma';
import { getRedisClient } from '../../shared/redis/redis';
import { StorageService } from '../../services/StorageService';
import { logger } from '../../shared/logger';

export interface HealthResponse {
  readonly status: string;
  readonly service: string;
  readonly version: string;
  readonly timestamp?: string;
  readonly error?: string;
  readonly dependencies?: Record<string, { status: 'healthy' | 'unhealthy' | 'disabled'; error?: string }>;
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
  // Verify pipeline initialization
  if (!request.server.chatPipelineService) {
    const responsePayload: HealthResponse = {
      status: 'unavailable',
      service: 'rag-engine',
      version: '0.1.0',
      error: 'Pipeline not initialized',
    };
    return reply.status(503).send(responsePayload);
  }

  const dependencies: Record<string, { status: 'healthy' | 'unhealthy' | 'disabled'; error?: string }> = {
    database: { status: 'unhealthy' },
    redis: { status: 'unhealthy' },
    qdrant: { status: 'unhealthy' },
    storage: { status: 'unhealthy' },
  };

  let isAllHealthy = true;

  // 1. Database Check
  try {
    await prisma.$queryRaw`SELECT 1`;
    dependencies.database = { status: 'healthy' };
  } catch (err) {
    isAllHealthy = false;
    const msg = err instanceof Error ? err.message : 'Database ping failed';
    dependencies.database = { status: 'unhealthy', error: msg };
    logger.warn({ err }, 'Readiness check: Database failed');
  }

  // 2. Redis Check
  try {
    const redis = getRedisClient();
    await redis.ping();
    dependencies.redis = { status: 'healthy' };
  } catch (err) {
    isAllHealthy = false;
    const msg = err instanceof Error ? err.message : 'Redis ping failed';
    dependencies.redis = { status: 'unhealthy', error: msg };
    logger.warn({ err }, 'Readiness check: Redis failed');
  }

  // 3. Qdrant Vector Store Check
  try {
    const qdrantUrl = new URL('/readyz', vectorStoreConfig.qdrantUrl).toString();
    const qdrantResponse = await fetch(qdrantUrl, {
      headers: vectorStoreConfig.qdrantApiKey ? { 'api-key': vectorStoreConfig.qdrantApiKey } : {},
      signal: AbortSignal.timeout(3000),
    });

    if (qdrantResponse.ok) {
      dependencies.qdrant = { status: 'healthy' };
    } else {
      isAllHealthy = false;
      dependencies.qdrant = {
        status: 'unhealthy',
        error: `Qdrant HTTP status ${qdrantResponse.status}`,
      };
    }
  } catch (err) {
    isAllHealthy = false;
    const msg = err instanceof Error ? err.message : 'Qdrant reachability failed';
    dependencies.qdrant = { status: 'unhealthy', error: msg };
    logger.warn({ err }, 'Readiness check: Qdrant failed');
  }

  // 4. Supabase Storage Check
  try {
    const storageService = new StorageService();
    const storageOk = await storageService.checkHealth();
    if (storageOk) {
      dependencies.storage = { status: 'healthy' };
    } else {
      isAllHealthy = false;
      dependencies.storage = { status: 'unhealthy', error: 'Storage check failed' };
    }
  } catch (err) {
    isAllHealthy = false;
    const msg = err instanceof Error ? err.message : 'Storage health check failed';
    dependencies.storage = { status: 'unhealthy', error: msg };
    logger.warn({ err }, 'Readiness check: Storage failed');
  }

  const responsePayload: HealthResponse = {
    status: isAllHealthy ? 'ready' : 'unavailable',
    service: 'rag-engine',
    version: '0.1.0',
    dependencies,
  };

  const statusCode = isAllHealthy ? 200 : 503;
  await reply.status(statusCode).send(responsePayload);
}
