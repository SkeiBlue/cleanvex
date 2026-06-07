import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SystemService } from './system.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('version')
  version() {
    return this.system.getVersionStatus();
  }

  @Post('check')
  async check() {
    await this.system.getRemoteInfo(true);
    return this.system.getVersionStatus();
  }
}
