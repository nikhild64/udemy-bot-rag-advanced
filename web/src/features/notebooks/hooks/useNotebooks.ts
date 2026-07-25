import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notebooksApi } from '../api/notebooks.api';
import { useUIStore } from '@/shared/lib/store';
import { useAuth } from '@clerk/nextjs';

export function useNotebooksQuery() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['notebooks'],
    queryFn: () => notebooksApi.listNotebooks(),
    enabled: isLoaded && isSignedIn,
  });
}

export function useNotebookQuery(id: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['notebook', id],
    queryFn: () => (id ? notebooksApi.getNotebook(id) : null),
    enabled: !!id && isLoaded && isSignedIn,
  });
}

export function useCreateNotebookMutation() {
  const queryClient = useQueryClient();
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const setCreateNotebookModalOpen = useUIStore((s) => s.setCreateNotebookModalOpen);

  return useMutation({
    mutationFn: (data: { title: string; description?: string }) => notebooksApi.createNotebook(data),
    onSuccess: (newNotebook) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      setActiveNotebookId(newNotebook.id);
      setCreateNotebookModalOpen(false);
      toast.success(`Notebook "${newNotebook.title}" created successfully`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create notebook');
    },
  });
}

export function useUpdateNotebookMutation() {
  const queryClient = useQueryClient();
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string } }) =>
      notebooksApi.updateNotebook(id, data),
    onSuccess: (updatedNotebook) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['notebook', updatedNotebook.id] });
      setEditingNotebook(null);
      toast.success('Notebook updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update notebook');
    },
  });
}

export function useDeleteNotebookMutation() {
  const queryClient = useQueryClient();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);

  return useMutation({
    mutationFn: (id: string) => notebooksApi.deleteNotebook(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      if (activeNotebookId === deletedId) {
        setActiveNotebookId(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
      setDeletingNotebook(null);
      toast.success('Notebook deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete notebook');
    },
  });
}

export function useDuplicateNotebookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notebooksApi.duplicateNotebook(id),
    onSuccess: (dup) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success(`Duplicated notebook "${dup.title}"`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to duplicate notebook');
    },
  });
}

export function useArchiveNotebookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? notebooksApi.archiveNotebook(id) : notebooksApi.restoreNotebook(id),
    onSuccess: (nb) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success(nb.isArchived ? 'Notebook archived' : 'Notebook restored');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update notebook archive status');
    },
  });
}

export function useFavoriteNotebookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite?: boolean }) =>
      notebooksApi.favoriteNotebook(id, isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['notebooks'] });
      await queryClient.cancelQueries({ queryKey: ['notebook', id] });

      // Snapshot previous query data for rollback
      const previousNotebooks = queryClient.getQueryData(['notebooks']);
      const previousNotebook = queryClient.getQueryData(['notebook', id]);

      // Optimistically update 'notebooks' array query cache
      queryClient.setQueryData(['notebooks'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((nb: any) => {
          if (nb.id === id) {
            const nextFav = isFavorite !== undefined ? isFavorite : !nb.isFavorite;
            return { ...nb, isFavorite: nextFav };
          }
          return nb;
        });
      });

      // Optimistically update single 'notebook' query cache
      queryClient.setQueryData(['notebook', id], (old: any) => {
        if (!old) return old;
        const nextFav = isFavorite !== undefined ? isFavorite : !old.isFavorite;
        return { ...old, isFavorite: nextFav };
      });

      return { previousNotebooks, previousNotebook };
    },
    onSuccess: (updatedNotebook) => {
      if (!updatedNotebook?.id) return;
      // Directly confirm cache with authoritative server response (no refetch race condition)
      queryClient.setQueryData(['notebooks'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((nb: any) => (nb.id === updatedNotebook.id ? { ...nb, ...updatedNotebook } : nb));
      });
      queryClient.setQueryData(['notebook', updatedNotebook.id], (old: any) => {
        if (!old) return old;
        return { ...old, ...updatedNotebook };
      });
    },
    onError: (err: any, { id }, context: any) => {
      // Rollback to snapshot on error
      if (context?.previousNotebooks) {
        queryClient.setQueryData(['notebooks'], context.previousNotebooks);
      }
      if (context?.previousNotebook) {
        queryClient.setQueryData(['notebook', id], context.previousNotebook);
      }
      toast.error(err.message || 'Failed to toggle favorite status');
    },
  });
}
