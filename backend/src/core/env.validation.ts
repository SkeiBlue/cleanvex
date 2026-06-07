const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;
const RECOMMENDED_VARS = ['FRONTEND_ORIGIN', 'JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_DAYS'] as const;

export interface EnvCheckResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvCheckResult {
  const missing = REQUIRED_VARS.filter((k) => !env[k] || env[k]?.trim() === '');
  const warnings = RECOMMENDED_VARS.filter((k) => !env[k] || env[k]?.trim() === '');
  return { ok: missing.length === 0, missing: [...missing], warnings: [...warnings] };
}

export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  const result = checkEnv(env);
  for (const w of result.warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Variable recommandée manquante : ${w}`);
  }
  if (!result.ok) {
    throw new Error(
      `[env] Variables requises manquantes : ${result.missing.join(', ')}. Vérifiez votre fichier backend/.env.`,
    );
  }
}
