import {
  MemoryProvider,
  MemoryItem,
  MemorySearchOptions,
  MemoryAddOptions,
} from '../../core/contracts/memory-provider.contract';
import { MemoryConfig } from '../../config/memory';
import { logger } from '../../shared/logger';

export class Mem0MemoryProvider implements MemoryProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly enabled: boolean;
  private readonly defaultTopK: number;

  constructor(memoryConfig: MemoryConfig) {
    this.apiUrl = memoryConfig.apiUrl.replace(/\/$/, '');
    this.apiKey = memoryConfig.apiKey;
    this.enabled = memoryConfig.enabled && Boolean(this.apiKey);
    this.defaultTopK = memoryConfig.topK || 5;

    if (!this.apiKey && memoryConfig.enabled) {
      logger.info('Mem0 API Key (MEM0_API_KEY) not provided. Mem0MemoryProvider will operate in graceful fallback (disabled) mode.');
    }
  }

  public async search(options: MemorySearchOptions): Promise<MemoryItem[]> {
    if (!this.enabled || !options.userId) {
      return [];
    }

    try {
      const topK = options.topK || this.defaultTopK;
      const response = await fetch(`${this.apiUrl}/memories/search/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: options.query,
          user_id: options.userId,
          top_k: topK,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Mem0 search request failed');
        return [];
      }

      const data = await response.json();
      const rawMemories = Array.isArray(data) ? data : data.results || data.memories || [];

      return rawMemories.slice(0, topK).map((item: any) => ({
        id: item.id || item.memory_id || String(Math.random()),
        memory: item.memory || item.text || item.content || '',
        score: item.score ?? item.similarity,
        createdAt: item.created_at || item.createdAt,
        metadata: item.metadata,
      }));
    } catch (err) {
      logger.error({ err }, 'Error querying Mem0 memory engine');
      return [];
    }
  }

  public async add(options: MemoryAddOptions): Promise<MemoryItem[]> {
    if (!options.userId || !options.messages || options.messages.length === 0) {
      return [];
    }

    const userMsg = options.messages.find((m) => m.role === 'user')?.content || '';

    if (!this.enabled) {
      if (!userMsg) return [];
      return [
        {
          id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          memory: userMsg,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    try {
      const response = await fetch(`${this.apiUrl}/memories/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: options.messages,
          user_id: options.userId,
          infer: true,
          custom_prompt:
            "Extract ONLY explicit user preferences, personal facts, skill level, tech stack choices, or direct instructions (e.g. 'I prefer Python', 'I work as a developer', 'Keep answers concise'). Do NOT extract general Q&A questions or one-off topic queries like 'What is Docker?'. If no user facts exist, return no memories.",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Mem0 add memory request failed');
        if (userMsg) {
          return [
            {
              id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              memory: userMsg,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        return [];
      }

      const data = await response.json();
      const rawMemories = Array.isArray(data) ? data : data.results || data.memories || [];

      logger.debug({ userId: options.userId, count: rawMemories.length }, 'Successfully processed memory add in Mem0');

      if (rawMemories.length > 0) {
        return rawMemories.map((item: any) => ({
          id: item.id || item.memory_id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          memory: item.memory || item.text || item.content || userMsg,
          score: item.score,
          createdAt: item.created_at || item.createdAt || new Date().toISOString(),
          metadata: item.metadata,
        }));
      }

      // Mem0 processes asynchronously on backend. Pause briefly and retrieve actual processed memories
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return await this.getAll(options.userId);
    } catch (err) {
      logger.error({ err }, 'Error sending memory add to Mem0');
      return [];
    }
  }

  public async getAll(userId: string): Promise<MemoryItem[]> {
    if (!this.enabled || !userId) {
      return [];
    }

    try {
      const response = await fetch(`${this.apiUrl}/memories/?user_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Mem0 getAll request failed');
        return [];
      }

      const data = await response.json();
      const rawMemories = Array.isArray(data) ? data : data.results || data.memories || [];

      return rawMemories.map((item: any) => ({
        id: item.id || item.memory_id || String(Math.random()),
        memory: item.memory || item.text || item.content || '',
        score: item.score,
        createdAt: item.created_at || item.createdAt,
        metadata: item.metadata,
      }));
    } catch (err) {
      logger.error({ err }, 'Error retrieving all memories from Mem0');
      return [];
    }
  }

  public async delete(memoryId: string): Promise<void> {
    if (!this.enabled || !memoryId) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/memories/${encodeURIComponent(memoryId)}/`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Mem0 delete memory request failed');
      } else {
        logger.info({ memoryId }, 'Successfully deleted memory from Mem0');
      }
    } catch (err) {
      logger.error({ err }, 'Error deleting memory from Mem0');
    }
  }

  public async deleteAll(userId: string): Promise<void> {
    if (!this.enabled || !userId) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/memories/?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const items = await this.getAll(userId);
        await Promise.all(items.map((m) => this.delete(m.id)));
      } else {
        logger.info({ userId }, 'Successfully deleted all memories from Mem0');
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error deleting all memories from Mem0');
      try {
        const items = await this.getAll(userId);
        await Promise.all(items.map((m) => this.delete(m.id)));
      } catch (fallbackErr) {
        logger.error({ fallbackErr }, 'Fallback deleteAll failed');
      }
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Token ${this.apiKey}`;
    }
    return headers;
  }
}
