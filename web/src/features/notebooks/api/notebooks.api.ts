import { apiClient } from '@/shared/api/client';
import { Notebook, ListNotebooksResponse } from '@/shared/types';

export const notebooksApi = {
  listNotebooks: async (): Promise<Notebook[]> => {
    const res = await apiClient.get<ListNotebooksResponse | Notebook[]>('/api/notebooks');
    if (Array.isArray(res)) return res;
    return res.data || [];
  },

  getNotebook: async (id: string): Promise<Notebook> => {
    return apiClient.get<Notebook>(`/api/notebooks/${id}`);
  },

  createNotebook: async (data: { title: string; description?: string }): Promise<Notebook> => {
    return apiClient.post<Notebook>('/api/notebooks', data);
  },

  updateNotebook: async (id: string, data: { title?: string; description?: string }): Promise<Notebook> => {
    return apiClient.patch<Notebook>(`/api/notebooks/${id}`, data);
  },

  deleteNotebook: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/api/notebooks/${id}`);
  },

  duplicateNotebook: async (id: string): Promise<Notebook> => {
    return apiClient.post<Notebook>(`/api/notebooks/${id}/duplicate`);
  },

  archiveNotebook: async (id: string): Promise<Notebook> => {
    return apiClient.post<Notebook>(`/api/notebooks/${id}/archive`);
  },

  restoreNotebook: async (id: string): Promise<Notebook> => {
    return apiClient.post<Notebook>(`/api/notebooks/${id}/restore`);
  },

  favoriteNotebook: async (id: string, isFavorite?: boolean): Promise<Notebook> => {
    return apiClient.post<Notebook>(`/api/notebooks/${id}/favorite`, { isFavorite });
  },

  touchNotebook: async (id: string): Promise<Notebook> => {
    return apiClient.post<Notebook>(`/api/notebooks/${id}/touch`);
  },
};
