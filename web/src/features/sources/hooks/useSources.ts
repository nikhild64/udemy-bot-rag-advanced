import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sourcesApi } from '../api/sources.api';
import { SourceStatus } from '@/shared/types';
import { useAuth } from '@clerk/nextjs';

export function useSourcesQuery(notebookId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['sources', notebookId],
    queryFn: () => (notebookId ? sourcesApi.listSources(notebookId) : []),
    enabled: !!notebookId && isLoaded && isSignedIn,
    refetchInterval: (query) => {
      const sources = query.state.data;
      if (!sources || !Array.isArray(sources)) return false;
      const isProcessing = sources.some((s) =>
        ['PendingUpload', 'Uploading', 'Uploaded', 'Queued', 'Downloading', 'Extracting', 'Normalizing', 'Chunking', 'Embedding', 'Indexing', 'Deleting'].includes(s.status)
      );
      return isProcessing ? 1500 : false;
    },
  });
}

export function useSourceStatusQuery(sourceId: string, currentStatus: SourceStatus) {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isProcessing = ['Downloading', 'Extracting', 'Normalizing', 'Chunking', 'Embedding', 'Indexing', 'Deleting'].includes(currentStatus);
  const shouldPoll = currentStatus === 'Queued' || isProcessing || currentStatus === 'Uploading';

  return useQuery({
    queryKey: ['sourceStatus', sourceId],
    queryFn: async () => {
      const statusData = await sourcesApi.getSourceStatus(sourceId);
      // Invalidate sources list when completion/failure reached
      if (statusData.status === 'Ready' || statusData.status === 'Failed') {
        queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      return statusData;
    },
    enabled: !!sourceId && shouldPoll && isLoaded && isSignedIn,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'Ready' || data?.status === 'Failed') {
        return false;
      }
      return 1500;
    },
  });
}

export function useDeleteSourceMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.deleteSource(sourceId),
    onMutate: async (sourceId: string) => {
      toast.loading('Deleting source...', { id: `delete-${sourceId}` });
      if (notebookId) {
        await queryClient.cancelQueries({ queryKey: ['sources', notebookId] });
        const previousSources = queryClient.getQueryData(['sources', notebookId]);
        queryClient.setQueryData(['sources', notebookId], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((s: any) =>
            s.id === sourceId ? { ...s, status: 'Deleting', progress: 50, currentStage: 'Deleting...' } : s,
          );
        });
        return { previousSources };
      }
    },
    onSuccess: (_, sourceId) => {
      toast.success('Source deleted successfully', { id: `delete-${sourceId}` });
    },
    onError: (err: any, sourceId, context: any) => {
      if (notebookId && context?.previousSources) {
        queryClient.setQueryData(['sources', notebookId], context.previousSources);
      }
      toast.error(err.message || 'Failed to delete source', { id: `delete-${sourceId}` });
    },
    onSettled: () => {
      if (notebookId) {
        queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
      }
    },
  });
}

export function useReindexSourceMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.reindexSource(sourceId),
    onMutate: async (sourceId: string) => {
      toast.loading('Triggering re-index...', { id: `reindex-${sourceId}` });
      if (notebookId) {
        await queryClient.cancelQueries({ queryKey: ['sources', notebookId] });
        const previousSources = queryClient.getQueryData(['sources', notebookId]);
        queryClient.setQueryData(['sources', notebookId], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((s: any) =>
            s.id === sourceId
              ? { ...s, status: 'Indexing', progress: 10, currentStage: 'Queued for Re-indexing...' }
              : s,
          );
        });
        return { previousSources };
      }
    },
    onSuccess: (_, sourceId) => {
      toast.success('Re-indexing in progress...', { id: `reindex-${sourceId}` });
    },
    onError: (err: any, sourceId, context: any) => {
      if (notebookId && context?.previousSources) {
        queryClient.setQueryData(['sources', notebookId], context.previousSources);
      }
      toast.error(err.message || 'Failed to re-index source', { id: `reindex-${sourceId}` });
    },
    onSettled: (_, __, sourceId) => {
      if (notebookId) {
        queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
        queryClient.invalidateQueries({ queryKey: ['sourceStatus', sourceId] });
      }
    },
  });
}

export function useRetrySourceMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.retrySource(sourceId),
    onMutate: async (sourceId: string) => {
      toast.loading('Retrying ingestion...', { id: `retry-${sourceId}` });
      if (notebookId) {
        await queryClient.cancelQueries({ queryKey: ['sources', notebookId] });
        const previousSources = queryClient.getQueryData(['sources', notebookId]);
        queryClient.setQueryData(['sources', notebookId], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((s: any) =>
            s.id === sourceId ? { ...s, status: 'Queued', progress: 5, currentStage: 'Retrying Ingestion...' } : s,
          );
        });
        return { previousSources };
      }
    },
    onSuccess: (_, sourceId) => {
      toast.success('Ingestion retry started', { id: `retry-${sourceId}` });
    },
    onError: (err: any, sourceId, context: any) => {
      if (notebookId && context?.previousSources) {
        queryClient.setQueryData(['sources', notebookId], context.previousSources);
      }
      toast.error(err.message || 'Failed to retry source ingestion', { id: `retry-${sourceId}` });
    },
    onSettled: (_, __, sourceId) => {
      if (notebookId) {
        queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
        queryClient.invalidateQueries({ queryKey: ['sourceStatus', sourceId] });
      }
    },
  });
}

export function useCancelSourceMutation(notebookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.cancelSource(sourceId),
    onMutate: async (sourceId: string) => {
      toast.loading('Cancelling processing...', { id: `cancel-${sourceId}` });
    },
    onSuccess: (_, sourceId) => {
      if (notebookId) queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
      toast.info('Source processing cancelled', { id: `cancel-${sourceId}` });
    },
    onError: (err: any, sourceId) => {
      toast.error(err.message || 'Failed to cancel source processing', { id: `cancel-${sourceId}` });
    },
  });
}

export function useNotebookArtifactsQuery(notebookId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['notebookArtifacts', notebookId],
    queryFn: () => (notebookId ? sourcesApi.getNotebookArtifacts(notebookId) : null),
    enabled: !!notebookId && isLoaded && isSignedIn,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isGenerating =
        data.podcast?.status === 'GENERATING' ||
        data.learningPath?.status === 'GENERATING' ||
        data.flashcards?.status === 'GENERATING';
      return isGenerating ? 2000 : false;
    },
  });
}

export function useGeneratePodcastMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ notebookId, force }: { notebookId: string; force?: boolean }) =>
      sourcesApi.generatePodcast(notebookId, force),
    onMutate: async ({ notebookId }) => {
      // Optimistically update query cache immediately on click
      queryClient.setQueryData(['notebookArtifacts', notebookId], (old: any) => ({
        ...old,
        podcast: { status: 'GENERATING', data: old?.podcast?.data || null, error: null },
      }));
    },
    onSuccess: (res, variables) => {
      if (res.status === 'READY' && res.result) {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          podcast: { status: 'READY', data: res.result, error: null },
        }));
      } else {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          podcast: { status: res.status || 'GENERATING', data: old?.podcast?.data || null, error: null },
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['notebookArtifacts', variables.notebookId] });
    },
    onError: (err: any, variables) => {
      queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
        ...old,
        podcast: { status: 'FAILED', data: null, error: err.message || 'Generation failed' },
      }));
      toast.error(err.message || 'Failed to generate podcast script');
    },
  });
}

export function useGenerateLearningPathMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ notebookId, force }: { notebookId: string; force?: boolean }) =>
      sourcesApi.generateLearningPath(notebookId, force),
    onMutate: async ({ notebookId }) => {
      // Optimistically update query cache immediately on click
      queryClient.setQueryData(['notebookArtifacts', notebookId], (old: any) => ({
        ...old,
        learningPath: { status: 'GENERATING', data: old?.learningPath?.data || null, error: null },
      }));
    },
    onSuccess: (res, variables) => {
      if (res.status === 'READY' && res.result) {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          learningPath: { status: 'READY', data: res.result, error: null },
        }));
      } else {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          learningPath: { status: res.status || 'GENERATING', data: old?.learningPath?.data || null, error: null },
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['notebookArtifacts', variables.notebookId] });
    },
    onError: (err: any, variables) => {
      queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
        ...old,
        learningPath: { status: 'FAILED', data: null, error: err.message || 'Generation failed' },
      }));
      toast.error(err.message || 'Failed to generate learning path');
    },
  });
}

export function useGenerateFlashcardsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ notebookId, force, count }: { notebookId: string; force?: boolean; count?: number }) =>
      sourcesApi.generateFlashcards(notebookId, { force, count }),
    onMutate: async ({ notebookId }) => {
      queryClient.setQueryData(['notebookArtifacts', notebookId], (old: any) => ({
        ...old,
        flashcards: { status: 'GENERATING', data: old?.flashcards?.data || null, error: null },
      }));
    },
    onSuccess: (res, variables) => {
      if (res.status === 'READY' && res.result) {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          flashcards: { status: 'READY', data: res.result, error: null },
        }));
      } else {
        queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
          ...old,
          flashcards: { status: res.status || 'GENERATING', data: old?.flashcards?.data || null, error: null },
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['notebookArtifacts', variables.notebookId] });
    },
    onError: (err: any, variables) => {
      queryClient.setQueryData(['notebookArtifacts', variables.notebookId], (old: any) => ({
        ...old,
        flashcards: { status: 'FAILED', data: null, error: err.message || 'Generation failed' },
      }));
      toast.error(err.message || 'Failed to generate flashcards');
    },
  });
}
