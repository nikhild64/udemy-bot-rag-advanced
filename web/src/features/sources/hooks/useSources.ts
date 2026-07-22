import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sourcesApi } from '../api/sources.api';
import { SourceStatus } from '@/shared/types';

export function useSourcesQuery(notebookId: string | null) {
  return useQuery({
    queryKey: ['sources', notebookId],
    queryFn: () => (notebookId ? sourcesApi.listSources(notebookId) : []),
    enabled: !!notebookId,
  });
}

export function useSourceStatusQuery(sourceId: string, currentStatus: SourceStatus) {
  const queryClient = useQueryClient();
  const shouldPoll = currentStatus === 'Queued' || currentStatus === 'Processing' || currentStatus === 'Uploaded';

  return useQuery({
    queryKey: ['sourceStatus', sourceId],
    queryFn: async () => {
      const statusData = await sourcesApi.getSourceStatus(sourceId);
      // Invalidate sources list when completion/failure reached
      if (statusData.status === 'Indexed' || statusData.status === 'Failed') {
        queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      return statusData;
    },
    enabled: !!sourceId && shouldPoll,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'Indexed' || data?.status === 'Failed') {
        return false;
      }
      return 2000;
    },
  });
}

export function useDeleteSourceMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.deleteSource(sourceId),
    onSuccess: () => {
      if (notebookId) {
        queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
      }
      toast.success('Source deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete source');
    },
  });
}
