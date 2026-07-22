import { PrismaClient } from '@prisma/client';
import { config } from '@/config';

declare global {
  // eslint-disable-next-line no-var
  var globalPrisma: PrismaClient | undefined;
}

export const prisma =
  global.globalPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.globalPrisma = prisma;
}
