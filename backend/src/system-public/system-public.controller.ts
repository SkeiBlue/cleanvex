import { Controller, Get } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { Throttle } from '@nestjs/throttler';
import { UpdateJobService } from '../admin/update-job.service';
import { AppSettingsService } from '../app-settings/app-settings.service';

const LOCK_FILE = '/tmp/monespace-update.lock';

/**
 * Endpoints PUBLICS de l'état système — pas de JwtAuthGuard.
 * Pour l'instant : juste `maintenance` pour permettre au frontend de tous
 * les utilisateurs (admin ou non) de détecter une mise à jour en cours et
 * afficher un overlay bloquant pour les non-admins.
 *
 * Le rate limit reste généreux : ces endpoints sont poll régulièrement.
 */
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('system')
export class SystemPublicController {
  constructor(
    private readonly updates: UpdateJobService,
    private readonly settings: AppSettingsService,
  ) {}

  @Get('maintenance')
  maintenance(): { active: boolean; since: string | null } {
    const current = this.updates.current();

    if (
      current &&
      (current.status === 'pending' || current.status === 'running')
    ) {
      return { active: true, since: current.startedAt };
    }

    if (existsSync(LOCK_FILE)) {
      return { active: true, since: null };
    }

    return { active: false, since: null };
  }

  // Sprint 3 — exposé publiquement pour que le formulaire d'inscription
  // soit masqué côté client si l'admin a désactivé l'inscription publique.
  @Get('signup-enabled')
  async signupEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: await this.settings.isSignupEnabled() };
  }
}
