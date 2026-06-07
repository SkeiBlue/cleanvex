import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { CoreService } from '../core/core.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const REFRESH_COOKIE_NAME = 'refresh_token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly core: CoreService,
    private readonly mail: MailService,
  ) {}

  get refreshCookieName() {
    return REFRESH_COOKIE_NAME;
  }

  async register(dto: RegisterDto, meta: { ip?: string; userAgent?: string }) {
    this.assertInviteCode(dto.inviteCode);
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: 'user',
        isActive: true,
        emailVerified: false,
      },
    });

    const verification = await this.createEmailVerificationToken(user.id);
    const emailDelivery = await this.mail.sendVerificationEmail(
      user.email,
      verification.raw,
    );
    await this.core.logAudit(user.id, 'auth.register', meta);
    await this.core.logActivity(user.id, 'auth.register', 'core', 'user', user.id);

    return {
      user: this.publicUser(user),
      emailDelivery,
      verification: this.publicVerificationToken(verification.raw),
    };
  }

  async verifyEmail(dto: VerifyEmailDto, meta: { ip?: string; userAgent?: string }) {
    const candidates = await this.prisma.emailVerificationToken.findMany({
      where: {
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const current = candidates.find((token) =>
      bcrypt.compareSync(dto.token, token.tokenHash),
    );

    if (!current) {
      throw new BadRequestException('Invalid verification token');
    }

    const user = await this.prisma.user.update({
      where: { id: current.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await this.prisma.emailVerificationToken.update({
      where: { id: current.id },
      data: { consumedAt: new Date() },
    });
    await this.core.logAudit(user.id, 'auth.email_verified', meta);
    await this.core.logActivity(user.id, 'auth.email_verified', 'core', 'user', user.id);

    return { user: this.publicUser(user) };
  }

  async resendVerification(
    dto: ResendVerificationDto,
    meta: { ip?: string; userAgent?: string },
  ) {
    this.assertInviteCode(dto.inviteCode);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || user.emailVerified) {
      return { sent: true };
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const verification = await this.createEmailVerificationToken(user.id);
    const emailDelivery = await this.mail.sendVerificationEmail(
      user.email,
      verification.raw,
    );
    await this.core.logAudit(user.id, 'auth.email_verification_resent', meta);

    return {
      sent: true,
      emailDelivery,
      verification: this.publicVerificationToken(verification.raw),
    };
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email is not verified');
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA — vérifié après le mot de passe, avant l'émission du token
    if (user.totpEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('2FA code required');
      }
      const valid2fa = await this.verify2fa(user.id, dto.totpCode);
      if (!valid2fa) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const refresh = await this.createRefreshToken(user.id, meta);
    await this.core.logAudit(user.id, 'auth.login', meta);
    await this.core.logActivity(user.id, 'auth.login', 'core', 'user', user.id);
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: refresh.raw,
      user: this.publicUser(user),
    };
  }

  async refresh(rawToken: string | undefined, meta: { ip?: string; userAgent?: string }) {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const current = await this.resolveRefreshToken(rawToken);

    if (!current || !current.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const next = await this.createRefreshToken(current.userId, meta);
    await this.prisma.refreshToken.update({
      where: { id: current.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedByTokenId: next.id,
      },
    });
    await this.core.logAudit(current.userId, 'auth.refresh', meta);

    return {
      accessToken: await this.signAccessToken(current.user),
      refreshToken: next.raw,
      user: this.publicUser(current.user),
    };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) {
      return;
    }

    const current = await this.resolveRefreshToken(rawToken);

    if (current) {
      await this.prisma.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: new Date() },
      });
      await this.core.logAudit(current.userId, 'auth.logout');
      await this.core.logActivity(current.userId, 'auth.logout', 'core', 'user', current.userId);
    }
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.core.logAudit(userId, 'auth.logout_all');
    await this.core.logActivity(userId, 'auth.logout_all', 'core', 'user', userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.core.logAudit(userId, 'auth.password_changed');
    await this.core.logActivity(userId, 'auth.password_changed', 'core', 'user', userId);
    return { success: true };
  }

  async forgotPassword(email: string) {
    // Réponse identique que l'email existe ou non (anti-énumération)
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !user.emailVerified) return { sent: true };

    // Invalider les anciens tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const raw = randomBytes(32).toString('base64url');
    const tokenHash = await bcrypt.hash(raw, 12);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });

    await this.mail.sendPasswordResetEmail(user.email, raw);
    await this.core.logAudit(user.id, 'auth.forgot_password');
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { consumedAt: null, expiresAt: { gt: new Date() } },
    });

    const current = candidates.find(t => bcrypt.compareSync(token, t.tokenHash));
    if (!current) throw new BadRequestException('Token invalide ou expiré.');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: current.userId }, data: { passwordHash: hash } });
    await this.prisma.passwordResetToken.update({
      where: { id: current.id },
      data: { consumedAt: new Date() },
    });
    // Révoquer toutes les sessions actives par sécurité
    await this.prisma.refreshToken.updateMany({
      where: { userId: current.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.core.logAudit(current.userId, 'auth.password_reset');
    return { success: true };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new UnauthorizedException('Session introuvable');
    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.core.logAudit(userId, 'auth.session_revoked', { targetId: sessionId });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.publicUser(user);
  }

  private async signAccessToken(user: { id: string; email: string; role: string }) {
    const options: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    };

    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      options,
    );
  }

  private async createRefreshToken(
    userId: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const secret = randomBytes(48).toString('base64url');
    const tokenHash = await bcrypt.hash(secret, 12);
    const days = Number(this.config.get<string>('JWT_REFRESH_DAYS', '14'));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const token = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    // Format `<id>.<secret>` → permet un lookup O(1) au refresh sans
    // itérer sur tous les tokens en DB (cf. resolveRefreshToken).
    return { ...token, raw: `${token.id}.${secret}` };
  }

  /**
   * Résout un raw token (nouveau format `<id>.<secret>` ou ancien) vers
   * son enregistrement DB + user. Retourne null si invalide/expiré/révoqué.
   * Path rapide pour les nouveaux tokens (1 lookup + 1 bcrypt), fallback
   * O(N) pour les anciens (jusqu'à leur prochain refresh).
   */
  private async resolveRefreshToken(rawToken: string) {
    const now = new Date();
    const dotIdx = rawToken.indexOf('.');
    if (dotIdx > 0) {
      const id = rawToken.slice(0, dotIdx);
      const secret = rawToken.slice(dotIdx + 1);
      const token = await this.prisma.refreshToken.findUnique({
        where: { id },
        include: { user: true },
      });
      if (
        token &&
        !token.revokedAt &&
        token.expiresAt > now &&
        (await bcrypt.compare(secret, token.tokenHash))
      ) {
        return token;
      }
      return null;
    }
    // Legacy : ancien token sans id encodé → balayage O(N).
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
    return (
      candidates.find((t) => bcrypt.compareSync(rawToken, t.tokenHash)) ?? null
    );
  }

  private async createEmailVerificationToken(userId: string) {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = await bcrypt.hash(raw, 12);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const token = await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { ...token, raw };
  }

  private assertInviteCode(inviteCode?: string) {
    const expected = this.config.get<string>('SIGNUP_INVITE_CODE');
    if (expected && inviteCode !== expected) {
      throw new ForbiddenException('Invalid invite code');
    }
  }

  /* ── 2FA TOTP ────────────────────────────────────────────────── */
  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'Plateforme Personnelle',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    // Persist secret (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret.base32 },
    });

    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 256, margin: 2, color: { dark: '#a78bfa', light: '#0c1029' } });
    return { secret: secret.base32, qrDataUrl, uri };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('Setup 2FA first.');
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totpSecret), algorithm: 'SHA1', digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) throw new BadRequestException('Code invalide.');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return { enabled: true };
  }

  async disable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('2FA non configuré.');
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totpSecret), algorithm: 'SHA1', digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) throw new BadRequestException('Code invalide.');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } });
    return { enabled: false };
  }

  async verify2fa(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret || !user.totpEnabled) return true; // 2FA not active
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totpSecret), algorithm: 'SHA1', digits: 6, period: 30 });
    return totp.validate({ token: code, window: 1 }) !== null;
  }

  private publicVerificationToken(raw: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      return undefined;
    }
    return { token: raw };
  }

  private publicUser(user: {
    id: string;
    email: string;
    username: string | null;
    role: string;
    emailVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }
}
