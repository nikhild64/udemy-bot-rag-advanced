import { IngestionWorker } from './IngestionWorker';
import { logger } from '../shared/logger';
import { InfrastructureInitializer } from '../infrastructure/InfrastructureInitializer';

async function startWorkerRunner(): Promise<void> {
  try {
    logger.info('Initializing Infrastructure for IngestionWorker process...');
    await InfrastructureInitializer.initialize();

    const worker = new IngestionWorker();
    logger.info('Starting IngestionWorker loop...');
    worker.start(500);

    const shutdown = () => {
      logger.info('Received termination signal. Stopping worker gracefully...');
      worker.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Rejection in Worker process');
    });

    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Uncaught Exception in Worker process');
      worker.stop();
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start worker runner process');
    process.exit(1);
  }
}

void startWorkerRunner();
