import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpdateUserModulePreferenceDto } from './dto/update-user-module-preference.dto';
import { ModulesService } from './modules.service';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@UseGuards(JwtAuthGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  // Vue brute des modules globaux (utilisée par l'admin).
  @Get()
  list() {
    return this.modules.list();
  }

  // Sprint 3 — vue par utilisateur, augmentée du flag isVisible (préférence
  // personnelle d'affichage). Utilisée par la sidebar et le dashboard.
  @Get('me')
  listForMe(@Req() req: AuthenticatedRequest) {
    return this.modules.listForUser(req.user.id);
  }

  // Compteurs contextuels (pastilles sidebar) : { stock: 2, ... }.
  // Ne contient que les clés ayant une valeur à signaler.
  @Get('badges')
  badges(@Req() req: AuthenticatedRequest) {
    return this.modules.badgesForUser(req.user.id);
  }

  @Patch('me/:key')
  setMyPreference(
    @Param('key') key: string,
    @Body() dto: UpdateUserModulePreferenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.modules.setUserPreference(req.user.id, key, dto.isVisible);
  }

  // Modifier l'état global d'un module est une action d'administration :
  // le @Get reste ouvert à tout utilisateur authentifié, pas le @Patch.
  @UseGuards(AdminGuard)
  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.modules.update(key, dto.isEnabled, req.user.id);
  }
}
