import { Notebook, PrismaClient } from '@prisma/client';
import { INotebookRepository, CreateNotebookInput, UpdateNotebookInput, ListNotebooksQuery, PaginatedResult } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/errors';

export class PrismaNotebookRepository implements INotebookRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: CreateNotebookInput): Promise<Notebook> {
    return this.prisma.notebook.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        userId: data.userId,
        settings: data.settings ?? {},
      },
    });
  }

  async findById(id: string, userId?: string): Promise<Notebook | null> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }
    return this.prisma.notebook.findFirst({
      where,
      include: {
        sources: true,
      },
    });
  }

  async findByUserId(userId: string): Promise<Notebook[]> {
    return this.prisma.notebook.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { sources: true, messages: true },
        },
      },
    });
  }

  async findMany(query: ListNotebooksQuery): Promise<PaginatedResult<Notebook>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: any = { userId: query.userId };
    if (query.isArchived !== undefined) {
      where.isArchived = query.isArchived;
    }
    if (query.isFavorite !== undefined) {
      where.isFavorite = query.isFavorite;
    }

    const fetchNotebooks = async () => {
      const [data, total] = await Promise.all([
        this.prisma.notebook.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: { sources: true, messages: true },
            },
          },
        }),
        this.prisma.notebook.count({ where }),
      ]);
      return { data, total };
    };

    let data: any[];
    let total: number;

    try {
      const result = await fetchNotebooks();
      data = result.data;
      total = result.total;
    } catch (err: any) {
      if (err.code === 'P1001' || err.message?.includes("Can't reach database server")) {
        await new Promise((res) => setTimeout(res, 1000));
        const result = await fetchNotebooks();
        data = result.data;
        total = result.total;
      } else {
        throw err;
      }
    }

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

  async update(id: string, userId: string, data: UpdateNotebookInput): Promise<Notebook> {
    const notebook = await this.findById(id, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with id '${id}' not found for user`);
    }

    return this.prisma.notebook.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
        ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        ...(data.lastOpenedAt !== undefined && { lastOpenedAt: data.lastOpenedAt }),
        ...(data.settings !== undefined && { settings: data.settings ?? {} }),
      },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const notebook = await this.findById(id, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with id '${id}' not found for user`);
    }

    await this.prisma.notebook.delete({
      where: { id },
    });
    return true;
  }
}
