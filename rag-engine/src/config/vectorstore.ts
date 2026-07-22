import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const vectorStoreSchema = z.object({
  VECTOR_STORE_PROVIDER: z.string().min(1).default('qdrant'),
  QDRANT_URL: z.string().url('QDRANT_URL must be a valid URL').min(1, 'QDRANT_URL is required'),
  QDRANT_API_KEY: z.string().min(1, 'QDRANT_API_KEY is required'),
  VECTOR_COLLECTION_NAME: z.string().min(1).default('knowledge-base'),
  SYSTEM_KNOWLEDGE_COLLECTION: z.string().min(1).default('system-knowledge'),
  USER_KNOWLEDGE_COLLECTION: z.string().min(1).default('user-knowledge'),
  VECTOR_DISTANCE_METRIC: z.string().min(1).default('Cosine'),
  VECTOR_STORE_TIMEOUT: z.coerce.number().int().positive().default(30000),
});

export interface VectorStoreConfig {
  readonly provider: string;
  readonly qdrantUrl: string;
  readonly qdrantApiKey: string;
  readonly collectionName: string;
  readonly vectorCollectionName: string;
  readonly systemKnowledgeCollection: string;
  readonly userKnowledgeCollection: string;
  readonly distanceMetric: string;
  readonly timeoutMs: number;
}

function loadVectorStoreConfig(): VectorStoreConfig {
  const result = vectorStoreSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Vector Store configuration validation failed: ${errorDetails}`);
  }

  return {
    provider: result.data.VECTOR_STORE_PROVIDER,
    qdrantUrl: result.data.QDRANT_URL,
    qdrantApiKey: result.data.QDRANT_API_KEY,
    collectionName: result.data.VECTOR_COLLECTION_NAME,
    vectorCollectionName: result.data.VECTOR_COLLECTION_NAME,
    systemKnowledgeCollection: result.data.SYSTEM_KNOWLEDGE_COLLECTION,
    userKnowledgeCollection: result.data.USER_KNOWLEDGE_COLLECTION,
    distanceMetric: result.data.VECTOR_DISTANCE_METRIC,
    timeoutMs: result.data.VECTOR_STORE_TIMEOUT,
  };
}

export const vectorStoreConfig: VectorStoreConfig = loadVectorStoreConfig();
