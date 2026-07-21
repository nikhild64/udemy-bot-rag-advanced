import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { Citation } from '../../retrieval/Citation';

/**
 * Represents an event emitted during chat streaming.
 */
export type ChatStreamEvent =
  | { type: 'start' }
  | { type: 'token'; data: string }
  | { type: 'citation'; data: Citation }
  | { type: 'done' }
  | { type: 'error'; data: { message: string } };

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
export interface ChatPipelineResponse {
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
  chat(request: ChatRequest): Promise<ChatPipelineResponse>;

  /**
   * Executes the RAG pipeline and streams the response incrementally.
   * @param request The user's chat request containing the query and options.
   * @returns An async iterable yielding stream events.
   */
  stream(request: ChatRequest): AsyncIterable<ChatStreamEvent>;
}
