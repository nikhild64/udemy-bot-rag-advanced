import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const appSchema = z.object({
  PORT: z
    .preprocess(
      (val) => (val === undefined || val === '' ? 3000 : val),
      z.coerce.number().int().positive()
    )
    .default(3000),
  NODE_ENV: z
    .preprocess(
      (val) => (val === undefined || val === '' ? 'development' : val),
      z.enum(['development', 'production', 'test'])
    )
    .default('development'),
});

export interface AppConfig {
  readonly port: number;
  readonly env: 'development' | 'production' | 'test';
}

function loadAppConfig(): AppConfig {
  const result = appSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`App configuration validation failed: ${errorDetails}`);
  }

  return {
    port: result.data.PORT,
    env: result.data.NODE_ENV,
  };
}

export const appConfig: AppConfig = loadAppConfig();
