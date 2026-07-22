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
import { cragConfig, CRAGConfig } from './crag';
import { databaseConfig, DatabaseConfig } from './database';
import { supabaseConfig, SupabaseConfig } from './supabase';
import { redisConfig, RedisConfig } from './redis';
import { uploadConfig, UploadConfig } from './upload';

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
  readonly crag: CRAGConfig;
  readonly database: DatabaseConfig;
  readonly supabase: SupabaseConfig;
  readonly redis: RedisConfig;
  readonly upload: UploadConfig;
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
  crag: cragConfig,
  database: databaseConfig,
  supabase: supabaseConfig,
  redis: redisConfig,
  upload: uploadConfig,
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
export * from './crag';
export * from './database';
export * from './supabase';
export * from './redis';
export * from './upload';
