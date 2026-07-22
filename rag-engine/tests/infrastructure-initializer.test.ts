import { describe, it, expect, vi } from 'vitest';
import { InfrastructureInitializer } from '@/infrastructure/InfrastructureInitializer';
import { prisma } from '@/shared/database/prisma';

describe('InfrastructureInitializer Unit Tests', () => {
  it('should run initialization steps without failing fatally in test environment', async () => {
    const connectSpy = vi.spyOn(prisma, '$connect').mockImplementation(async () => {});

    await expect(InfrastructureInitializer.initialize()).resolves.not.toThrow();

    expect(connectSpy).toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
