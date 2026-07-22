import { z } from 'zod';
import { SourceType, SourceStatus } from '@prisma/client';

export const sourceTypeEnum = z.nativeEnum(SourceType, {
  errorMap: () => ({ message: 'Invalid source type' }),
});

export const sourceStatusEnum = z.nativeEnum(SourceStatus, {
  errorMap: () => ({ message: 'Invalid source status' }),
});

export const createSourceSchema = z.object({
  type: sourceTypeEnum,
  displayName: z.string().min(1, 'Display name cannot be empty').optional(),
  title: z.string().min(1, 'Title cannot be empty').optional(),
  storagePath: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  status: sourceStatusEnum.optional(),
});

export const updateSourceSchema = z.object({
  displayName: z.string().min(1, 'Display name cannot be empty').optional().nullable(),
  title: z.string().min(1, 'Title cannot be empty').optional(),
  status: sourceStatusEnum.optional(),
  storagePath: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const listSourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  type: sourceTypeEnum.optional(),
  status: sourceStatusEnum.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'displayName', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateSourceDto = z.infer<typeof createSourceSchema>;
export type UpdateSourceDto = z.infer<typeof updateSourceSchema>;
export type ListSourcesQueryDto = z.infer<typeof listSourcesQuerySchema>;
