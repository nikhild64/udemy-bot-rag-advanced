import { apiClient } from '@/shared/api/client';
import { Message, ListMessagesResponse, Citation, ChatRequestOptions } from '@/shared/types';

export const chatApi = {
  getMessages: async (notebookId: string): Promise<Message[]> => {
    const res = await apiClient.get<ListMessagesResponse | Message[]>(`/api/notebooks/${notebookId}/messages`);
    const rawList = Array.isArray(res) ? res : (res as ListMessagesResponse).data || [];
    return rawList.map((msg) => ({
      ...msg,
      role: (msg.role ? String(msg.role).toLowerCase() : 'assistant') as 'user' | 'assistant' | 'system',
    }));
  },

  chat: async (notebookId: string, query: string): Promise<{
    message: Message;
    citations: Citation[];
  }> => {
    return apiClient.post<{ message: Message; citations: Citation[] }>(
      `/api/notebooks/${notebookId}/chat`,
      { query } as ChatRequestOptions,
    );
  },

  streamChat: async (
    notebookId: string,
    query: string,
    onToken: (token: string) => void,
    onCitation: (citation: Citation) => void,
    onDone: (data: { messageId?: string }) => void,
    onError: (err: Error) => void
  ): Promise<void> => {
    return apiClient.streamChat(
      `/api/notebooks/${notebookId}/chat/stream`,
      { query },
      onToken,
      onCitation,
      onDone,
      onError
    );
  },

  deleteMessageAndSubsequent: async (
    notebookId: string,
    messageId: string,
  ): Promise<{ success: boolean; deletedCount: number }> => {
    return apiClient.delete<{ success: boolean; deletedCount: number }>(
      `/api/notebooks/${notebookId}/messages/${messageId}`,
    );
  },

  getSuggestedQuestions: async (notebookId: string): Promise<string[]> => {
    const res = await apiClient.get<{ questions: string[] }>(`/api/notebooks/${notebookId}/suggested-questions`);
    return res?.questions || [];
  },
};
