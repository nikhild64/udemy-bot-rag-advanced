import { Message, MessageRole } from '@prisma/client';
import { ChatMessage } from '@/core/models';
import { MemoryItem } from '@/core/contracts/memory-provider.contract';
import { ChatRole } from '@/types';
import { formatUserMemories } from '@/prompts/templates';

export interface BuildNotebookPromptOptions {
  query: string;
  context: string;
  history?: Message[];
  notebookTitle?: string;
  memories?: readonly MemoryItem[];
}

export class NotebookPromptBuilder {
  public static readonly SYSTEM_PROMPT = `You are a helpful, intelligent AI Assistant. Answer the user's questions directly, naturally, and conversationally based on the provided Notebook knowledge context.

Rules for response generation:
1. Speak naturally, warmly, and helpfully. Answer the question immediately without preamble.
2. CRITICAL: Do NOT start your responses with robotic meta-disclaimers such as "Based on the provided notebook context...", "According to the retrieved context...", or "Based on the notebook sources...". Simply provide the factual answer directly.
3. Rely strictly on the provided Notebook context for facts. Do NOT hallucinate information or rely on unverified external knowledge.
4. If the provided context does not contain the answer, politely state that the information is not available in your notebook sources.
5. Do NOT attempt to format or generate citation tags manually; citations are verified and attached automatically by the system.
6. Use clean, plain markdown for formatting when appropriate.`;

  /**
   * Builds the formatted ChatMessage array to pass to the ChatProvider.
   */
  public buildPrompt(options: BuildNotebookPromptOptions): ChatMessage[] {
    const { query, context, history = [], notebookTitle, memories = [] } = options;

    let systemPromptText = notebookTitle
      ? `${NotebookPromptBuilder.SYSTEM_PROMPT}\n\nCurrent Notebook Context: "${notebookTitle}"`
      : NotebookPromptBuilder.SYSTEM_PROMPT;

    if (memories && memories.length > 0) {
      const formattedMemories = formatUserMemories(memories);
      if (formattedMemories) {
        systemPromptText += `\n\n${formattedMemories}`;
      }
    }

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
