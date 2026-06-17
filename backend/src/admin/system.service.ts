import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const exec = promisify(execFile);

const GITHUB_REPO = process.env.GITHUB_REPO ?? 'SkeiBlue/cleanvex';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'master';
const CACHE_TTL_MS = 5 * 60 * 1000;
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

interface RemoteCache {
  sha: string;
  fetchedAt: number;
  behindBy: number;
  commits: { sha: string; message: string; date: string }[];
}

// Cooldown par défaut après un échec (réseau, 5xx) avant de retenter GitHub.
const FAIL_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class SystemService {
  private readonly logger = new Logger('SystemService');
  private installedSha: string | null = null;
  private remoteCache: RemoteCache | null = null;
  // Cache négatif : tant que `now < cooldownUntil`, on ne retente PAS GitHub
  // (évite de marteler l'API et de saturer les logs quand le rate limit non
  // authentifié — 60 req/h — est atteint).
  private cooldownUntil = 0;
  // Déduplication : un seul appel GitHub en vol à la fois ; les polls
  // concurrents partagent la même promesse au lieu de tirer en rafale.
  private inFlight: Promise<RemoteCache | null> | null = null;

  async getInstalledSha(): Promise<string | null> {
    if (this.installedSha) return this.installedSha;
    try {
      const { stdout } = await exec('git', ['rev-parse', 'HEAD'], {
        cwd: PROJECT_ROOT,
      });
      this.installedSha = stdout.trim();
      return this.installedSha;
    } catch (err) {
      this.logger.warn(
        `Impossible de lire le SHA git: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async getRemoteInfo(force = false): Promise<RemoteCache | null> {
    if (
      !force &&
      this.remoteCache &&
      Date.now() - this.remoteCache.fetchedAt < CACHE_TTL_MS
    ) {
      return this.remoteCache;
    }
    // Cache négatif : on respecte le cooldown (sauf forçage explicite) et on
    // renvoie la dernière valeur connue (éventuellement null) sans appeler
    // GitHub. C'est ce qui stoppe le flot de 403 quand le rate limit est saturé.
    if (!force && Date.now() < this.cooldownUntil) {
      return this.remoteCache;
    }
    // Déduplication des appels concurrents : on partage la promesse en vol.
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.fetchRemoteInfo();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchRemoteInfo(): Promise<RemoteCache | null> {
    const installed = await this.getInstalledSha();
    if (!installed) return null;
    try {
      const compareUrl = `https://api.github.com/repos/${GITHUB_REPO}/compare/${installed}...${GITHUB_BRANCH}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };
      if (process.env.GITHUB_TOKEN)
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await fetch(compareUrl, { headers });
      if (!res.ok) {
        // Back-off : si c'est un rate limit, on attend la date de reset fournie
        // par GitHub (header X-RateLimit-Reset, en secondes epoch) ; sinon un
        // cooldown court. Évite de retenter à chaque poll.
        const remaining = res.headers.get('x-ratelimit-remaining');
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        if (remaining === '0' && Number.isFinite(reset) && reset > 0) {
          this.cooldownUntil = reset * 1000 + 1000;
          const waitMin = Math.ceil((this.cooldownUntil - Date.now()) / 60000);
          this.logger.warn(
            `GitHub rate limit atteint (60 req/h non authentifié). ` +
              `Prochain essai dans ~${waitMin} min. ` +
              `Définis GITHUB_TOKEN pour passer à 5000 req/h.`,
          );
        } else {
          this.cooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
          this.logger.warn(`GitHub compare ${res.status} ${res.statusText}`);
        }
        return this.remoteCache;
      }
      const data = (await res.json()) as {
        ahead_by: number;
        commits: {
          sha: string;
          commit: { message: string; author: { date: string } };
        }[];
      };
      const headSha =
        data.commits.length > 0
          ? data.commits[data.commits.length - 1].sha
          : installed;
      this.remoteCache = {
        sha: headSha,
        fetchedAt: Date.now(),
        behindBy: data.ahead_by,
        commits: data.commits.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          date: c.commit.author.date,
        })),
      };
      return this.remoteCache;
    } catch (err) {
      this.cooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
      this.logger.warn(`Erreur fetch GitHub: ${(err as Error).message}`);
      return this.remoteCache;
    }
  }

  async getVersionStatus() {
    const installed = await this.getInstalledSha();
    const remote = await this.getRemoteInfo();
    if (!installed) {
      return {
        installed: null,
        remote: null,
        upToDate: true,
        behindBy: 0,
        commits: [],
      };
    }
    if (!remote) {
      return {
        installed: installed.slice(0, 7),
        remote: null,
        upToDate: true,
        behindBy: 0,
        commits: [],
        warning: 'Impossible de joindre GitHub.',
      };
    }
    return {
      installed: installed.slice(0, 7),
      remote: remote.sha.slice(0, 7),
      upToDate: remote.behindBy === 0,
      behindBy: remote.behindBy,
      commits: remote.commits,
    };
  }
}
