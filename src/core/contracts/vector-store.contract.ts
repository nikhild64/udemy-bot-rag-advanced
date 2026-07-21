import { Chunk, SearchResult } from '../models';

/**
 * Information about a vector store collection.
 * Pure domain contract type without provider SDK dependencies.
 */
export interface VectorStoreCollectionInfo {
  readonly name: string;
  readonly status: string;
  readonly vectorsCount: number;
  readonly pointsCount: number;
  readonly segmentsCount?: number;
  readonly dimension?: number;
  readonly distanceMetric?: string;
  readonly config?: Record<string, unknown>;
}

/**
 * Contract for vector storage and semantic search databases.
 * Provider-agnostic interface exposing collection management and vector operations.
 */
export interface VectorStore {
  /**
   * Creates a vector collection with the specified or configured dimension and metric.
   */
  createCollection(collectionName?: string, dimension?: number, metric?: string): Promise<boolean>;

  /**
   * Deletes a vector collection by name.
   */
  deleteCollection(collectionName?: string): Promise<boolean>;

  /**
   * Checks whether a vector collection exists.
   */
  collectionExists(collectionName?: string): Promise<boolean>;

  /**
   * Retrieves summary information and statistics about a vector collection.
   */
  getCollectionInfo(collectionName?: string): Promise<VectorStoreCollectionInfo | null>;

  /**
   * Validates a vector collection existence and dimension against requirements.
   */
  validateCollection(collectionName?: string, expectedDimension?: number): Promise<boolean>;

  /**
   * Stores chunks alongside their corresponding embedding vectors.
   * @param chunks Array of domain chunk items to store.
   * @param embeddings Array of embedding vectors corresponding to each chunk.
   * @param collectionName Optional collection name to target (defaults to configured collection).
   */
  upsert(chunks: Chunk[], embeddings: number[][], collectionName?: string): Promise<void>;

  /**
   * Performs semantic similarity search using a query vector.
   * @param queryEmbedding The vector representation of the search query.
   * @param limit Optional maximum number of search results to return.
   * @param collectionName Optional collection name to target (defaults to configured collection).
   * @param filters Optional metadata filters to apply to the search.
   */
  search(queryEmbedding: number[], limit?: number, collectionName?: string, filters?: Record<string, unknown>): Promise<SearchResult[]>;

  /**
   * Deletes vectors by their unique IDs from the target collection.
   * @param ids Array of chunk IDs to delete.
   * @param collectionName Optional collection name to target (defaults to configured collection).
   */
  deleteVectors(ids: string[], collectionName?: string): Promise<boolean>;
}
