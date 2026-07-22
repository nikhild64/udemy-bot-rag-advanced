export type SourceStatus = 'Uploaded' | 'Queued' | 'Processing' | 'Indexed' | 'Failed' | 'Cancelled' | 'PendingUpload';

export interface Notebook {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  isArchived?: boolean;
  isFavorite?: boolean;
  lastOpenedAt?: string | Date | null;
  settings?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sources: number;
    messages: number;
  };
}

export interface ListNotebooksResponse {
  data: Notebook[];
  total: number;
  page: number;
  limit: number;
}

export interface Source {
  id: string;
  notebookId: string;
  userId: string;
  type: string;
  title: string;
  displayName?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  status: SourceStatus;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListSourcesResponse {
  data: Source[];
  total: number;
  page: number;
  limit: number;
}

export interface SourceStatusResponse {
  sourceId: string;
  status: SourceStatus;
  progress: number;
  currentStage: string;
  error?: string | null;
  updatedAt: string;
}

export interface Citation {
  id?: string;
  sourceId?: string;
  sourceTitle?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  pageNumber?: number;
  page?: number;
  timestamp?: string;
  startTime?: number;
  endTime?: number;
  score?: number;
}

export interface Message {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ListMessagesResponse {
  data: Message[];
}

export interface ChatRequestOptions {
  query: string;
  topK?: number;
  filters?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatResponse {
  messageId: string;
  answer: string;
  citations: Citation[];
}

export type ChatStreamEvent =
  | { type: 'token'; data: { content: string } }
  | { type: 'citation'; data: Citation }
  | { type: 'done'; data: { messageId?: string } }
  | { type: 'error'; data: { message?: string } };
