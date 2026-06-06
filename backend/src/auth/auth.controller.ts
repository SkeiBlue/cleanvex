import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.meta(req));
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto, this.meta(req));
  }

  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    return this.auth.resendVerification(dto, this.meta(req));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const result = await this.auth.login(dto, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken, user: result.user });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const result = await this.auth.refresh(
      req.cookies?.[this.auth.refreshCookieName],
      this.meta(req),
    );
    this.setRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken, user: result.user });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.auth.logout(req.cookies?.[this.auth.refreshCookieName]);
    this.clearRefreshCookie(res);
    return res.status(204).send();
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    await this.auth.logoutAll(req.user.id);
    this.clearRefreshCookie(res);
    return res.status(204).send();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.user.id);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.auth.revokeSession(req.user.id, id);
  }

  /* ── 2FA ── */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2fa(@Req() req: AuthenticatedRequest) {
    return this.auth.setup2fa(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @HttpCode(200)
  enable2fa(@Req() req: AuthenticatedRequest, @Body('code') code: string) {
    return this.auth.enable2fa(req.user.id, code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(200)
  disable2fa(@Req() req: AuthenticatedRequest, @Body('code') code: string) {
    return this.auth.disable2fa(req.user.id, code);
  }

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(this.auth.refreshCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(this.auth.refreshCookieName, { path: '/api/auth' });
  }
}
