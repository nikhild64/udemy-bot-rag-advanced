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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle favorite status');
    },
  });
}
