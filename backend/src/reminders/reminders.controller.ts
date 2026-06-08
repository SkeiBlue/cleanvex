import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RemindersService } from './reminders.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /**
   * Déclencher un rappel test immédiat (debug / vérification du SMTP).
   * Non consommé par le frontend : usage prévu via curl ou cron externe.
   * À conserver tant que le canal d'envoi des rappels peut être configuré
   * manuellement (toute suppression doit aussi retirer la mention dans la doc).
   */
  @Post('trigger')
  triggerNow(@Req() req: AuthenticatedRequest) {
    return this.reminders.triggerNow(req.user.id);
  }
}
