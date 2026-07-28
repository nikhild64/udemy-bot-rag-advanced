import { PrismaClient, SourceStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { logger } from '@/shared/logger';

export interface DashboardSummary {
  stats: {
    totalNotebooks: number;
    favoriteNotebooks: number;
    archivedNotebooks: number;
    totalSources: number;
    totalMessages: number;
    totalStorageBytes: number;
    activeJobsCount: number;
    failedJobsCount: number;
  };
  recentNotebooks: any[];
  recentSources: any[];
  statusBreakdown: Record<string, number>;
  activitySummary: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }>;
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    logger.info({ userId }, 'Aggregating dashboard metrics');

    try {
      const [
        totalNotebooks,
        favoriteNotebooks,
        archivedNotebooks,
        recentNotebooks,
        sources,
        totalMessages,
        statusCounts,
      ] = await Promise.all([
        this.prisma.notebook.count({ where: { userId, isArchived: false } }),
        this.prisma.notebook.count({ where: { userId, isFavorite: true, isArchived: false } }),
        this.prisma.notebook.count({ where: { userId, isArchived: true } }),
        this.prisma.notebook.findMany({
          where: { userId, isArchived: false },
          orderBy: { lastOpenedAt: 'desc' },
          take: 5,
          include: {
            _count: {
              select: { sources: true, messages: true },
            },
          },
        }),
        this.prisma.source.findMany({
          where: { notebook: { userId } },
          orderBy: { createdAt: 'desc' },
          include: {
            notebook: { select: { id: true, title: true } },
          },
        }),
        this.prisma.message.count({ where: { notebook: { userId } } }),
        this.prisma.source.groupBy({
          by: ['status'],
          where: { notebook: { userId } },
          _count: { status: true },
        }),
      ]);

      let totalStorageBytes = 0;
      let activeJobsCount = 0;
      let failedJobsCount = 0;
      const statusBreakdown: Record<string, number> = {};

      sources.forEach((s) => {
        if (s.size) totalStorageBytes += s.size;
        const isProcessing = ['Queued', 'Downloading', 'Extracting', 'Normalizing', 'Chunking', 'Embedding', 'Indexing'].includes(s.status);
        if (isProcessing || s.status === 'Uploading') {
          activeJobsCount++;
        }
        if (s.status === SourceStatus.Failed || String(s.status).toLowerCase() === 'failed') {
          failedJobsCount++;
        }
      });

      statusCounts.forEach((sc) => {
        statusBreakdown[sc.status] = sc._count.status;
      });

      const recentSources = sources.slice(0, 5);

      const activitySummary = recentSources.map((s) => ({
        id: s.id,
        type: 'source_upload',
        description: `Uploaded "${s.displayName || s.title}" (${s.type}) to ${s.notebook?.title || 'Notebook'}`,
        timestamp: s.createdAt,
      }));

      return {
        stats: {
          totalNotebooks,
          favoriteNotebooks,
          archivedNotebooks,
          totalSources: sources.length,
          totalMessages,
          totalStorageBytes,
          activeJobsCount,
          failedJobsCount,
        },
        recentNotebooks: recentNotebooks || [],
        recentSources: recentSources || [],
        statusBreakdown,
        activitySummary,
      };
    } catch (err) {
      logger.error({ err, userId }, 'Error fetching dashboard summary, returning safe fallback');
      return {
        stats: {
          totalNotebooks: 0,
          favoriteNotebooks: 0,
          archivedNotebooks: 0,
          totalSources: 0,
          totalMessages: 0,
          totalStorageBytes: 0,
          activeJobsCount: 0,
          failedJobsCount: 0,
        },
        recentNotebooks: [],
        recentSources: [],
        statusBreakdown: {},
        activitySummary: [],
      };
    }
  }
}
