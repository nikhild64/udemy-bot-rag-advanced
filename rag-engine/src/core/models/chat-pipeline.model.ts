import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { Citation } from '../../retrieval/RetrievalResult';

/**
 * Represents the incoming chat request from a user.
 */
export interface ChatRequest {
  readonly query: string;
  readonly topK?: number;
  readonly filters?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Represents the final answer returned by the RAG pipeline.
 */
export interface ChatResponse {
  readonly answer: string;
  readonly citations?: Citation[];
  readonly retrievedChunks?: RetrievedChunk[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Defines the contract for the Chat Pipeline orchestration layer.
 */
export interface ChatPipeline {
  /**
   * Executes the full RAG pipeline to answer the user's query.
   * @param request The user's chat request containing the query and options.
   * @returns The generated response, including the answer, citations, and metadata.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
}
