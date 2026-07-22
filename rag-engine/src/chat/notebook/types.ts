import { Message } from '@prisma/client';
import { Citation, NotebookRetrievedChunk } from '@/retrieval/notebook/NotebookRetrievalResult';

export interface NotebookChatOptions {
  notebookId: string;
  userId: string;
  query: string;
  topK?: number | undefined;
  filters?: Record<string, any> | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  model?: string | undefined;
  timeout?: number | undefined;
}

export interface NotebookChatResponse {
  message: Message;
  citations: Citation[];
  retrievedChunks: NotebookRetrievedChunk[];
  metadata: {
    notebookId: string;
    messageId: string;
    retrievalDurationMs: number;
    completionDurationMs: number;
    totalDurationMs: number;
    promptCharacters: number;
    citationCount: number;
    model?: string | undefined;
    tokenUsage?: Record<string, any> | undefined;
  };
}

export type NotebookChatStreamEvent =
  | { type: 'start' }
  | { type: 'token'; data: string }
  | { type: 'citation'; data: Citation }
  | { type: 'done'; data?: { messageId: string } | undefined }
  | { type: 'error'; data: { message: string } };
