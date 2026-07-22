import { Message, PrismaClient } from '@prisma/client';
import { IMessageRepository, CreateMessageInput } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';

export class PrismaMessageRepository implements IMessageRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: CreateMessageInput): Promise<Message> {
    return this.prisma.message.create({
      data: {
        notebookId: data.notebookId,
        role: data.role,
        content: data.content,
        citations: data.citations ?? [],
        metadata: data.metadata ?? {},
      },
    });
  }

  async findByNotebookId(notebookId: string, limit = 50): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { notebookId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async deleteByNotebookId(notebookId: string): Promise<number> {
    const result = await this.prisma.message.deleteMany({
      where: { notebookId },
    });
    return result.count;
  }
}
