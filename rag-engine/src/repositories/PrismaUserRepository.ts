import { User, PrismaClient } from '@prisma/client';
import { IUserRepository } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findOrCreate(data: { id: string; email?: string | null; name?: string | null }): Promise<User> {
    const existing = await this.findById(data.id);
    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        id: data.id,
        email: data.email ?? null,
        name: data.name ?? null,
      },
    });
  }
}
