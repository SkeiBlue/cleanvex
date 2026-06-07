import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

const START_TIME = Date.now();
const SERVICE_NAME = 'personal-platform-api';
const VERSION = process.env.npm_package_version ?? '0.0.0';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', service: SERVICE_NAME };
  }

  @Get('health/full')
  async getFullHealth() {
    let dbStatus: 'up' | 'down' = 'up';
    let dbLatencyMs: number | null = null;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'down';
    }

    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      timestamp: new Date().toISOString(),
    };
  }
}
