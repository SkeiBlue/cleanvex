import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

@Module({
  imports: [CoreModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule implements OnApplicationBootstrap {
  constructor(private readonly modules: ModulesService) {}

  async onApplicationBootstrap() {
    await this.modules.seedDefaults();
  }
}
