import { z } from 'zod';

export const createNotebookSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z.string().optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
});

export const updateNotebookSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title cannot exceed 255 characters')
    .optional(),
  description: z.string().optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
});

export const listNotebooksQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateNotebookDto = z.infer<typeof createNotebookSchema>;
export type UpdateNotebookDto = z.infer<typeof updateNotebookSchema>;
export type ListNotebooksQueryDto = z.infer<typeof listNotebooksQuerySchema>;
