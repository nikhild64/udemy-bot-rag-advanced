import { z } from 'zod';

export const notebookRetrievalSchema = z.object({
  query: z
    .string({ required_error: 'Query is required' })
    .min(1, 'Query cannot be empty'),
  topK: z.coerce.number().int().positive().optional().default(5),
  candidateLimit: z.coerce.number().int().positive().optional().default(20),
  similarityThreshold: z.coerce.number().min(0).max(1).optional().default(0.0),
  maxContextTokens: z.coerce.number().int().positive().optional().default(4000),
  filters: z.record(z.unknown()).optional(),
  transformationStrategy: z.string().optional(),
  rerankerProvider: z.string().optional(),
});

export type NotebookRetrievalDto = z.infer<typeof notebookRetrievalSchema>;
