import { appConfig, AppConfig } from './app';
import { loggerConfig, LoggerConfig } from './logger';
import { ingestionConfig, IngestionConfig } from './ingestion';

export interface ApplicationConfig {
  readonly app: AppConfig;
  readonly logger: LoggerConfig;
  readonly ingestion: IngestionConfig;
}

export const config: ApplicationConfig = {
  app: appConfig,
  logger: loggerConfig,
  ingestion: ingestionConfig,
};

export * from './app';
export * from './logger';
export * from './ingestion';
