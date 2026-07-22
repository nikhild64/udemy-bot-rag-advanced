import { Source, SourceStatus, PrismaClient } from '@prisma/client';
import { ISourceRepository, CreateSourceInput } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/errors';

export class PrismaSourceRepository implements ISourceRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: CreateSourceInput): Promise<Source> {
    return this.prisma.source.create({
      data: {
        notebookId: data.notebookId,
        title: data.title,
        type: data.type,
        storagePath: data.storagePath ?? null,
        fileUrl: data.fileUrl ?? null,
        metadata: data.metadata ?? {},
        status: SourceStatus.PENDING,
      },
    });
  }

  async findById(id: string): Promise<Source | null> {
    return this.prisma.source.findUnique({
      where: { id },
    });
  }

  async findByNotebookId(notebookId: string): Promise<Source[]> {
    return this.prisma.source.findMany({
      where: { notebookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: SourceStatus): Promise<Source> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(`Source with id '${id}' not found`);
    }

    return this.prisma.source.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(`Source with id '${id}' not found`);
    }

    await this.prisma.source.delete({
      where: { id },
    });
    return true;
  }
}
