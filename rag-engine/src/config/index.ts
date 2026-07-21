import { appConfig, AppConfig } from './app';
import { loggerConfig, LoggerConfig } from './logger';
import { ingestionConfig, IngestionConfig } from './ingestion';
import { chunkingConfig, ChunkingConfig } from './chunking';
import { embeddingsConfig, EmbeddingsConfig } from './embeddings';
import { vectorStoreConfig, VectorStoreConfig } from './vectorstore';
import { indexingConfig, IndexingConfig } from './indexing';
import { retrievalConfig, RetrievalConfig } from './retrieval';
import { chatConfig, ChatConfig } from './chat';
import { guardrailsConfig, GuardrailsConfig } from './guardrails';
import { authConfig, AuthConfig } from './auth';

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
  readonly guardrails: GuardrailsConfig;
  readonly auth: AuthConfig;
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
  guardrails: guardrailsConfig,
  auth: authConfig,
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
export * from './guardrails';
export * from './auth';
