import { z } from 'zod';

export const MemoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  topK: z.coerce.number().default(5),
  apiUrl: z.string().default('https://api.mem0.ai/v1'),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

export const memoryConfig: MemoryConfig = {
  enabled: process.env.MEM0_ENABLED !== undefined ? process.env.MEM0_ENABLED === 'true' : true,
  apiKey: process.env.MEM0_API_KEY || undefined,
  topK: process.env.MEM0_TOP_K ? parseInt(process.env.MEM0_TOP_K, 10) : 5,
  apiUrl: process.env.MEM0_API_URL || 'https://api.mem0.ai/v1',
};
