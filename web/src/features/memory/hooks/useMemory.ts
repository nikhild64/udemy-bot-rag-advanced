import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchUserMemories, addUserMemory, deleteUserMemory, deleteAllUserMemories } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';

export function useUserMemoriesQuery() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  return useQuery({
    queryKey: ['userMemories'],
    queryFn: async () => {
      const token = await getToken();
      return fetchUserMemories(token);
    },
    enabled: isLoaded && isSignedIn,
    staleTime: 0,
  });
}

export function useAddUserMemoryMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (memoryText: string) => {
      const token = await getToken();
      return addUserMemory(memoryText, token);
    },
    onSuccess: (addedMemories) => {
      toast.success('Memory preference saved successfully');
      if (addedMemories && addedMemories.length > 0) {
        queryClient.setQueryData<any[]>(['userMemories'], (old = []) => {
          const existingIds = new Set(old.map((m) => m.id));
          const newUnique = addedMemories.filter((m) => !existingIds.has(m.id));
          return [...newUnique, ...old];
        });
      }
      // Immediate invalidation to fetch full server state
      queryClient.invalidateQueries({ queryKey: ['userMemories'] });

      // Follow-up invalidation after 2.5s to capture Mem0's async LLM extracted facts
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['userMemories'] });
      }, 2500);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add memory preference');
    },
  });
}

export function useDeleteUserMemoryMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (memoryId: string) => {
      const token = await getToken();
      return deleteUserMemory(memoryId, token);
    },
    onMutate: async (memoryId: string) => {
      await queryClient.cancelQueries({ queryKey: ['userMemories'] });
      const previousMemories = queryClient.getQueryData<any[]>(['userMemories']) || [];
      queryClient.setQueryData(
        ['userMemories'],
        previousMemories.filter((m) => m.id !== memoryId)
      );
      return { previousMemories };
    },
    onSuccess: () => {
      toast.success('Memory deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['userMemories'] });
    },
    onError: (err: any, _memoryId, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(['userMemories'], context.previousMemories);
      }
      toast.error(err.message || 'Failed to delete memory');
    },
  });
}

export function useClearAllUserMemoriesMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteAllUserMemories(token);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['userMemories'] });
      const previousMemories = queryClient.getQueryData<any[]>(['userMemories']) || [];
      queryClient.setQueryData(['userMemories'], []);
      return { previousMemories };
    },
    onSuccess: () => {
      toast.success('All personal memories cleared successfully');
      queryClient.invalidateQueries({ queryKey: ['userMemories'] });
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(['userMemories'], context.previousMemories);
      }
      toast.error(err.message || 'Failed to clear memories');
    },
  });
}
