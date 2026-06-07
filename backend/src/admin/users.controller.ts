import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreService } from '../core/core.service';

type AuthRequest = Request & { user: { id: string; email: string; role: string } };

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
  async list(@Query('q') q?: string, @Query('page') page = '1', @Query('limit') limit = '50') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const where = q
      ? { OR: [
          { email:    { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
        ] }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, skip: (p - 1) * l, take: l,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true, role: true,
          isActive: true, emailVerified: true, totpEnabled: true,
          lastLoginAt: true, createdAt: true,
        },
      }),
    ]);
    return { data: items, meta: { total, page: p, limit: l } };
  }

  /** Statistiques globales */
  @Get('stats')
  async stats() {
    const [
      totalUsers, activeUsers, admins, emailsVerified,
      docsCount, propsCount, vehiclesCount, contactsCount,
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
      throw new ForbiddenException('Tu ne peux pas te retirer tes droits admin');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: { id: true, email: true, role: true },
    });
    await this.core.logAudit(req.user.id, 'admin.user.role_changed', {
      ip: req.ip,
    });
    return updated;
  }

  /** Active/désactive un compte */
  @Patch('users/:id/active')
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: AuthRequest,
  ) {
    if (id === req.user.id && !body.isActive) {
      throw new ForbiddenException('Tu ne peux pas désactiver ton propre compte');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !!body.isActive },
      select: { id: true, email: true, isActive: true },
    });
    await this.core.logAudit(req.user.id, body.isActive ? 'admin.user.activated' : 'admin.user.deactivated', {
      ip: req.ip,
    });
    return updated;
  }
}
