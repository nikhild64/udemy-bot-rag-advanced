import { User, UserRole, PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/fastify';
import { IUserRepository } from './interfaces';
import { prisma as defaultPrisma } from '@/shared/database/prisma';
import { config } from '@/config';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  private async fetchClerkUserDetails(userId: string): Promise<{ email?: string; name?: string }> {
    try {
      if (!config.auth.secretKey) return {};
      const clerk = createClerkClient({ secretKey: config.auth.secretKey });
      const user = await clerk.users.getUser(userId);

      const primaryEmail =
        user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress;

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      const name = fullName || user.username || undefined;

      return {
        ...(primaryEmail && { email: primaryEmail }),
        ...(name && { name }),
      };
    } catch {
      // Gracefully handle Clerk fetch failures (e.g. invalid test user IDs or offline)
      return {};
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findOrCreate(data: { id: string; email?: string | null; name?: string | null; role?: UserRole }): Promise<User> {
    const existing = await this.findById(data.id);
    if (existing) {
      // Auto-backfill email or name from Clerk if currently missing
      if (!existing.email || !existing.name) {
        const fetched = await this.fetchClerkUserDetails(data.id);
        if ((fetched.email && !existing.email) || (fetched.name && !existing.name)) {
          return this.prisma.user.update({
            where: { id: data.id },
            data: {
              email: existing.email || fetched.email || null,
              name: existing.name || fetched.name || null,
            },
          });
        }
      }
      return existing;
    }

    // New User creation: fetch email and name from Clerk if not explicitly provided
    let email = data.email;
    let name = data.name;
    if (!email || !name) {
      const fetched = await this.fetchClerkUserDetails(data.id);
      email = email || fetched.email;
      name = name || fetched.name;
    }

    return this.prisma.user.create({
      data: {
        id: data.id,
        email: email ?? null,
        name: name ?? null,
        role: data.role ?? UserRole.USER,
      },
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }
}


