import { appConfig, AppConfig } from './app';
import { loggerConfig, LoggerConfig } from './logger';

export interface ApplicationConfig {
  readonly app: AppConfig;
  readonly logger: LoggerConfig;
}

export const config: ApplicationConfig = {
  app: appConfig,
  logger: loggerConfig,
};

export * from './app';
export * from './logger';
