import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';

export function useMessagesQuery(notebookId: string | null) {
  return useQuery({
    queryKey: ['messages', notebookId],
    queryFn: () => (notebookId ? chatApi.getMessages(notebookId) : []),
    enabled: !!notebookId,
  });
}
