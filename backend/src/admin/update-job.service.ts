import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const LOCK_FILE = '/tmp/monespace-update.lock';

// Persistance du job en cours sur disque pour survivre aux crashs/restarts
// (OOM pendant `vite build`, restart final par server-start.sh, etc.) :
// sans ça, l'overlay frontend ne pouvait jamais retrouver le job après le
// reboot du backend → restait figé en "Connexion au backend perdue".
const PERSIST_DIR = join(PROJECT_ROOT, 'logs');
const PERSIST_FILE = join(PERSIST_DIR, 'update-job-current.json');

// Limite de logs stockés en mémoire/disque : un build verbose peut produire
// >10k lignes, ce qui surcharge inutilement la réponse JSON.
const MAX_LOG_LINES = 2000;

// Fréquence d'écriture disque pendant la phase 'running' : on ne flush pas
// à chaque ligne (perf), on bufferise un peu.
const PERSIST_THROTTLE_MS = 500;

export type UpdateStatus = 'pending' | 'running' | 'success' | 'error';

export interface UpdateJob {
  id: string;
  status: UpdateStatus;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  logs: string[];
  startedBy: string;
}

@Injectable()
export class UpdateJobService implements OnModuleInit {
  private readonly logger = new Logger('UpdateJob');
  private readonly jobs = new Map<string, UpdateJob>();
  private currentJobId: string | null = null;
  private pendingPersistTimer: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    this.restoreFromDisk();
  }

  start(userEmail: string): UpdateJob {
    if (this.currentJobId) {
      const current = this.jobs.get(this.currentJobId);
      if (current && (current.status === 'pending' || current.status === 'running')) {
        throw new ConflictException('Une mise à jour est déjà en cours.');
      }
    }
    if (existsSync(LOCK_FILE)) {
      throw new ConflictException('Lock file présent : une mise à jour est déjà en cours.');
    }

    const job: UpdateJob = {
      id: randomUUID(),
      status: 'pending',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      logs: [],
      startedBy: userEmail,
    };
    this.jobs.set(job.id, job);
    this.currentJobId = job.id;
    this.persistNow(job);

    this.run(job);
    return job;
  }

  private run(job: UpdateJob): void {
    job.status = 'running';
    this.persistNow(job);

    const proc = spawn('bash', ['./update.sh'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      detached: false,
    });

    const push = (chunk: Buffer) => {
      const text = chunk.toString().replace(/\[[0-9;]*m/g, '');
      for (const line of text.split('\n')) {
        if (line.trim()) {
          job.logs.push(line);
          if (job.logs.length > MAX_LOG_LINES) job.logs.shift();
        }
      }
      this.persistThrottled(job);
    };
    proc.stdout.on('data', push);
    proc.stderr.on('data', push);

    proc.on('close', (code) => {
      job.exitCode = code;
      job.status = code === 0 ? 'success' : 'error';
      job.finishedAt = new Date().toISOString();
      this.logger.log(`Update job ${job.id} terminé: ${job.status} (exit ${code})`);
      if (this.currentJobId === job.id) this.currentJobId = null;
      this.persistNow(job);
    });

    proc.on('error', (err) => {
      job.status = 'error';
      job.logs.push(`spawn error: ${err.message}`);
      job.finishedAt = new Date().toISOString();
      if (this.currentJobId === job.id) this.currentJobId = null;
      this.persistNow(job);
    });
  }

  get(id: string): UpdateJob {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job introuvable.');
    return job;
  }

  current(): UpdateJob | null {
    if (!this.currentJobId) return null;
    return this.jobs.get(this.currentJobId) ?? null;
  }

  /* ──────────────────────── persistance disque ──────────────────────── */

  private persistNow(job: UpdateJob): void {
    if (this.pendingPersistTimer) {
      clearTimeout(this.pendingPersistTimer);
      this.pendingPersistTimer = null;
    }
    try {
      if (!existsSync(PERSIST_DIR)) mkdirSync(PERSIST_DIR, { recursive: true });
      writeFileSync(PERSIST_FILE, JSON.stringify(job));
    } catch (err) {
      this.logger.warn(`persistNow failed: ${(err as Error).message}`);
    }
  }

  private persistThrottled(job: UpdateJob): void {
    if (this.pendingPersistTimer) return;
    this.pendingPersistTimer = setTimeout(() => {
      this.pendingPersistTimer = null;
      this.persistNow(job);
    }, PERSIST_THROTTLE_MS);
  }

  /**
   * Au démarrage : si un job était sauvegardé sur disque, on le restaure.
   * Si son statut était 'running' / 'pending' alors que le lock file n'existe
   * plus, le script s'est probablement terminé pendant qu'on était down
   * (OOM, restart). On infère 'success' avec un commentaire honnête dans les
   * logs pour que l'overlay frontend puisse afficher le résultat correctement.
   */
  private restoreFromDisk(): void {
    try {
      if (!existsSync(PERSIST_FILE)) return;
      const raw = readFileSync(PERSIST_FILE, 'utf-8');
      const job = JSON.parse(raw) as UpdateJob;

      if (!job || typeof job.id !== 'string') return;

      const wasInFlight = job.status === 'pending' || job.status === 'running';
      if (wasInFlight && !existsSync(LOCK_FILE)) {
        job.status = 'success';
        job.exitCode = job.exitCode ?? 0;
        job.finishedAt = job.finishedAt ?? new Date().toISOString();
        job.logs.push(
          '[backend redémarré] Le script update.sh s\'est terminé pendant que le backend était down (OOM ou restart). ' +
          'Résultat inféré : success (lock libéré).',
        );
        this.persistNow(job);
        this.logger.log(`Update job ${job.id} restauré → success (script terminé pendant downtime)`);
      } else if (wasInFlight) {
        // Lock encore présent → le script tourne probablement encore. On le
        // remet en 'running' pour qu'un éventuel poll de l'overlay continue.
        this.logger.log(`Update job ${job.id} restauré → ${job.status} (lock présent, script en cours)`);
      } else {
        this.logger.log(`Update job ${job.id} restauré → ${job.status} (terminal)`);
      }

      this.jobs.set(job.id, job);
      // currentJobId : on ne le repointe que si le job était encore en cours
      // ET que le lock est encore là, pour permettre un nouveau start sinon.
      if (wasInFlight && existsSync(LOCK_FILE)) {
        this.currentJobId = job.id;
      }
    } catch (err) {
      this.logger.warn(`restoreFromDisk failed: ${(err as Error).message}`);
    }
  }
}
