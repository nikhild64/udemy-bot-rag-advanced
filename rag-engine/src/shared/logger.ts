import pino, { Logger as PinoLogger, multistream } from 'pino';
import pinoPretty from 'pino-pretty';
import { Writable } from 'node:stream';
import { LogLevel } from '@prisma/client';
import { config } from '../config';

export type Logger = PinoLogger;

const dbLogStream = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const str = chunk.toString();
      const logObj = JSON.parse(str);

      // Avoid self-logging admin log polling or db failure loops
      const url = logObj.url || '';
      const msgStr = logObj.msg || '';
      if (url.includes('/api/v1/admin/logs') || msgStr.includes('Failed to persist log record')) {
        callback();
        return;
      }

      let level: LogLevel = LogLevel.INFO;
      if (logObj.level >= 50) {
        level = LogLevel.ERROR;
      } else if (logObj.level >= 40) {
        level = LogLevel.WARN;
      } else if (logObj.level >= 30) {
        level = LogLevel.INFO;
      } else {
        level = LogLevel.DEBUG;
      }

      let context = logObj.context || logObj.service || logObj.component || null;
      if (!context) {
        if (logObj.url || msgStr.startsWith('HTTP') || msgStr.startsWith('API')) {
          context = 'HTTP Request';
        } else if (
          msgStr.includes('Retrieval') ||
          msgStr.includes('CRAG') ||
          msgStr.includes('Rerank') ||
          msgStr.includes('Query') ||
          msgStr.includes('Search')
        ) {
          context = 'RAG Engine';
        } else if (msgStr.includes('Embed') || msgStr.includes('embed')) {
          context = 'Embedding';
        } else if (msgStr.includes('Index') || msgStr.includes('index')) {
          context = 'Indexing';
        } else if (
          msgStr.includes('Ingestion') ||
          msgStr.includes('Chunk') ||
          msgStr.includes('Parse') ||
          msgStr.includes('Manifest')
        ) {
          context = 'Ingestion';
        } else if (msgStr.includes('Guard') || msgStr.includes('guard')) {
          context = 'Guardrails';
        } else {
          context = 'System';
        }
      }

      const { level: _, time: __, pid: ___, hostname: ____, msg: _____, context: ______, service: _______, component: ________, ...metadata } = logObj;

      void recordSystemLog(level, msgStr || 'Log event', context, metadata);
    } catch {
      // ignore non-json log entries
    }
    callback();
  },
});

function createLogger(): Logger {
  const isDevelopment = config.app.env === 'development';

  const stdoutStream = isDevelopment
    ? pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    : process.stdout;

  const streams = [
    { stream: stdoutStream },
    { stream: dbLogStream, level: 'info' as pino.Level },
  ];

  return pino(
    {
      level: config.logger.level,
    },
    multistream(streams),
  );
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
  } catch {
    // Fail-safe: database logging errors should not crash application
  }
}



