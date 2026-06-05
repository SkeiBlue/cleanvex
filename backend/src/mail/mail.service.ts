import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  get isEnabled() {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async sendVerificationEmail(email: string, token: string) {
    if (!this.isEnabled) {
      this.logger.debug('SMTP disabled, verification email not sent.');
      return { sent: false };
    }

    const frontendUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:5173');
    const verifyUrl = `${frontendUrl}/?verifyToken=${encodeURIComponent(token)}`;
    const transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: this.smtpAuth(),
    });

    try {
      await transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM', 'Personal Platform <no-reply@example.local>'),
        to: email,
        subject: 'Verification de ton email',
        text: `Clique sur ce lien pour verifier ton email: ${verifyUrl}`,
        html: `<p>Clique sur ce lien pour verifier ton email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      });

      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      this.logger.warn(message);
      return { sent: false, error: message };
    }
  }

  private smtpAuth() {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!user || !pass) return undefined;
    return { user, pass };
  }
}
