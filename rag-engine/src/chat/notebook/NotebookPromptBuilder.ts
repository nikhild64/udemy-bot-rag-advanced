import { Message, MessageRole } from '@prisma/client';
import { ChatMessage } from '@/core/models';
import { ChatRole } from '@/types';

export interface BuildNotebookPromptOptions {
  query: string;
  context: string;
  history?: Message[];
  notebookTitle?: string;
}

export class NotebookPromptBuilder {
  public static readonly SYSTEM_PROMPT = `You are an intelligent AI Notebook Assistant. Your goal is to answer the user's questions based strictly on the retrieved Notebook context provided below.

Rules for response generation:
1. Rely primarily on the provided Notebook context to construct your answer.
2. Maintain a clear, factual, helpful, and concise tone.
3. If the context does not contain sufficient details to answer the query, clearly state what information is missing.
4. Do NOT attempt to format or generate citation tags manually; citations are attached automatically by the retrieval engine based on source verification.
5. Use plain markdown for formatting when appropriate.`;

  /**
   * Builds the formatted ChatMessage array to pass to the ChatProvider.
   */
  public buildPrompt(options: BuildNotebookPromptOptions): ChatMessage[] {
    const { query, context, history = [], notebookTitle } = options;

    const systemPromptText = notebookTitle
      ? `${NotebookPromptBuilder.SYSTEM_PROMPT}\n\nCurrent Notebook Context: "${notebookTitle}"`
      : NotebookPromptBuilder.SYSTEM_PROMPT;

    const messages: ChatMessage[] = [
      {
        role: ChatRole.SYSTEM,
        content: systemPromptText,
      },
    ];

    // Include recent history (excluding system messages or empty messages, excluding current query)
    if (history && history.length > 0) {
      // Filter valid user and assistant history items
      const validHistory = history.filter(
        (msg) =>
          (msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT) &&
          msg.content &&
          msg.content.trim().length > 0,
      );

      // Limit to last 10 messages for context window management
      const recentHistory = validHistory.slice(-10);

      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === MessageRole.USER ? ChatRole.USER : ChatRole.ASSISTANT,
          content: msg.content,
        });
      }
    }

    // Format current turn with Notebook Context and User Query
    const formattedUserPrompt = context && context.trim().length > 0
      ? `Retrieved Notebook Context:\n${context}\n\nUser Question:\n${query}`
      : `User Question:\n${query}`;

    messages.push({
      role: ChatRole.USER,
      content: formattedUserPrompt,
    });

    return messages;
  }
}
