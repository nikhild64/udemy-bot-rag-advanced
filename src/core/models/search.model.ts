import { Chunk } from './chunk.model';

/**
 * Represents a ranked search result returned from semantic similarity search.
 */
export interface SearchResult {
  readonly chunk: Chunk;
  readonly score: number;
}
