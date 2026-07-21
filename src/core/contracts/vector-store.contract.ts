import { Chunk, SearchResult } from '../models';

/**
 * Contract for vector storage and semantic search databases.
 * Provider-agnostic interface for indexing chunks and searching by vector similarity.
 */
export interface VectorStore {
  /**
   * Stores chunks alongside their corresponding embedding vectors.
   * @param chunks Array of domain chunk items to store.
   * @param embeddings Array of embedding vectors corresponding to each chunk.
   */
  upsert(chunks: Chunk[], embeddings: number[][]): Promise<void>;

  /**
   * Performs semantic similarity search using a query vector.
   * @param queryEmbedding The vector representation of the search query.
   * @param limit Optional maximum number of search results to return.
   * @returns Promise resolving to an array of ranked search results.
   */
  search(queryEmbedding: number[], limit?: number): Promise<SearchResult[]>;
}
