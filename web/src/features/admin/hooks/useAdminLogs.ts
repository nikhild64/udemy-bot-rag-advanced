import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, ListLogsParams } from '../api/admin.api';

export const ADMIN_KEYS = {
  status: ['admin', 'status'] as const,
  logs: (params: ListLogsParams) => ['admin', 'logs', params] as const,
  stats: ['admin', 'stats'] as const,
};

export function useAdminStatusQuery() {
  return useQuery({
    queryKey: ADMIN_KEYS.status,
    queryFn: () => adminApi.getAdminStatus(),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAdminLogsQuery(params: ListLogsParams, refetchIntervalMs: number | false = 3000) {
  return useQuery({
    queryKey: ADMIN_KEYS.logs(params),
    queryFn: () => adminApi.getLogs(params),
    refetchInterval: refetchIntervalMs,
  });
}

export function useAdminStatsQuery(refetchIntervalMs: number | false = 3000) {
  return useQuery({
    queryKey: ADMIN_KEYS.stats,
    queryFn: () => adminApi.getLogStats(),
    refetchInterval: refetchIntervalMs,
  });
}

export function useDeleteAllLogsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminApi.deleteAllLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
