import { z } from 'zod';

export const notebookChatParamsSchema = z.object({
  notebookId: z.string().uuid('notebookId must be a valid UUID').or(z.string().min(1)),
});

export const notebookChatBodySchema = z.object({
  query: z.string().min(1, 'query is required and cannot be empty'),
  topK: z.number().int().positive().optional(),
  filters: z.record(z.unknown()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  model: z.string().optional(),
});

export const citationSchema = z.object({
  notebookId: z.string().optional(),
  sourceId: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceName: z.string().optional(),
  sourceType: z.string().optional(),
  pageNumber: z.number().optional(),
  page: z.number().optional(),
  timestamp: z.number().optional(),
  chunkId: z.string().optional(),
  excerpt: z.string().optional(),
  snippet: z.string().optional(),
  score: z.number().optional(),
}).passthrough();

export const messageSchema = z.object({
  id: z.string(),
  notebookId: z.string(),
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM']),
  content: z.string(),
  citations: z.array(citationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().or(z.string()),
}).passthrough();

export const notebookChatResponseSchema = z.object({
  message: messageSchema,
  citations: z.array(citationSchema),
  retrievedChunks: z.array(z.record(z.unknown())),
  metadata: z.record(z.unknown()),
}).passthrough();

export const notebookMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
