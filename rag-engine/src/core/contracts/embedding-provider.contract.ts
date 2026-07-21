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

  /**
   * Generates embedding for a single text string.
   * @param text Text string to embed.
   * @returns Promise resolving to an embedding vector.
   */
  embedSingle?(text: string): Promise<number[]>;

  /**
   * Alias for embed() when explicitly operating in batch mode.
   */
  embedBatch?(texts: string[]): Promise<number[][]>;

  /**
   * Optional provider metadata properties.
   */
  readonly providerName?: string;
  readonly modelName?: string;
  readonly dimension?: number;
}

