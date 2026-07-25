import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';

export function useSuggestedQuestionsQuery(notebookId: string | null, messagesCount: number = 0) {
  return useQuery({
    queryKey: ['suggestedQuestions', notebookId, messagesCount],
    queryFn: () => (notebookId ? chatApi.getSuggestedQuestions(notebookId) : []),
    enabled: !!notebookId,
    staleTime: 5 * 60 * 1000,
  });
}
