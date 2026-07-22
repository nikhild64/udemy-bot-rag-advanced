import { CollectionManager } from '@/providers/vectorstore/CollectionManager';
import { config } from '@/config';
import { logger } from '@/shared/logger';

export class VectorStoreService {
  constructor(private readonly collectionManager: CollectionManager = new CollectionManager()) {}

  async ensureCollections(): Promise<{ systemCollection: boolean; userCollection: boolean }> {
    const dimension = config.embeddings.dimension ?? 1024;
    const distanceMetric = config.vectorStore.distanceMetric ?? 'Cosine';

    const systemCollectionName = config.vectorStore.systemKnowledgeCollection;
    const userCollectionName = config.vectorStore.userKnowledgeCollection;

    logger.info({ systemCollectionName, userCollectionName, dimension }, 'Ensuring vector store collections exist');

    let systemCreated = false;
    let userCreated = false;

    const systemExists = await this.collectionManager.collectionExists(systemCollectionName);
    if (!systemExists) {
      systemCreated = await this.collectionManager.createCollection(systemCollectionName, dimension, distanceMetric);
    }
    await this.collectionManager.createPayloadIndexes(systemCollectionName);

    const userExists = await this.collectionManager.collectionExists(userCollectionName);
    if (!userExists) {
      userCreated = await this.collectionManager.createCollection(userCollectionName, dimension, distanceMetric);
    }
    await this.collectionManager.createPayloadIndexes(userCollectionName);

    return {
      systemCollection: systemExists || systemCreated,
      userCollection: userExists || userCreated,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const systemCollectionName = config.vectorStore.systemKnowledgeCollection;
      await this.collectionManager.collectionExists(systemCollectionName);
      return true;
    } catch (err) {
      logger.warn({ err }, 'Qdrant VectorStore health check failed');
      return false;
    }
  }
}
