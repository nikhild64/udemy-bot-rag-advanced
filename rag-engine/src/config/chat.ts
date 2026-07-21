import { z } from 'zod';

export const ChatConfigSchema = z.object({
  provider: z.string().default('mistral'),
  mistralApiKey: z.string().default(''),
  queryTransformationModel: z.string().default('mistral-small-latest'),
  rerankModel: z.string().default('mistral-small-latest'),
  chatModel: z.string().default('mistral-medium-latest'),
  mistralApiUrl: z.string().url().default('https://api.mistral.ai/v1/chat/completions'),
  timeoutMs: z.coerce.number().default(30000),
});

export type ChatConfig = z.infer<typeof ChatConfigSchema>;

export const chatConfig: ChatConfig = {
  provider: process.env.CHAT_PROVIDER || 'mistral',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  queryTransformationModel: process.env.QUERY_TRANSFORMATION_MODEL || 'mistral-small-latest',
  rerankModel: process.env.RERANK_MODEL || 'mistral-small-latest',
  chatModel: process.env.CHAT_MODEL || 'mistral-medium-latest',
  mistralApiUrl: 'https://api.mistral.ai/v1/chat/completions',
  timeoutMs: 30000,
};
