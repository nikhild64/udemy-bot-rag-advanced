import pino, { Logger as PinoLogger } from 'pino';
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
