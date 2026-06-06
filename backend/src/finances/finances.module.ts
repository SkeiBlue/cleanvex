import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

@Module({
  imports: [CoreModule],
  controllers: [FinancesController],
  providers: [FinancesService],
})
export class FinancesModule {}
