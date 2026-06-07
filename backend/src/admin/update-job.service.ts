import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const LOCK_FILE = '/tmp/monespace-update.lock';

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
export class UpdateJobService {
  private readonly logger = new Logger('UpdateJob');
  private readonly jobs = new Map<string, UpdateJob>();
  private currentJobId: string | null = null;

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

    this.run(job);
    return job;
  }

  private run(job: UpdateJob): void {
    job.status = 'running';
    const proc = spawn('bash', ['./update.sh'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      detached: false,
    });

    const push = (chunk: Buffer) => {
      const text = chunk.toString().replace(/\[[0-9;]*m/g, '');
      for (const line of text.split('\n')) {
        if (line.trim()) job.logs.push(line);
      }
    };
    proc.stdout.on('data', push);
    proc.stderr.on('data', push);

    proc.on('close', (code) => {
      job.exitCode = code;
      job.status = code === 0 ? 'success' : 'error';
      job.finishedAt = new Date().toISOString();
      this.logger.log(`Update job ${job.id} terminé: ${job.status} (exit ${code})`);
      if (this.currentJobId === job.id) this.currentJobId = null;
    });

    proc.on('error', (err) => {
      job.status = 'error';
      job.logs.push(`spawn error: ${err.message}`);
      job.finishedAt = new Date().toISOString();
      if (this.currentJobId === job.id) this.currentJobId = null;
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
}
