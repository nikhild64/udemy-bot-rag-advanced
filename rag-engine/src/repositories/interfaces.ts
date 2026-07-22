import { User, Notebook, Source, Message, UserPreference, SourceType, SourceStatus, MessageRole } from '@prisma/client';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findOrCreate(data: { id: string; email?: string | null; name?: string | null }): Promise<User>;
}

export interface CreateNotebookInput {
  title: string;
  description?: string | null | undefined;
  userId: string;
  settings?: Record<string, any> | null | undefined;
}

export interface UpdateNotebookInput {
  title?: string | undefined;
  description?: string | null | undefined;
  isArchived?: boolean | undefined;
  isFavorite?: boolean | undefined;
  lastOpenedAt?: Date | null | undefined;
  settings?: Record<string, any> | null | undefined;
}

export interface ListNotebooksQuery {
  userId: string;
  isArchived?: boolean | undefined;
  isFavorite?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastOpenedAt' | 'title' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface INotebookRepository {
  create(data: CreateNotebookInput): Promise<Notebook>;
  findById(id: string, userId?: string): Promise<Notebook | null>;
  findByUserId(userId: string): Promise<Notebook[]>;
  findMany(query: ListNotebooksQuery): Promise<PaginatedResult<Notebook>>;
  update(id: string, userId: string, data: UpdateNotebookInput): Promise<Notebook>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface CreateUserPreferenceInput {
  userId: string;
  theme?: string | undefined;
  language?: string | undefined;
  defaultNotebookId?: string | null | undefined;
  timezone?: string | undefined;
  notifications?: Record<string, any> | null | undefined;
}

export interface UpdateUserPreferenceInput {
  theme?: string | undefined;
  language?: string | undefined;
  defaultNotebookId?: string | null | undefined;
  timezone?: string | undefined;
  notifications?: Record<string, any> | null | undefined;
}

export interface IUserPreferenceRepository {
  findByUserId(userId: string): Promise<UserPreference | null>;
  upsert(userId: string, data: UpdateUserPreferenceInput): Promise<UserPreference>;
}

export interface CreateSourceInput {
  notebookId: string;
  type: SourceType;
  displayName?: string | null | undefined;
  title?: string | undefined;
  storagePath?: string | null | undefined;
  fileUrl?: string | null | undefined;
  mimeType?: string | null | undefined;
  size?: number | null | undefined;
  metadata?: Record<string, any> | null | undefined;
  status?: SourceStatus | undefined;
}

export interface UpdateSourceInput {
  displayName?: string | null | undefined;
  title?: string | undefined;
  status?: SourceStatus | undefined;
  storagePath?: string | null | undefined;
  fileUrl?: string | null | undefined;
  mimeType?: string | null | undefined;
  size?: number | null | undefined;
  metadata?: Record<string, any> | null | undefined;
}

export interface ListSourcesQuery {
  notebookId: string;
  userId?: string | undefined;
  type?: SourceType | undefined;
  status?: SourceStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'createdAt' | 'updatedAt' | 'displayName' | 'title' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface ISourceRepository {
  create(data: CreateSourceInput): Promise<Source>;
  findById(id: string, userId?: string): Promise<Source | null>;
  findByNotebookId(notebookId: string): Promise<Source[]>;
  findMany(query: ListSourcesQuery): Promise<PaginatedResult<Source>>;
  update(id: string, userId: string, data: UpdateSourceInput): Promise<Source>;
  updateStatus(id: string, status: SourceStatus): Promise<Source>;
  delete(id: string, userId?: string): Promise<boolean>;
}

export interface CreateMessageInput {
  notebookId: string;
  role: MessageRole;
  content: string;
  citations?: any;
  metadata?: Record<string, any> | null | undefined;
}

export interface IMessageRepository {
  create(data: CreateMessageInput): Promise<Message>;
  findByNotebookId(notebookId: string, limit?: number): Promise<Message[]>;
  deleteByNotebookId(notebookId: string): Promise<number>;
}
