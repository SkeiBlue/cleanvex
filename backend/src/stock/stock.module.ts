import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [CoreModule],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
