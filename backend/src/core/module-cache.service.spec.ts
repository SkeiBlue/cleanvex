import { ForbiddenException } from '@nestjs/common';
import { ModuleCacheService } from './module-cache.service';

/** Prisma mock minimal */
function makePrisma(isEnabled: boolean | null) {
  return {
    module: {
      findUnique: jest.fn().mockResolvedValue(
        isEnabled === null ? null : { key: 'test', isEnabled },
      ),
    },
  };
}

describe('ModuleCacheService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ne leve pas d exception si le module est active', async () => {
    const svc = new ModuleCacheService(makePrisma(true) as never);
    await expect(svc.assertEnabled('test')).resolves.toBeUndefined();
  });

  it('leve ForbiddenException si le module est desactive', async () => {
    const svc = new ModuleCacheService(makePrisma(false) as never);
    await expect(svc.assertEnabled('test')).rejects.toThrow(ForbiddenException);
  });

  it('considere un module absent comme active', async () => {
    const svc = new ModuleCacheService(makePrisma(null) as never);
    await expect(svc.assertEnabled('absent')).resolves.toBeUndefined();
  });

  it('ne refait pas l appel DB dans le TTL', async () => {
    const prisma = makePrisma(true);
    const svc = new ModuleCacheService(prisma as never);
    await svc.assertEnabled('test');
    await svc.assertEnabled('test');
    expect(prisma.module.findUnique).toHaveBeenCalledTimes(1);
  });

  it('refait l appel DB apres invalidation du cache', async () => {
    const prisma = makePrisma(true);
    const svc = new ModuleCacheService(prisma as never);
    await svc.assertEnabled('test');
    svc.invalidate('test');
    await svc.assertEnabled('test');
    expect(prisma.module.findUnique).toHaveBeenCalledTimes(2);
  });
});
