import { Body, Controller, Get, Param, Patch, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreService } from './core.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller()
export class CoreController {
  constructor(private readonly core: CoreService) {}

  @Get('profile')
  profile(@Req() req: AuthenticatedRequest) {
    return this.core.profile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.core.updateProfile(req.user.id, dto);
  }

  @Get('settings')
  settings(@Req() req: AuthenticatedRequest) {
    return this.core.settings(req.user.id);
  }

  @Put('settings/:key')
  upsertSetting(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.core.upsertSetting(req.user.id, key, dto.value);
  }

  @Get('activity')
  activity(@Req() req: AuthenticatedRequest) {
    return this.core.activity(req.user.id);
  }

  @Get('audit')
  audit(@Req() req: AuthenticatedRequest) {
    return this.core.audit(req.user.id);
  }

  @UseGuards(AdminGuard)
  @Get('errors')
  errors() {
    return this.core.errors();
  }
}
