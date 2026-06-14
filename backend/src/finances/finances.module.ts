import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

@Module({
  imports: [CoreModule],
  controllers: [FinancesController, BudgetsController],
  providers: [FinancesService, BudgetsService],
})
export class FinancesModule {}
