import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client instance.
 * In development, reuse the global to avoid exhausting connection pools
 * during hot-reload with ts-node-dev.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
