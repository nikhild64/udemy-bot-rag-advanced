import { Notebook, PrismaClient } from '@prisma/client';
import { INotebookRepository, CreateNotebookInput, UpdateNotebookInput } from './interfaces';
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
