import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { ErrorLoggingFilter } from './error-logging.filter';

@Module({
  controllers: [CoreController],
  providers: [
    CoreService,
    {
      provide: APP_FILTER,
      useClass: ErrorLoggingFilter,
    },
  ],
  exports: [CoreService],
})
export class CoreModule {}
