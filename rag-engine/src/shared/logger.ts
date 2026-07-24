import pino, { Logger as PinoLogger } from 'pino';
import { LogLevel } from '@prisma/client';
import { config } from '../config';

export type Logger = PinoLogger;

function createLogger(): Logger {
  const isDevelopment = config.app.env === 'development';

  return pino({
    level: config.logger.level,
    ...(isDevelopment
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });
}

export const logger: Logger = createLogger();

let systemLogRepoInstance: any = null;

export async function recordSystemLog(
  level: LogLevel,
  message: string,
  context?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    if (!systemLogRepoInstance) {
      // Lazy import to prevent circular dependency
      const { PrismaSystemLogRepository } = await import('../repositories/PrismaSystemLogRepository');
      systemLogRepoInstance = new PrismaSystemLogRepository();
    }
    await systemLogRepoInstance.create({
      level,
      message,
      context: context ?? 'System',
      metadata: metadata ?? {},
    });
  } catch (err) {
    // Fail-safe: database logging errors should not crash request loop
    logger.error({ err }, 'Failed to persist log record to database');
  }
}

