import { Injectable } from '@nestjs/common';
import { CoreService } from '../core/core.service';
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
  ) {}

  async seedDefaults() {
    await Promise.all(
      CORE_MODULES.map((module) =>
        this.prisma.module.upsert({
          where: { key: module.key },
          update: {},
          create: { ...module, isEnabled: ['dashboard', 'documents'].includes(module.key) },
        }),
      ),
    );
  }

  list() {
    return this.prisma.module.findMany({ orderBy: { title: 'asc' } });
  }

  async update(key: string, isEnabled: boolean, userId?: string) {
    const module = await this.prisma.module.update({
      where: { key },
      data: { isEnabled },
    });

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
