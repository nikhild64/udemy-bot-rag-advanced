import { buildApp } from './app';
import { config } from './config';
import { logger } from './shared';

async function startServer(): Promise<void> {
  try {
    const app = await buildApp();

    const address = await app.listen({
      port: config.app.port,
      host: '0.0.0.0',
    });

    logger.info(`Server listening on ${address} in ${config.app.env} mode`);

    const signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        app.close().then(
          () => {
            logger.info('Server closed gracefully');
            process.exit(0);
          },
          (err) => {
            logger.error({ err }, 'Error during server shutdown');
            process.exit(1);
          },
        );
      });
    }

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Rejection occurred');
    });

    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Uncaught Exception occurred, shutting down...');
      app.close().finally(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

void startServer();
