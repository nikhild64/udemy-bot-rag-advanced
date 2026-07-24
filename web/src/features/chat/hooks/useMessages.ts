import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { chatApi } from '../api/chat.api';

export function useMessagesQuery(notebookId: string | null) {
  return useQuery({
    queryKey: ['messages', notebookId],
    queryFn: () => (notebookId ? chatApi.getMessages(notebookId) : []),
    enabled: !!notebookId,
  });
}

export function useDeleteMessageMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => {
      if (!notebookId) throw new Error('Notebook ID required');
      return chatApi.deleteMessageAndSubsequent(notebookId, messageId);
    },
    onSuccess: (data) => {
      if (notebookId) {
        queryClient.invalidateQueries({ queryKey: ['messages', notebookId] });
      }
      toast.success(
        data.deletedCount > 1
          ? `Deleted message and ${data.deletedCount - 1} subsequent messages`
          : 'Message deleted',
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete message');
    },
  });
}
