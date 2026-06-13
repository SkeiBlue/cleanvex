import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly storageRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.storageRoot = resolve(
      config.get<string>('PRIVATE_FILES_DIR', 'private-files'),
    );
  }

  /**
   * Génère à la volée une archive ZIP contenant `manifest.json` (toutes les
   * données de l'utilisateur au format JSON) et `files/` (fichiers privés
   * existants sur disque), et la stream directement vers la réponse HTTP.
   * Rien n'est écrit sur disque côté serveur.
   */
  async streamExport(userId: string, res: Response): Promise<void> {
    const data = await this.collectUserData(userId);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (err: Error) =>
      this.logger.warn(`Archive warning: ${err.message}`),
    );
    archive.on('error', (err: Error) => {
      throw err;
    });
    archive.pipe(res);

    const manifest = {
      generatedAt: new Date().toISOString(),
      user: data.user,
      settings: data.settings,
      vehicles: data.vehicles,
      properties: data.properties,
      contacts: data.contacts,
      finances: {
        accounts: data.financialAccounts,
        categories: data.financialCategories,
        transactions: data.transactions,
      },
      stock: {
        items: data.stockItems,
        movements: data.stockMovements,
        toolLoans: data.toolLoans,
      },
      agenda: {
        tasks: data.tasks,
        notifications: data.notifications,
      },
      documents: data.documents.map(
        ({ storagePath: _storagePath, ...meta }) => meta,
      ),
      logs: {
        activity: data.activity,
        audit: data.audit,
      },
    };

    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json',
    });

    for (const doc of data.documents) {
      const absolutePath = join(this.storageRoot, doc.storagePath);
      if (existsSync(absolutePath)) {
        archive.file(absolutePath, { name: `files/${doc.id}-${doc.name}` });
      }
    }

    await archive.finalize();
  }

  private async collectUserData(userId: string) {
    const [
      user,
      settings,
      vehicles,
      properties,
      contacts,
      financialAccounts,
      financialCategories,
      transactions,
      stockItems,
      stockMovements,
      toolLoans,
      tasks,
      notifications,
      documents,
      activity,
      audit,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.userSetting.findMany({
        where: { userId },
        orderBy: { key: 'asc' },
      }),
      this.prisma.vehicle.findMany({
        where: { ownerId: userId },
        include: {
          mileageLogs: true,
          interventions: true,
          alerts: true,
          parts: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.property.findMany({
        where: { ownerId: userId },
        include: { events: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contact.findMany({
        where: { ownerId: userId },
        include: { interactions: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.financialAccount.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.financialCategory.findMany({
        where: { ownerId: userId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.financialTransaction.findMany({
        where: { ownerId: userId },
        orderBy: { operationDate: 'asc' },
      }),
      this.prisma.stockItem.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.stockMovement.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.toolLoan.findMany({
        where: { ownerId: userId },
        orderBy: { loanDate: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { ownerId: userId },
        include: { subtasks: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.notification.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      user,
      settings,
      vehicles,
      properties,
      contacts,
      financialAccounts,
      financialCategories,
      transactions,
      stockItems,
      stockMovements,
      toolLoans,
      tasks,
      notifications,
      documents,
      activity,
      audit,
    };
  }
}
