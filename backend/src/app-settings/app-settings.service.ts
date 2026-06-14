import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const APP_SETTING_KEYS = {
  signupEnabled: 'system.signup_enabled',
} as const;

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T = unknown>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? (row.valueJson as unknown as T) : fallback;
  }

  async set(key: string, value: unknown) {
    return this.prisma.appSetting.upsert({
      where: { key },
      create: { key, valueJson: value as never },
      update: { valueJson: value as never },
    });
  }

  async isSignupEnabled(): Promise<boolean> {
    return this.get<boolean>(APP_SETTING_KEYS.signupEnabled, false);
  }

  async setSignupEnabled(enabled: boolean) {
    return this.set(APP_SETTING_KEYS.signupEnabled, enabled);
  }
}
