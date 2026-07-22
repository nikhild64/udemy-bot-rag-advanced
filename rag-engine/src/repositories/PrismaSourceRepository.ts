import { Source, SourceStatus, PrismaClient } from '@prisma/client';
import { ISourceRepository, CreateSourceInput, UpdateSourceInput, ListSourcesQuery, PaginatedResult } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/errors';

export class PrismaSourceRepository implements ISourceRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: CreateSourceInput): Promise<Source> {
    const title = data.title || data.displayName || 'Untitled Source';
    const displayName = data.displayName ?? data.title ?? 'Untitled Source';

    return this.prisma.source.create({
      data: {
        notebookId: data.notebookId,
        title,
        displayName,
        type: data.type,
        storagePath: data.storagePath ?? null,
        fileUrl: data.fileUrl ?? null,
        mimeType: data.mimeType ?? null,
        size: data.size ?? null,
        metadata: data.metadata ?? {},
        status: data.status ?? SourceStatus.PendingUpload,
      },
    });
  }

  async findById(id: string, userId?: string): Promise<Source | null> {
    const where: any = { id };
    if (userId) {
      where.notebook = { userId };
    }
    return this.prisma.source.findFirst({
      where,
    });
  }

  async findByNotebookId(notebookId: string): Promise<Source[]> {
    return this.prisma.source.findMany({
      where: { notebookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMany(query: ListSourcesQuery): Promise<PaginatedResult<Source>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: any = { notebookId: query.notebookId };
    if (query.userId) {
      where.notebook = { userId: query.userId };
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.source.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.source.count({ where }),
    ]);

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

  async update(id: string, userId: string, data: UpdateSourceInput): Promise<Source> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new NotFoundError(`Source with id '${id}' not found for user`);
    }

    const title = data.title ?? (data.displayName ? data.displayName : undefined);

    return this.prisma.source.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(title !== undefined && { title }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.storagePath !== undefined && { storagePath: data.storagePath }),
        ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
        ...(data.mimeType !== undefined && { mimeType: data.mimeType }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.metadata !== undefined && { metadata: data.metadata ?? {} }),
      },
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

  async delete(id: string, userId?: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new NotFoundError(`Source with id '${id}' not found for user`);
    }

    await this.prisma.source.delete({
      where: { id },
    });
    return true;
  }
}
