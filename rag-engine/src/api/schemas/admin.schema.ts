import { z } from 'zod';
import { LogLevel } from '@prisma/client';

export const listLogsQuerySchema = z.object({
  level: z.nativeEnum(LogLevel).optional(),
  search: z.string().optional(),
  context: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListLogsQueryInput = z.infer<typeof listLogsQuerySchema>;

export const deleteLogsQuerySchema = z.object({
  all: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  olderThanDays: z.coerce.number().int().min(1).optional(),
});

export type DeleteLogsQueryInput = z.infer<typeof deleteLogsQuerySchema>;

export const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(LogLevel).or(z.enum(['USER', 'ADMIN'])),
});
