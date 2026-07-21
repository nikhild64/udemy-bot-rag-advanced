import { ChatMessage, ChatResponse, ChatTask, ChatChunk } from '../models';

export interface ChatProviderOptions {
  task: ChatTask;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Contract for conversational AI providers.
 * Provider-agnostic interface for generating chat responses given message history.
 */
export interface ChatProvider {
  /**
   * Generates a chat response given an array of conversation messages.
   * @param messages Array of chat messages representing the conversation history.
   * @param options Configuration options, requiring a specific task identifier.
   * @returns Promise resolving to the chat response.
   */
  generateResponse(messages: ChatMessage[], options: ChatProviderOptions): Promise<ChatResponse>;

  /**
   * Generates a chat response as a stream of chunks given an array of conversation messages.
   * @param messages Array of chat messages representing the conversation history.
   * @param options Configuration options, requiring a specific task identifier.
   * @returns An async iterable yielding chat chunks.
   */
  streamResponse(messages: ChatMessage[], options: ChatProviderOptions): AsyncIterable<ChatChunk>;
}
