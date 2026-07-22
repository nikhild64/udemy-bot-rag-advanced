import { apiClient } from '@/shared/api/client';
import { Message, ListMessagesResponse, Citation } from '@/shared/types';

export const chatApi = {
  getMessages: async (notebookId: string): Promise<Message[]> => {
    const res = await apiClient.get<ListMessagesResponse | Message[]>(`/api/notebooks/${notebookId}/messages`);
    if (Array.isArray(res)) return res;
    return res.data || [];
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
};
