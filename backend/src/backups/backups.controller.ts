import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupsService } from './backups.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get('export.zip')
  async exportZip(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const filename = `personal-platform-export-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await this.backups.streamExport(req.user.id, res);
  }
}
