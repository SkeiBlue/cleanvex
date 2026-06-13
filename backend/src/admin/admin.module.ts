import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { UpdateJobService } from './update-job.service';
import { AdminUsersController } from './users.controller';

@Module({
  imports: [CoreModule],
  controllers: [SystemController, AdminUsersController],
  providers: [SystemService, UpdateJobService],
  // SystemPublicModule (endpoint public /system/maintenance) consomme
  // UpdateJobService : sans cet export, Nest crashe au démarrage avec
  // UnknownDependenciesException.
  exports: [UpdateJobService],
})
export class AdminModule {}
