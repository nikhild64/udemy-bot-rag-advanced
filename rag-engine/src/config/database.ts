import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const databaseSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL').min(1, 'DATABASE_URL is required'),
});

export interface DatabaseConfig {
  readonly url: string;
}

function loadDatabaseConfig(): DatabaseConfig {
  const result = databaseSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Database configuration validation failed: ${errorDetails}`);
  }

  return {
    url: result.data.DATABASE_URL,
  };
}

export const databaseConfig: DatabaseConfig = loadDatabaseConfig();
