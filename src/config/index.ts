import { appConfig, AppConfig } from './app';
import { loggerConfig, LoggerConfig } from './logger';
import { ingestionConfig, IngestionConfig } from './ingestion';
import { chunkingConfig, ChunkingConfig } from './chunking';
import { embeddingsConfig, EmbeddingsConfig } from './embeddings';
import { vectorStoreConfig, VectorStoreConfig } from './vectorstore';
import { indexingConfig, IndexingConfig } from './indexing';
import { retrievalConfig, RetrievalConfig } from './retrieval';
import { chatConfig, ChatConfig } from './chat';

export interface ApplicationConfig {
  readonly app: AppConfig;
  readonly logger: LoggerConfig;
  readonly ingestion: IngestionConfig;
  readonly chunking: ChunkingConfig;
  readonly embeddings: EmbeddingsConfig;
  readonly vectorStore: VectorStoreConfig;
  readonly indexing: IndexingConfig;
  readonly retrieval: RetrievalConfig;
  readonly chat: ChatConfig;
}

export const config: ApplicationConfig = {
  app: appConfig,
  logger: loggerConfig,
  ingestion: ingestionConfig,
  chunking: chunkingConfig,
  embeddings: embeddingsConfig,
  vectorStore: vectorStoreConfig,
  indexing: indexingConfig,
  retrieval: retrievalConfig,
  chat: chatConfig,
};

export * from './app';
export * from './logger';
export * from './ingestion';
export * from './chunking';
export * from './embeddings';
export * from './vectorstore';
export * from './indexing';
export * from './retrieval';
export * from './chat';
