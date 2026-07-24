import { apiClient } from '@/shared/api/client';
import { Source, ListSourcesResponse, SourceStatusResponse } from '@/shared/types';

export const sourcesApi = {
  listSources: async (notebookId: string): Promise<Source[]> => {
    const res = await apiClient.get<ListSourcesResponse | Source[]>(`/api/notebooks/${notebookId}/sources`);
    if (Array.isArray(res)) return res;
    return res.data || [];
  },

  createSource: async (
    notebookId: string,
    data: {
      type: string;
      title: string;
      displayName?: string;
      fileUrl?: string;
      mimeType?: string;
      size?: number;
      status?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Source> => {
    return apiClient.post<Source>(`/api/notebooks/${notebookId}/sources`, data);
  },

  batchCreateSources: async (
    notebookId: string,
    urls: string[]
  ): Promise<{ sources: Source[] }> => {
    return apiClient.post<{ sources: Source[] }>(`/api/notebooks/${notebookId}/sources/batch`, { urls });
  },

  getSourceStatus: async (sourceId: string): Promise<SourceStatusResponse> => {
    return apiClient.get<SourceStatusResponse>(`/api/sources/${sourceId}/status`);
  },

  deleteSource: async (sourceId: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/api/sources/${sourceId}`);
  },

  uploadSourceFile: async (sourceId: string, file: File): Promise<Source> => {
    return apiClient.uploadFile<Source>(`/api/sources/${sourceId}/upload`, file);
  },

  reindexSource: async (sourceId: string): Promise<Source> => {
    return apiClient.post<Source>(`/api/sources/${sourceId}/reindex`);
  },

  retrySource: async (sourceId: string): Promise<Source> => {
    return apiClient.post<Source>(`/api/sources/${sourceId}/retry`);
  },

  cancelSource: async (sourceId: string): Promise<Source> => {
    return apiClient.post<Source>(`/api/sources/${sourceId}/cancel`);
  },

  getSourceMetadata: async (sourceId: string): Promise<Record<string, any>> => {
    return apiClient.get<Record<string, any>>(`/api/sources/${sourceId}/metadata`);
  },

  downloadSource: async (sourceId: string): Promise<{ downloadUrl: string; filename: string; mimeType?: string; size?: number }> => {
    return apiClient.get<{ downloadUrl: string; filename: string; mimeType?: string; size?: number }>(`/api/sources/${sourceId}/download`);
  },

  viewSource: async (sourceId: string): Promise<any> => {
    return apiClient.get<any>(`/api/sources/${sourceId}/view`);
  },

  getNotebookArtifacts: async (notebookId: string): Promise<{
    podcast: { status: string; data: any; error?: string; updatedAt?: string };
    learningPath: { status: string; data: any; error?: string; updatedAt?: string };
  }> => {
    return apiClient.get(`/api/notebooks/${notebookId}/artifacts`);
  },

  generatePodcast: async (notebookId: string, force: boolean = false): Promise<{ status: string; result?: any }> => {
    return apiClient.post(`/api/notebooks/${notebookId}/generate/podcast`, { force });
  },

  generateLearningPath: async (notebookId: string, force: boolean = false): Promise<{ status: string; result?: any }> => {
    return apiClient.post(`/api/notebooks/${notebookId}/generate/learning-path`, { force });
  },
};
