import { UserPreference, PrismaClient } from '@prisma/client';
import { IUserPreferenceRepository, UpdateUserPreferenceInput } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';

export class PrismaUserPreferenceRepository implements IUserPreferenceRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findByUserId(userId: string): Promise<UserPreference | null> {
    return this.prisma.userPreference.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: UpdateUserPreferenceInput): Promise<UserPreference> {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: data.theme ?? 'system',
        language: data.language ?? 'en',
        defaultNotebookId: data.defaultNotebookId ?? null,
        timezone: data.timezone ?? 'UTC',
        notifications: data.notifications ?? {
          uploadCompleted: true,
          uploadFailed: true,
          sourceIndexed: true,
          processingFailed: true,
          chatFailed: true,
        },
      },
      update: {
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.defaultNotebookId !== undefined && { defaultNotebookId: data.defaultNotebookId }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.notifications !== undefined && { notifications: data.notifications ?? {} }),
      },
    });
  }
}
