/**
 * Contract for embedding generation providers.
 * Provider-agnostic interface for converting text strings into vector representations.
 */
export interface EmbeddingProvider {
  /**
   * Generates embeddings for a batch of text strings.
   * @param texts Array of text strings to embed.
   * @returns Promise resolving to a 2D array of embedding vectors.
   */
  embed(texts: string[]): Promise<number[][]>;
}
