import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreService } from '../core/core.service';

type AuthRequest = Request & {
  user: { id: string; email: string; role: string };
};

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly core: CoreService,
  ) {}

  /** Liste paginée des utilisateurs */
  @Get('users')
  async list(
    @Query('q') q?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { username: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          emailVerified: true,
          totpEnabled: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);
    return { data: items, meta: { total, page: p, limit: l } };
  }

  /** Statistiques globales */
  @Get('stats')
  async stats() {
    const [
      totalUsers,
      activeUsers,
      admins,
      emailsVerified,
      docsCount,
      propsCount,
      vehiclesCount,
      contactsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.document.count(),
      this.prisma.property.count(),
      this.prisma.vehicle.count(),
      this.prisma.contact.count(),
    ]);
    return {
      users: { total: totalUsers, active: activeUsers, admins, emailsVerified },
      content: {
        documents: docsCount,
        properties: propsCount,
        vehicles: vehiclesCount,
        contacts: contactsCount,
      },
    };
  }

  /** Code d'invitation actuel (lecture seule, depuis env) */
  @Get('invite-code')
  inviteCode() {
    const code = this.config.get<string>('SIGNUP_INVITE_CODE') ?? '';
    return { code, hasCode: code.length > 0 };
  }

  /** Derniers logs d'audit */
  @Get('audit-logs')
  async audit(@Query('limit') limit = '50') {
    const l = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
    const items = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: l,
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });
    return { data: items };
  }

  /** Change le rôle d'un utilisateur */
  @Patch('users/:id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { role: 'admin' | 'user' },
    @Req() req: AuthRequest,
  ) {
    if (!['admin', 'user'].includes(body.role)) {
      throw new BadRequestException('Role must be admin or user');
    }
    if (id === req.user.id && body.role !== 'admin') {
      throw new ForbiddenException(
        'Tu ne peux pas te retirer tes droits admin',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: { id: true, email: true, role: true },
    });
    // Révoque les sessions actives : un changement de rôle doit prendre effet
    // immédiatement, pas seulement à la prochaine expiration de l'access token.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.core.logAudit(req.user.id, 'admin.user.role_changed', {
      ip: req.ip,
    });
    return updated;
  }

  /** Édite les infos d'un utilisateur (email, username) */
  @Patch('users/:id')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: { email?: string; username?: string },
    @Req() req: AuthRequest,
  ) {
    const data: { email?: string; username?: string | null } = {};
    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Email invalide');
      }
      // Vérifie unicité
      const dup = await this.prisma.user.findFirst({
        where: { email, id: { not: id } },
        select: { id: true },
      });
      if (dup)
        throw new BadRequestException('Email déjà utilisé par un autre compte');
      data.email = email;
    }
    if (typeof body.username === 'string') {
      data.username = body.username.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Rien à modifier');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
      },
    });
    await this.core.logAudit(req.user.id, 'admin.user.updated', {
      ip: req.ip,
      targetType: 'user',
      targetId: id,
    });
    return updated;
  }

  /** Force la vérification de l'email */
  @Post('users/:id/verify-email')
  async verifyEmail(@Param('id') id: string, @Req() req: AuthRequest) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, emailVerified: true },
    });
    await this.core.logAudit(req.user.id, 'admin.user.email_verified', {
      ip: req.ip,
      targetType: 'user',
      targetId: id,
    });
    return updated;
  }

  /** Désactive le 2FA (TOTP) de force */
  @Post('users/:id/disable-2fa')
  async disable2fa(@Param('id') id: string, @Req() req: AuthRequest) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { totpEnabled: false, totpSecret: null },
      select: { id: true, email: true, totpEnabled: true },
    });
    await this.core.logAudit(req.user.id, 'admin.user.2fa_disabled', {
      ip: req.ip,
      targetType: 'user',
      targetId: id,
    });
    return updated;
  }

  /** Réinitialise le mot de passe (admin choisit le nouveau) */
  @Post('users/:id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
    @Req() req: AuthRequest,
  ) {
    if (!body.newPassword || body.newPassword.length < 8) {
      throw new BadRequestException(
        'Le mot de passe doit faire au moins 8 caractères',
      );
    }
    const hash = await bcrypt.hash(body.newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
    // Révoque tous les refresh tokens actifs pour forcer le user à se reconnecter
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.core.logAudit(req.user.id, 'admin.user.password_reset', {
      ip: req.ip,
      targetType: 'user',
      targetId: id,
    });
    return { ok: true };
  }

  /** Active/désactive un compte */
  @Patch('users/:id/active')
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: AuthRequest,
  ) {
    if (id === req.user.id && !body.isActive) {
      throw new ForbiddenException(
        'Tu ne peux pas désactiver ton propre compte',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !!body.isActive },
      select: { id: true, email: true, isActive: true },
    });
    if (!body.isActive) {
      // Désactivation : coupe l'accès immédiatement plutôt que d'attendre
      // l'expiration de l'access token (jusqu'à JWT_ACCESS_EXPIRES_IN).
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.core.logAudit(
      req.user.id,
      body.isActive ? 'admin.user.activated' : 'admin.user.deactivated',
      {
        ip: req.ip,
      },
    );
    return updated;
  }
}
