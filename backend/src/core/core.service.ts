import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class CoreService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const [user, sessions] = await Promise.all([
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
      this.prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        // RGPD : pas d'adresse IP exposée à l'utilisateur. Le user-agent reste
        // pour permettre d'identifier l'appareil (navigateur) dans la liste des
        // sessions actives.
        select: {
          id: true,
          userAgent: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    ]);

    return { user, sessions };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        emailVerified: true,
      },
    });

    await this.logActivity(userId, 'profile.updated', 'core', 'user', userId);
    return user;
  }

  async settings(userId: string) {
    return this.prisma.userSetting.findMany({
      where: { userId },
      orderBy: { key: 'asc' },
    });
  }

  async upsertSetting(userId: string, key: string, value: unknown) {
    const valueJson = this.toJsonValue(value);
    const setting = await this.prisma.userSetting.upsert({
      where: { userId_key: { userId, key } },
      update: { valueJson },
      create: { userId, key, valueJson },
    });

    await this.logActivity(userId, 'setting.updated', 'core', 'setting', key);
    return setting;
  }

  async activity(userId: string) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async audit(userId: string) {
    // RGPD / minimisation des données : l'endpoint utilisateur ne renvoie PAS
    // l'adresse IP ni le user-agent. Ces données restent stockées et ne sont
    // exposées qu'aux administrateurs (GET /admin/audit-logs) pour la sécurité.
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
      },
    });
  }

  async errors() {
    return this.prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  logActivity(
    userId: string | null,
    action: string,
    moduleKey?: string,
    targetType?: string,
    targetId?: string,
  ) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        action,
        moduleKey,
        targetType,
        targetId,
      },
    });
  }

  logAudit(
    userId: string | null,
    action: string,
    meta: {
      ip?: string;
      userAgent?: string;
      targetType?: string;
      targetId?: string;
    } = {},
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType: meta.targetType,
        targetId: meta.targetId,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
