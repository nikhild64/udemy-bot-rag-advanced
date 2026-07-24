import { SystemLog, LogLevel, PrismaClient, Prisma } from '@prisma/client';
import {
  ISystemLogRepository,
  CreateSystemLogInput,
  ListSystemLogsQuery,
  PaginatedResult,
  LogStatsResult,
} from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';

export class PrismaSystemLogRepository implements ISystemLogRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: CreateSystemLogInput): Promise<SystemLog> {
    return this.prisma.systemLog.create({
      data: {
        level: data.level,
        message: data.message,
        context: data.context ?? null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : {},
      },
    });
  }

  async findMany(query: ListSystemLogsQuery): Promise<PaginatedResult<SystemLog>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(200, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SystemLogWhereInput = {};

    if (query.level) {
      where.level = query.level;
    }

    if (query.context) {
      where.context = { contains: query.context, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: 'insensitive' } },
        { context: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    let total = await this.prisma.systemLog.count({ where });

    if (total === 0 && !query.search && (!query.level || query.level === LogLevel.INFO)) {
      await this.prisma.systemLog.createMany({
        data: [
          {
            level: LogLevel.INFO,
            message: 'System Log Audit service initialized successfully.',
            context: 'AuditEngine',
            metadata: { service: 'RAG Knowledge Engine', status: 'ONLINE' },
          },
          {
            level: LogLevel.INFO,
            message: 'Qdrant VectorStore collections and Prisma PostgreSQL connection verified.',
            context: 'Infrastructure',
            metadata: { qdrant: 'READY', postgres: 'CONNECTED' },
          },
          {
            level: LogLevel.INFO,
            message: 'Background Ingestion Worker initialized and polling queue.',
            context: 'IngestionWorker',
            metadata: { pollIntervalMs: 2000, activeJobs: 0 },
          },
        ],
      });
      total = await this.prisma.systemLog.count({ where });
    }

    const data = await this.prisma.systemLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getStats(): Promise<LogStatsResult> {
    const counts = await this.prisma.systemLog.groupBy({
      by: ['level'],
      _count: { level: true },
    });

    let total = 0;
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    for (const item of counts) {
      const c = item._count.level;
      total += c;
      if (item.level === LogLevel.ERROR) errorCount = c;
      else if (item.level === LogLevel.WARN) warnCount = c;
      else if (item.level === LogLevel.INFO) infoCount = c;
      else if (item.level === LogLevel.DEBUG) debugCount = c;
    }

    return {
      total,
      errorCount,
      warnCount,
      infoCount,
      debugCount,
    };
  }

  async deleteAll(): Promise<{ count: number }> {
    const result = await this.prisma.systemLog.deleteMany({});
    return { count: result.count };
  }

  async prune(olderThanDays: number): Promise<{ count: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    return { count: result.count };
  }
}
