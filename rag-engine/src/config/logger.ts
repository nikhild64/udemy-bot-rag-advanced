import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const loggerSchema = z.object({
  LOG_LEVEL: z
    .preprocess(
      (val) => (val === undefined || val === '' ? 'info' : val),
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    )
    .default('info'),
});

export interface LoggerConfig {
  readonly level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

function loadLoggerConfig(): LoggerConfig {
  const result = loggerSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Logger configuration validation failed: ${errorDetails}`);
  }

  return {
    level: result.data.LOG_LEVEL,
  };
}

export const loggerConfig: LoggerConfig = loadLoggerConfig();
