import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { SystemPublicController } from './system-public.controller';

@Module({
  imports: [AdminModule, AppSettingsModule],
  controllers: [SystemPublicController],
})
export class SystemPublicModule {}
