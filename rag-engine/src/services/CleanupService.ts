import { PrismaClient, SourceStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { logger } from '@/shared/logger';

export interface CleanupResult {
  deletedSourcesCount: number;
  clearedUploadsCount: number;
  retriedJobsCount: number;
}

export class CleanupService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async runResourceCleanup(
    userId: string,
    options: {
      deleteFailedSources?: boolean;
      clearPendingUploads?: boolean;
      retryFailedJobs?: boolean;
    } = {},
  ): Promise<CleanupResult> {
    logger.info({ userId, options }, 'Executing resource cleanup operations');

    let deletedSourcesCount = 0;
    let clearedUploadsCount = 0;
    let retriedJobsCount = 0;

    if (options.deleteFailedSources) {
      const res = await this.prisma.source.deleteMany({
        where: {
          notebook: { userId },
          status: { in: [SourceStatus.Failed, SourceStatus.Cancelled] },
        },
      });
      deletedSourcesCount = res.count;
    }

    if (options.clearPendingUploads) {
      const res = await this.prisma.source.deleteMany({
        where: {
          notebook: { userId },
          status: SourceStatus.PendingUpload,
        },
      });
      clearedUploadsCount = res.count;
    }

    if (options.retryFailedJobs) {
      const res = await this.prisma.source.updateMany({
        where: {
          notebook: { userId },
          status: SourceStatus.Failed,
        },
        data: {
          status: SourceStatus.Queued,
        },
      });
      retriedJobsCount = res.count;
    }

    return {
      deletedSourcesCount,
      clearedUploadsCount,
      retriedJobsCount,
    };
  }
}
