import { appConfig, AppConfig } from './app';
import { loggerConfig, LoggerConfig } from './logger';
import { ingestionConfig, IngestionConfig } from './ingestion';
import { chunkingConfig, ChunkingConfig } from './chunking';
import { embeddingsConfig, EmbeddingsConfig } from './embeddings';

export interface ApplicationConfig {
  readonly app: AppConfig;
  readonly logger: LoggerConfig;
  readonly ingestion: IngestionConfig;
  readonly chunking: ChunkingConfig;
  readonly embeddings: EmbeddingsConfig;
}

export const config: ApplicationConfig = {
  app: appConfig,
  logger: loggerConfig,
  ingestion: ingestionConfig,
  chunking: chunkingConfig,
  embeddings: embeddingsConfig,
};

export * from './app';
export * from './logger';
export * from './ingestion';
export * from './chunking';
export * from './embeddings';

