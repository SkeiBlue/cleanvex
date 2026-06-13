import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CoreService } from '../core/core.service';
import { SystemService } from './system.service';
import { UpdateJobService } from './update-job.service';

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/system')
export class SystemController {
  constructor(
    private readonly system: SystemService,
    private readonly updates: UpdateJobService,
    private readonly core: CoreService,
  ) {}

  @Get('version')
  version() {
    return this.system.getVersionStatus();
  }

  @Post('check')
  async check() {
    await this.system.getRemoteInfo(true);
    return this.system.getVersionStatus();
  }

  @Post('update')
  async update(@Req() req: AuthRequest) {
    const job = this.updates.start(req.user?.email ?? 'unknown');
    if (req.user?.id) {
      await this.core.logActivity(
        req.user.id,
        'system.update.start',
        'admin',
        'update-job',
        job.id,
      );
    }
    // Renvoie `id` (pas `jobId`) pour rester cohérent avec GET /update/current
    // et GET /update/:id qui renvoient l'objet UpdateJob complet (avec `id`).
    // Le frontend faisait `setJob({ ...data })` puis `GET /update/${job.id}` :
    // avec `jobId`, job.id était undefined → 404 silencieux → l'overlay
    // restait bloqué en "Connexion au backend perdue".
    return { id: job.id, status: job.status, startedAt: job.startedAt };
  }

  @Get('update/current')
  current() {
    return this.updates.current();
  }

  @Get('update/:id')
  status(@Param('id') id: string) {
    return this.updates.get(id);
  }
}
