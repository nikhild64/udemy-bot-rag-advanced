import { apiClient } from '@/shared/api/client';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface SystemLogItem {
  id: string;
  level: LogLevel;
  message: string;
  context?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ListLogsParams {
  level?: LogLevel | 'ALL';
  search?: string;
  context?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedLogsResponse {
  success: boolean;
  data: SystemLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LogStatsResponse {
  success: boolean;
  data: {
    total: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
  };
}

export interface AdminMeResponse {
  success: boolean;
  data: {
    userId?: string;
    isAdmin: boolean;
    role: string;
  };
}

export const adminApi = {
  async getAdminStatus(): Promise<AdminMeResponse> {
    return apiClient.get<AdminMeResponse>('/api/v1/admin/me');
  },

  async getLogs(params: ListLogsParams = {}): Promise<PaginatedLogsResponse> {
    const searchParams = new URLSearchParams();
    if (params.level && params.level !== 'ALL') {
      searchParams.set('level', params.level);
    }
    if (params.search) {
      searchParams.set('search', params.search);
    }
    if (params.context) {
      searchParams.set('context', params.context);
    }
    if (params.page) {
      searchParams.set('page', String(params.page));
    }
    if (params.limit) {
      searchParams.set('limit', String(params.limit));
    }

    const queryStr = searchParams.toString();
    const url = `/api/v1/admin/logs${queryStr ? `?${queryStr}` : ''}`;
    return apiClient.get<PaginatedLogsResponse>(url);
  },

  async getLogStats(): Promise<LogStatsResponse> {
    return apiClient.get<LogStatsResponse>('/api/v1/admin/logs/stats');
  },

  async deleteAllLogs(): Promise<{ success: boolean; deletedCount: number }> {
    return apiClient.delete<{ success: boolean; deletedCount: number }>('/api/v1/admin/logs');
  },
};
