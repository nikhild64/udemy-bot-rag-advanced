import { QdrantClient } from '@qdrant/js-client-rest';
import { VectorStoreCollectionInfo } from '@/core/contracts/vector-store.contract';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { ProviderError, NotFoundError, ValidationError } from '@/shared/errors';

export interface ICollectionManager {
  createCollection(collectionName?: string, dimension?: number, metric?: string): Promise<boolean>;
  deleteCollection(collectionName?: string): Promise<boolean>;
  collectionExists(collectionName?: string): Promise<boolean>;
  getCollectionInfo(collectionName?: string): Promise<VectorStoreCollectionInfo | null>;
  validateCollection(collectionName?: string, expectedDimension?: number): Promise<boolean>;
}

export interface CollectionManagerOptions {
  readonly collectionName?: string;
  readonly distanceMetric?: string;
  readonly client?: QdrantClient;
  readonly url?: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
}

export class CollectionManager implements ICollectionManager {
  private readonly client: QdrantClient;
  private readonly defaultCollectionName: string;
  private readonly defaultDistanceMetric: string;

  constructor(clientOrOptions?: QdrantClient | CollectionManagerOptions, options?: CollectionManagerOptions) {
    if (clientOrOptions && 'collectionExists' in clientOrOptions && typeof clientOrOptions.collectionExists === 'function') {
      this.client = clientOrOptions as QdrantClient;
      this.defaultCollectionName = options?.collectionName ?? config.vectorStore.vectorCollectionName ?? config.vectorStore.collectionName;
      this.defaultDistanceMetric = options?.distanceMetric ?? config.vectorStore.distanceMetric;
    } else {
      const opts = clientOrOptions as CollectionManagerOptions | undefined;
      if (opts?.client) {
        this.client = opts.client;
      } else {
        const url = opts?.url ?? config.vectorStore.qdrantUrl;
        const apiKey = opts?.apiKey ?? config.vectorStore.qdrantApiKey;
        const timeout = opts?.timeoutMs ?? config.vectorStore.timeoutMs;
        this.client = new QdrantClient({ url, apiKey, timeout, checkCompatibility: false });
      }
      this.defaultCollectionName = opts?.collectionName ?? config.vectorStore.vectorCollectionName ?? config.vectorStore.collectionName;
      this.defaultDistanceMetric = opts?.distanceMetric ?? config.vectorStore.distanceMetric;
    }
  }

  async collectionExists(collectionName?: string): Promise<boolean> {
    const name = collectionName ?? this.defaultCollectionName;
    try {
      const res = await this.client.collectionExists(name);
      return res.exists;
    } catch (err) {
      this.handleQdrantError(err, name);
    }
  }

  async getCollectionInfo(collectionName?: string): Promise<VectorStoreCollectionInfo | null> {
    const name = collectionName ?? this.defaultCollectionName;
    const exists = await this.collectionExists(name);
    if (!exists) {
      return null;
    }

    try {
      const info = await this.client.getCollection(name);
      let dimension: number | undefined;
      let distanceMetric: string | undefined;

      const vectorsConfig = info.config?.params?.vectors;
      if (vectorsConfig && typeof vectorsConfig === 'object') {
        if ('size' in vectorsConfig && typeof (vectorsConfig as Record<string, unknown>).size === 'number') {
          dimension = Number((vectorsConfig as Record<string, unknown>).size);
          if (typeof (vectorsConfig as Record<string, unknown>).distance === 'string') {
            distanceMetric = String((vectorsConfig as Record<string, unknown>).distance);
          }
        } else {
          const keys = Object.keys(vectorsConfig);
          if (keys.length > 0 && keys[0] !== undefined) {
            const firstVector = (vectorsConfig as Record<string, Record<string, unknown>>)[keys[0]];
            if (firstVector && typeof firstVector.size === 'number') {
              dimension = Number(firstVector.size);
              if (typeof firstVector.distance === 'string') {
                distanceMetric = String(firstVector.distance);
              }
            }
          }
        }
      }

      return {
        name,
        status: String(info.status),
        vectorsCount: info.vectors_count ?? 0,
        pointsCount: info.points_count ?? 0,
        segmentsCount: info.segments_count ?? 0,
        dimension,
        distanceMetric,
        config: info.config as Record<string, unknown> | undefined,
      };
    } catch (err) {
      this.handleQdrantError(err, name);
    }
  }

  async createCollection(collectionName?: string, dimension?: number, metric?: string): Promise<boolean> {
    const name = collectionName ?? this.defaultCollectionName;
    const dim = dimension ?? config.embeddings.dimension ?? 1024;
    const dist = metric ?? this.defaultDistanceMetric;

    const exists = await this.collectionExists(name);
    if (exists) {
      logger.info({ collectionName: name }, 'Collection already exists');
      return false;
    }

    try {
      await this.client.createCollection(name, {
        vectors: {
          size: dim,
          distance: dist as 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan',
        },
      });
      logger.info({ collectionName: name, dimension: dim, distanceMetric: dist }, 'Collection created');
      return true;
    } catch (err) {
      this.handleQdrantError(err, name);
    }
  }

  async deleteCollection(collectionName?: string): Promise<boolean> {
    const name = collectionName ?? this.defaultCollectionName;
    const exists = await this.collectionExists(name);
    if (!exists) {
      throw new NotFoundError(`Collection '${name}' not found`);
    }

    try {
      await this.client.deleteCollection(name);
      logger.info({ collectionName: name }, 'Collection deleted');
      return true;
    } catch (err) {
      this.handleQdrantError(err, name);
    }
  }

  async validateCollection(collectionName?: string, expectedDimension?: number): Promise<boolean> {
    const name = collectionName ?? this.defaultCollectionName;
    const exists = await this.collectionExists(name);
    if (!exists) {
      throw new NotFoundError(`Collection '${name}' not found`);
    }

    const info = await this.getCollectionInfo(name);
    if (!info) {
      throw new NotFoundError(`Collection '${name}' not found`);
    }

    const expectedDim = expectedDimension ?? config.embeddings.dimension ?? 1024;
    if (info.dimension !== undefined && info.dimension !== expectedDim) {
      throw new ValidationError(
        `Vector dimension mismatch for collection '${name}': expected ${expectedDim}, got ${info.dimension}`,
      );
    }

    return true;
  }

  handleQdrantError(err: unknown, collectionName: string): never {
    if (err instanceof ProviderError || err instanceof NotFoundError || err instanceof ValidationError) {
      throw err;
    }

    const status = err && typeof err === 'object' && 'status' in err ? Number((err as Record<string, unknown>).status) : undefined;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 401 || status === 403 || message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('API key')) {
      throw new ProviderError(`Authentication failure with Qdrant Cloud: ${message}`, { statusCode: status ?? 401, cause: err instanceof Error ? err : undefined });
    }

    if (status === 404 || message.toLowerCase().includes('not found') || message.toLowerCase().includes("doesn't exist")) {
      throw new NotFoundError(`Collection '${collectionName}' not found`, { cause: err instanceof Error ? err : undefined });
    }

    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('Connection refused') ||
      message.includes('Failed to fetch') ||
      message.includes('network')
    ) {
      throw new ProviderError(`Connection failure with Qdrant Cloud: ${message}`, { statusCode: 503, cause: err instanceof Error ? err : undefined });
    }

    if (message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('abort')) {
      throw new ProviderError(`Timeout connecting to Qdrant Cloud: ${message}`, { statusCode: 504, cause: err instanceof Error ? err : undefined });
    }

    throw new ProviderError(`Qdrant Cloud operation failed: ${message}`, { statusCode: status ?? 502, cause: err instanceof Error ? err : undefined });
  }
}
