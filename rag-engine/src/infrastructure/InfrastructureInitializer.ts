import { prisma } from '@/shared/database/prisma';
import { getRedisClient } from '@/shared/redis/redis';
import { StorageService } from '@/services/StorageService';
import { VectorStoreService } from '@/services/VectorStoreService';
import { LogLevel } from '@prisma/client';
import { logger, recordSystemLog } from '@/shared/logger';

export class InfrastructureInitializer {
  static async initialize(): Promise<void> {
    logger.info('=====================================================');
    logger.info('Starting Automatic Infrastructure Initialization...');
    logger.info('=====================================================');

    // 1. Verify PostgreSQL Database connection
    await this.initDatabase();

    // 2. Verify Redis connection
    await this.initRedis();

    // 3. Verify Supabase Storage connection
    await this.initStorage();

    // 4. Verify Qdrant connection & Ensure collections
    await this.initVectorStore();

    logger.info('=====================================================');
    logger.info('Infrastructure Initialization Complete. Ready!');
    logger.info('=====================================================');

    void recordSystemLog(
      LogLevel.INFO,
      'Infrastructure initialization complete. Database, Redis, Storage & Qdrant ready.',
      'System Startup',
      { timestamp: new Date().toISOString() },
    );
  }

  private static async initDatabase(): Promise<void> {
    try {
      logger.info('[1/4] Verifying PostgreSQL connection...');
      await prisma.$connect();
      logger.info('✔ PostgreSQL connection verified.');
    } catch (err) {
      logger.error({ err }, '✖ PostgreSQL connection failed!');
      // Non-fatal warning or rethrow based on environment
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Database initialization failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private static async initRedis(): Promise<void> {
    try {
      logger.info('[2/4] Verifying Redis connection...');
      const redis = getRedisClient();
      await redis.connect().catch((err) => {
        if (!err.message.includes('already connecting') && !err.message.includes('already connected')) {
          throw err;
        }
      });
      const pingRes = await redis.ping();
      logger.info({ pingResponse: pingRes }, '✔ Redis connection verified.');
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, '⚠ Redis connection check failed (proceeding as lazy/mock).');
    }
  }

  private static async initStorage(): Promise<void> {
    try {
      logger.info('[3/4] Verifying Supabase Storage connection...');
      const storageService = new StorageService();
      const isHealthy = await storageService.checkHealth();
      if (isHealthy) {
        logger.info('✔ Supabase Storage connection verified.');
      } else {
        logger.warn('⚠ Supabase Storage check returned false (using fallback mode).');
      }
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, '⚠ Supabase Storage check warning.');
    }
  }

  private static async initVectorStore(): Promise<void> {
    try {
      logger.info('[4/4] Verifying Qdrant VectorStore & Ensuring collections...');
      const vectorStoreService = new VectorStoreService();
      const status = await vectorStoreService.ensureCollections();
      logger.info(
        { systemCollectionReady: status.systemCollection, userCollectionReady: status.userCollection },
        '✔ Qdrant VectorStore collections verified & ready.',
      );
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, '⚠ Qdrant VectorStore initialization warning.');
    }
  }
}
