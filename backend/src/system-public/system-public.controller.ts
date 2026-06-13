import { Controller, Get } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { Throttle } from '@nestjs/throttler';
import { UpdateJobService } from '../admin/update-job.service';

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
  constructor(private readonly updates: UpdateJobService) {}

  @Get('maintenance')
  maintenance(): { active: boolean; since: string | null } {
    const current = this.updates.current();

    // Cas principal : un job tracké en mémoire/disque est encore en cours.
    if (
      current &&
      (current.status === 'pending' || current.status === 'running')
    ) {
      return { active: true, since: current.startedAt };
    }

    // Fallback : si le lock du script existe encore, on considère qu'une MAJ
    // tourne (utile si le backend vient de redémarrer et que F1 n'a pas pu
    // restaurer le job, ou si update.sh est lancé manuellement en SSH).
    if (existsSync(LOCK_FILE)) {
      return { active: true, since: null };
    }

    return { active: false, since: null };
  }
}
