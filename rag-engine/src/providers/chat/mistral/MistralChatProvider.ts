import { ChatProvider, ChatProviderOptions } from '@/core/contracts';
import { ChatMessage, ChatResponse, ChatTask, ChatChunk } from '@/core/models';
import { ProviderError, ConfigurationError } from '@/shared/errors';
import { config } from '@/config';

export interface MistralChatProviderOptions {
  readonly apiKey?: string;
  readonly apiUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

interface MistralMessage {
  role: string;
  content: string;
}

interface MistralChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: MistralMessage;
    finish_reason: string;
  }[];
}

export class MistralChatProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: MistralChatProviderOptions = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.chat.mistralApiKey;
    this.apiUrl = options.apiUrl !== undefined ? options.apiUrl : config.chat.mistralApiUrl;
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : config.chat.timeoutMs;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;

    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ConfigurationError('MISTRAL_API_KEY is required when using Mistral chat provider');
    }
  }

  async generateResponse(
    messages: ChatMessage[],
    options: ChatProviderOptions
  ): Promise<ChatResponse> {
    if (!messages || messages.length === 0) {
      throw new ProviderError('Messages array cannot be empty');
    }

    const modelToUse = this.getModelForTask(options.task);
    let attempt = 0;
    let lastError: unknown = null;

    const formattedMessages: MistralMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    while (attempt <= this.maxRetries) {
      if (attempt > 0) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      attempt++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
          const body: Record<string, unknown> = {
            model: modelToUse,
            messages: formattedMessages,
          };
          
          if (options?.temperature !== undefined) {
            body.temperature = options.temperature;
          }

          response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Status ${status} ${response.statusText}`;
          try {
            const errJson = (await response.json()) as { message?: string; error?: { message?: string } };
            if (errJson.message) errorMessage += `: ${errJson.message}`;
            else if (errJson.error && errJson.error.message) errorMessage += `: ${errJson.error.message}`;
          } catch {
            // Ignore non-json body
          }

          if (status === 401 || status === 403) {
            throw new ProviderError(`Authentication failure with Mistral API: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Rate limit exceeded for Mistral API: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Rate limit exceeded for Mistral API after retries: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Mistral API server error: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Provider unavailable: ${errorMessage}`, {
              statusCode: status,
            });
          }

          throw new ProviderError(`Mistral API request failed: ${errorMessage}`, {
            statusCode: status,
          });
        }

        const data = (await response.json()) as MistralChatResponse;
        
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new ProviderError('Invalid chat response format received from Mistral API: missing or malformed choices');
        }

        const choice = data.choices[0];
        if (!choice || !choice.message || !choice.message.content) {
          throw new ProviderError('Invalid chat response format received from Mistral API: message content is empty');
        }

        return {
          message: {
            role: choice.message.role as any, // We cast to `any` because `ChatRole` may have specific literal types not perfectly matching string
            content: choice.message.content,
          },
        };
      } catch (err) {
        if (err instanceof ProviderError) {
          if (err.statusCode === 429 || (err.statusCode !== undefined && err.statusCode >= 500)) {
            lastError = err;
            continue;
          }
          throw err;
        }
        lastError = err;
      }
    }

    if (lastError instanceof ProviderError) {
      throw lastError;
    }

    const causeMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ProviderError(`Provider unavailable or request timed out after retries: ${causeMsg}`, {
      cause: lastError instanceof Error ? lastError : undefined,
    });
  }

  async *streamResponse(
    messages: ChatMessage[],
    options: ChatProviderOptions
  ): AsyncIterable<ChatChunk> {
    if (!messages || messages.length === 0) {
      throw new ProviderError('Messages array cannot be empty');
    }

    const modelToUse = this.getModelForTask(options.task);
    let attempt = 0;
    let lastError: unknown = null;
    let response: Response | undefined;

    const formattedMessages: MistralMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    while (attempt <= this.maxRetries) {
      if (attempt > 0) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      attempt++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const body: Record<string, unknown> = {
            model: modelToUse,
            messages: formattedMessages,
            stream: true,
          };
          
          if (options?.temperature !== undefined) {
            body.temperature = options.temperature;
          }

          response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Status ${status} ${response.statusText}`;
          try {
            const errJson = (await response.json()) as { message?: string; error?: { message?: string } };
            if (errJson.message) errorMessage += `: ${errJson.message}`;
            else if (errJson.error && errJson.error.message) errorMessage += `: ${errJson.error.message}`;
          } catch {
            // Ignore non-json body
          }

          if (status === 401 || status === 403) {
            throw new ProviderError(`Authentication failure with Mistral API: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Rate limit exceeded for Mistral API: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Rate limit exceeded for Mistral API after retries: ${errorMessage}`, {
              statusCode: status,
            });
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              lastError = new ProviderError(`Mistral API server error: ${errorMessage}`, {
                statusCode: status,
              });
              continue;
            }
            throw new ProviderError(`Provider unavailable: ${errorMessage}`, {
              statusCode: status,
            });
          }

          throw new ProviderError(`Mistral API request failed: ${errorMessage}`, {
            statusCode: status,
          });
        }

        break;
      } catch (err) {
        if (err instanceof ProviderError) {
          if (err.statusCode === 429 || (err.statusCode !== undefined && err.statusCode >= 500)) {
            lastError = err;
            continue;
          }
          throw err;
        }
        lastError = err;
      }
    }

    if (!response) {
      if (lastError instanceof ProviderError) {
        throw lastError;
      }
      const causeMsg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new ProviderError(`Provider unavailable or request timed out after retries: ${causeMsg}`, {
        cause: lastError instanceof Error ? lastError : undefined,
      });
    }

    if (!response.body) {
      throw new ProviderError('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }
          
          const dataString = trimmedLine.slice('data: '.length);
          if (dataString === '[DONE]') {
            yield { content: '', done: true };
            return;
          }
          
          try {
            const data = JSON.parse(dataString);
            const content = data.choices?.[0]?.delta?.content || '';
            const finishReason = data.choices?.[0]?.finish_reason;
            
            yield { content, done: finishReason !== null && finishReason !== undefined };
            if (finishReason !== null && finishReason !== undefined) {
              return;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getModelForTask(task: ChatTask): string {
    let model: string;
    switch (task) {
      case 'query-transformation':
        model = config.chat.queryTransformationModel;
        break;
      case 'reranking':
        model = config.chat.rerankModel;
        break;
      case 'chat':
        model = config.chat.chatModel;
        break;
      default:
        throw new ConfigurationError(`Unknown chat task: ${task}`);
    }

    if (!model || !model.trim()) {
      throw new ConfigurationError(`Model configuration missing for task: ${task}`);
    }

    return model;
  }
}
