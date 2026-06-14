import { Injectable } from '@nestjs/common';
import { CoreService } from '../core/core.service';
import { ModuleCacheService } from '../core/module-cache.service';
import { PrismaService } from '../prisma/prisma.service';

const CORE_MODULES = [
  { key: 'dashboard', title: 'Dashboard', version: '0.1.0' },
  { key: 'contacts', title: 'Contacts', version: '1.2.0' },
  { key: 'documents', title: 'Documents', version: '0.1.0' },
  { key: 'vehicles', title: 'Vehicules & Atelier', version: '0.2.0' },
  { key: 'finances', title: 'Finances', version: '0.3.0' },
  { key: 'stock', title: 'Stock', version: '0.4.0' },
  { key: 'agenda', title: 'Agenda', version: '0.5.0' },
  { key: 'real-estate', title: 'Immobilier', version: '1.0.0' },
];

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreService,
    private readonly moduleCache: ModuleCacheService,
  ) {}

  async seedDefaults() {
    await Promise.all(
      CORE_MODULES.map((module) =>
        this.prisma.module.upsert({
          where: { key: module.key },
          update: {},
          create: {
            ...module,
            isEnabled: ['dashboard', 'documents'].includes(module.key),
          },
        }),
      ),
    );
  }

  list() {
    return this.prisma.module.findMany({ orderBy: { title: 'asc' } });
  }

  /**
   * Sprint 3 — liste des modules vue par un utilisateur :
   * - tous les modules globaux (avec leur isEnabled admin) ;
   * - augmentés du champ `isVisible` reflétant la préférence personnelle.
   * Un module désactivé globalement reste retourné mais `isEnabled=false` ;
   * la sidebar/dashboard décide de l'afficher ou non.
   */
  async listForUser(userId: string) {
    const [modules, prefs] = await Promise.all([
      this.prisma.module.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.userModulePreference.findMany({ where: { userId } }),
    ]);
    const byKey = new Map(prefs.map((p) => [p.moduleKey, p.isVisible]));
    return modules.map((m) => ({
      ...m,
      isVisible: byKey.get(m.key) ?? true,
    }));
  }

  async setUserPreference(userId: string, moduleKey: string, isVisible: boolean) {
    const exists = await this.prisma.module.findUnique({ where: { key: moduleKey } });
    if (!exists) return null;
    return this.prisma.userModulePreference.upsert({
      where: { userId_moduleKey: { userId, moduleKey } },
      create: { userId, moduleKey, isVisible },
      update: { isVisible },
    });
  }

  async update(key: string, isEnabled: boolean, userId?: string) {
    const module = await this.prisma.module.update({
      where: { key },
      data: { isEnabled },
    });

    this.moduleCache.invalidate(key);

    if (userId) {
      await this.core.logActivity(
        userId,
        isEnabled ? 'module.enabled' : 'module.disabled',
        'core',
        'module',
        key,
      );
    }

    return module;
  }
}
