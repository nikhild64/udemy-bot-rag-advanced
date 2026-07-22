import { User, Notebook, Source, Message, SourceType, SourceStatus, MessageRole } from '@prisma/client';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findOrCreate(data: { id: string; email?: string | null; name?: string | null }): Promise<User>;
}

export interface CreateNotebookInput {
  title: string;
  description?: string | null;
  userId: string;
  settings?: Record<string, any> | null;
}

export interface UpdateNotebookInput {
  title?: string;
  description?: string | null;
  settings?: Record<string, any> | null;
}

export interface INotebookRepository {
  create(data: CreateNotebookInput): Promise<Notebook>;
  findById(id: string, userId?: string): Promise<Notebook | null>;
  findByUserId(userId: string): Promise<Notebook[]>;
  update(id: string, userId: string, data: UpdateNotebookInput): Promise<Notebook>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface CreateSourceInput {
  notebookId: string;
  title: string;
  type: SourceType;
  storagePath?: string | null;
  fileUrl?: string | null;
  metadata?: Record<string, any> | null;
}

export interface ISourceRepository {
  create(data: CreateSourceInput): Promise<Source>;
  findById(id: string): Promise<Source | null>;
  findByNotebookId(notebookId: string): Promise<Source[]>;
  updateStatus(id: string, status: SourceStatus): Promise<Source>;
  delete(id: string): Promise<boolean>;
}

export interface CreateMessageInput {
  notebookId: string;
  role: MessageRole;
  content: string;
  citations?: any;
  metadata?: Record<string, any> | null;
}

export interface IMessageRepository {
  create(data: CreateMessageInput): Promise<Message>;
  findByNotebookId(notebookId: string, limit?: number): Promise<Message[]>;
  deleteByNotebookId(notebookId: string): Promise<number>;
}
