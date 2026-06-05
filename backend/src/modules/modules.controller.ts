import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModulesService } from './modules.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  list() {
    return this.modules.list();
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.modules.update(key, dto.isEnabled, req.user.id);
  }
}
