import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { logger } from '@/shared/logger';

export interface SearchResultItem {
  id: string;
  type: 'notebook' | 'source' | 'message';
  title: string;
  snippet?: string | undefined;
  notebookId?: string | undefined;
  createdAt?: Date | undefined;
}

export interface SearchResponse {
  query: string;
  notebooks: SearchResultItem[];
  sources: SearchResultItem[];
  messages: SearchResultItem[];
  totalResults: number;
}

export class SearchService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async searchUserWorkspace(userId: string, query: string): Promise<SearchResponse> {
    const q = query.trim();
    if (!q) {
      return { query: '', notebooks: [], sources: [], messages: [], totalResults: 0 };
    }

    logger.info({ userId, query: q }, 'Executing workspace search');

    const [notebooks, sources, messages] = await Promise.all([
      this.prisma.notebook.findMany({
        where: {
          userId,
          isArchived: false,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.source.findMany({
        where: {
          notebook: { userId },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.findMany({
        where: {
          notebook: { userId },
          content: { contains: q, mode: 'insensitive' },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const notebookItems: SearchResultItem[] = notebooks.map((n) => ({
      id: n.id,
      type: 'notebook',
      title: n.title,
      snippet: n.description ?? undefined,
      notebookId: n.id,
      createdAt: n.createdAt,
    }));

    const sourceItems: SearchResultItem[] = sources.map((s) => ({
      id: s.id,
      type: 'source',
      title: s.displayName ?? s.title,
      snippet: `Type: ${s.type} • Status: ${s.status}`,
      notebookId: s.notebookId,
      createdAt: s.createdAt,
    }));

    const messageItems: SearchResultItem[] = messages.map((m) => ({
      id: m.id,
      type: 'message',
      title: `${m.role} Message`,
      snippet: m.content.length > 120 ? m.content.substring(0, 120) + '...' : m.content,
      notebookId: m.notebookId,
      createdAt: m.createdAt,
    }));

    const totalResults = notebookItems.length + sourceItems.length + messageItems.length;

    return {
      query: q,
      notebooks: notebookItems,
      sources: sourceItems,
      messages: messageItems,
      totalResults,
    };
  }
}
