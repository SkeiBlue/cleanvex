import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { ErrorLoggingFilter } from './error-logging.filter';
import { ModuleCacheService } from './module-cache.service';

@Module({
  controllers: [CoreController],
  providers: [
    CoreService,
    ModuleCacheService,
    {
      provide: APP_FILTER,
      useClass: ErrorLoggingFilter,
    },
  ],
  exports: [CoreService, ModuleCacheService],
})
export class CoreModule {}
