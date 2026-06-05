import { PrismaPg } from '@prisma/adapter-pg';

export function createPrismaClientOptions() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    adapter: new PrismaPg({ connectionString }),
  };
}
