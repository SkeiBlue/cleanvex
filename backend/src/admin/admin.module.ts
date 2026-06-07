import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { UpdateJobService } from './update-job.service';

@Module({
  imports: [CoreModule],
  controllers: [SystemController],
  providers: [SystemService, UpdateJobService],
})
export class AdminModule {}
