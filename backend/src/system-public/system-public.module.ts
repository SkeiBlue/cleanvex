import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { SystemPublicController } from './system-public.controller';

@Module({
  // AdminModule expose UpdateJobService (à confirmer côté admin.module.ts).
  imports: [AdminModule],
  controllers: [SystemPublicController],
})
export class SystemPublicModule {}
