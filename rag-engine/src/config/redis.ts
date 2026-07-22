import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const redisSchema = z.object({
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
});

export interface RedisConfig {
  readonly url: string;
  readonly upstashRestUrl: string | undefined;
  readonly upstashRestToken: string | undefined;
  readonly host: string | undefined;
  readonly port: number | undefined;
  readonly password: string | undefined;
}

function loadRedisConfig(): RedisConfig {
  const result = redisSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Redis configuration validation failed: ${errorDetails}`);
  }

  const { REDIS_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = result.data;

  let resolvedUrl = REDIS_URL;

  // Auto-construct rediss:// URL from Upstash REST credentials if REDIS_URL is not provided
  if (!resolvedUrl && UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    const host = UPSTASH_REDIS_REST_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    resolvedUrl = `rediss://default:${UPSTASH_REDIS_REST_TOKEN}@${host}:6379`;
  }

  if (!resolvedUrl) {
    resolvedUrl = 'redis://localhost:6379';
  }

  return {
    url: resolvedUrl,
    upstashRestUrl: UPSTASH_REDIS_REST_URL,
    upstashRestToken: UPSTASH_REDIS_REST_TOKEN,
    host: result.data.REDIS_HOST,
    port: result.data.REDIS_PORT,
    password: result.data.REDIS_PASSWORD,
  };
}

export const redisConfig: RedisConfig = loadRedisConfig();
