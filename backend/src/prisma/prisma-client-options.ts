import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export function createPrismaClientOptions() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  // Pool pg explicite : on active keepAlive pour que la socket survive
  // aux NAT/SSH timeouts (sinon "Connection terminated unexpectedly").
  const pool = new Pool({
    connectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Ne pas crasher le process Node sur erreur de pool (le pool retentera)
  pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[pg-pool] connection error (handled):', err.message);
  });

  return {
    adapter: new PrismaPg(pool),
  };
}
