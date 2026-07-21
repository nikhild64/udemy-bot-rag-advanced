import { RetrievedChunk } from '../../retrieval/RetrievalResult';

/**
 * Request to build a prompt using retrieved context.
 */
export interface PromptBuildRequest {
  readonly query: string;
  readonly chunks: readonly RetrievedChunk[];
}

/**
 * Result of the prompt building process.
 */
export interface PromptBuildResult {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly combinedPrompt: string;
  readonly contextChunks: number;
  readonly contextCharacters: number;
}
