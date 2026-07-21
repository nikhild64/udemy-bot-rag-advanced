import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const ChatConfigSchema = z.object({
  CHAT_PROVIDER: z.string().default('mistral'),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
  QUERY_TRANSFORMATION_MODEL: z.string().default('mistral-small-latest'),
  RERANK_MODEL: z.string().default('mistral-small-latest'),
  CHAT_MODEL: z.string().default('mistral-medium-latest'),
  MISTRAL_API_URL: z.string().url().default('https://api.mistral.ai/v1/chat/completions'),
  CHAT_TIMEOUT: z.coerce.number().default(30000),
});

export interface ChatConfig {
  readonly provider: string;
  readonly mistralApiKey: string;
  readonly queryTransformationModel: string;
  readonly rerankModel: string;
  readonly chatModel: string;
  readonly mistralApiUrl: string;
  readonly timeoutMs: number;
}

function loadChatConfig(): ChatConfig {
  const result = ChatConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Chat configuration validation failed: ${errorDetails}`);
  }

  return {
    provider: result.data.CHAT_PROVIDER,
    mistralApiKey: result.data.MISTRAL_API_KEY,
    queryTransformationModel: result.data.QUERY_TRANSFORMATION_MODEL,
    rerankModel: result.data.RERANK_MODEL,
    chatModel: result.data.CHAT_MODEL,
    mistralApiUrl: result.data.MISTRAL_API_URL,
    timeoutMs: result.data.CHAT_TIMEOUT,
  };
}

export const chatConfig: ChatConfig = loadChatConfig();
