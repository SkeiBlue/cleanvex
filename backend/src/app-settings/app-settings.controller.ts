import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppSettingsService } from './app-settings.service';

class SignupEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/app-settings')
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get('signup-enabled')
  async getSignupEnabled() {
    return { enabled: await this.settings.isSignupEnabled() };
  }

  @Put('signup-enabled')
  async setSignupEnabled(@Body() dto: SignupEnabledDto) {
    await this.settings.setSignupEnabled(dto.enabled);
    return { enabled: dto.enabled };
  }
}
