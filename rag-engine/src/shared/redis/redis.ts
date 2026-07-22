import Redis from 'ioredis';
import { config } from '@/config';

let redisClientInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClientInstance) {
    if (config.redis.url) {
      redisClientInstance = new Redis(config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });
    } else {
      redisClientInstance = new Redis({
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379,
        password: config.redis.password,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });
    }
  }
  return redisClientInstance;
}
