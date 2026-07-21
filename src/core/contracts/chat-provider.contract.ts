import { ChatMessage, ChatResponse } from '../models';

/**
 * Contract for conversational AI providers.
 * Provider-agnostic interface for generating chat responses given message history.
 */
export interface ChatProvider {
  /**
   * Generates a chat response given an array of conversation messages.
   * @param messages Array of chat messages representing the conversation history.
   * @returns Promise resolving to the chat response.
   */
  generateResponse(messages: ChatMessage[]): Promise<ChatResponse>;
}
