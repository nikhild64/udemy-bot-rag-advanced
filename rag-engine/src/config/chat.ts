import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const ChatConfigSchema = z
  .object({
    CHAT_PROVIDER: z.string().default('mistral'),
    MISTRAL_API_KEY: z.string().optional().default(''),
    NVIDIA_API_KEY: z.string().optional().default(''),
    NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
    NVIDIA_CHAT_MODEL: z.string().default('meta/llama-3.3-70b-instruct'),
    NVIDIA_QUERY_TRANSFORMATION_MODEL: z.string().default('meta/llama-3.3-70b-instruct'),
    QUERY_TRANSFORMATION_MODEL: z.string().default('mistral-small-latest'),
    RERANK_MODEL: z.string().default('mistral-small-latest'),
    CHAT_MODEL: z.string().default('mistral-medium-latest'),
    MISTRAL_API_URL: z.string().url().default('https://api.mistral.ai/v1/chat/completions'),
    CHAT_TIMEOUT: z.coerce.number().default(30000),
  })
  .superRefine((data, ctx) => {
    const provider = data.CHAT_PROVIDER.toLowerCase();
    if (provider === 'mistral' && (!data.MISTRAL_API_KEY || !data.MISTRAL_API_KEY.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MISTRAL_API_KEY is required when CHAT_PROVIDER is mistral',
        path: ['MISTRAL_API_KEY'],
      });
    } else if (provider === 'nvidia' && (!data.NVIDIA_API_KEY || !data.NVIDIA_API_KEY.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NVIDIA_API_KEY is required when CHAT_PROVIDER is nvidia',
        path: ['NVIDIA_API_KEY'],
      });
    }
  });

export interface ChatConfig {
  readonly provider: string;
  readonly mistralApiKey: string;
  readonly nvidiaApiKey: string;
  readonly nvidiaBaseUrl: string;
  readonly nvidiaChatModel: string;
  readonly nvidiaQueryTransformationModel: string;
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
    mistralApiKey: result.data.MISTRAL_API_KEY || '',
    nvidiaApiKey: result.data.NVIDIA_API_KEY || '',
    nvidiaBaseUrl: result.data.NVIDIA_BASE_URL,
    nvidiaChatModel: result.data.NVIDIA_CHAT_MODEL,
    nvidiaQueryTransformationModel: result.data.NVIDIA_QUERY_TRANSFORMATION_MODEL,
    queryTransformationModel: result.data.QUERY_TRANSFORMATION_MODEL,
    rerankModel: result.data.RERANK_MODEL,
    chatModel: result.data.CHAT_MODEL,
    mistralApiUrl: result.data.MISTRAL_API_URL,
    timeoutMs: result.data.CHAT_TIMEOUT,
  };
}

export const chatConfig: ChatConfig = loadChatConfig();
