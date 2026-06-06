import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry {
  isEnabled: boolean;
  cachedAt: number;
}

/**
 * Cache en mémoire pour l'état des modules.
 * Évite un appel DB à chaque requête pour vérifier si un module est actif.
 * TTL : 30 secondes (les modules changent rarement).
 */
@Injectable()
export class ModuleCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalide le cache d'un module (à appeler après un changement de statut).
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Vérifie si un module est actif.
   * Lance ForbiddenException si le module est désactivé.
   */
  async assertEnabled(key: string): Promise<void> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && now - cached.cachedAt < this.TTL_MS) {
      if (!cached.isEnabled) {
        throw new ForbiddenException(`Module '${key}' is disabled`);
      }
      return;
    }

    const mod = await this.prisma.module.findUnique({ where: { key } });
    const isEnabled = !mod || mod.isEnabled;

    this.cache.set(key, { isEnabled, cachedAt: now });

    if (!isEnabled) {
      throw new ForbiddenException(`Module '${key}' is disabled`);
    }
  }
}
