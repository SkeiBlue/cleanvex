import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { DigestData } from '../reminders/reminders.service';

/** Échappe les caractères HTML spéciaux (les contenus interpolés dans les
 * templates d'email proviennent de données utilisateur — noms, titres…). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    // L'app vit sous /app/* depuis la landing : on cible directement /app/ pour
    // que AuthContext puisse intercepter ?verifyToken= au chargement.
    const verifyUrl = `${frontendUrl}/app/?verifyToken=${encodeURIComponent(token)}`;
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

  async sendReminderDigest(email: string, name: string, digest: DigestData) {
    if (!this.isEnabled) return { sent: false };

    const fmt = (d: Date | null) =>
      d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    const urgentColor = '#f87171';
    const warnColor   = '#fbbf24';
    const purpleColor = '#a78bfa';

    const buildSection = (title: string, color: string, rows: string[]) =>
      rows.length === 0 ? '' : `
        <h3 style="color:${color};font-size:14px;margin:20px 0 8px;font-family:monospace;letter-spacing:0.05em;text-transform:uppercase">${title}</h3>
        <table style="width:100%;border-collapse:collapse">
          ${rows.map(r => `<tr style="border-bottom:1px solid #1e2347">${r}</tr>`).join('')}
        </table>`;

    const td = (v: string, color = '#c9d1e0') =>
      `<td style="padding:8px 4px;font-size:13px;color:${color}">${v}</td>`;

    const alertRows = digest.vehicleAlerts.map(a =>
      td(`🚗 ${escapeHtml(a.vehicleName)} — ${escapeHtml(a.title)}`, a.isUrgent ? urgentColor : warnColor) +
      td(escapeHtml(a.type), '#7b82a8') +
      td(fmt(a.dueDate), a.isUrgent ? urgentColor : warnColor));

    const docRows = digest.expiringDocs.map(d =>
      td(`📄 ${escapeHtml(d.name)}`, d.isUrgent ? urgentColor : warnColor) +
      td('Expire le', '#7b82a8') +
      td(fmt(d.expiresAt), d.isUrgent ? urgentColor : warnColor));

    const taskRows = digest.overdueTasks.map(t =>
      td(`✅ ${escapeHtml(t.title)}`, urgentColor) +
      td(escapeHtml(t.priority), '#7b82a8') +
      td(fmt(t.dueDate), urgentColor));

    const loanRows = digest.overdueLoans.map(l =>
      td(`🔧 ${escapeHtml(l.itemName)}`, purpleColor) +
      td(`Prêté à ${escapeHtml(l.borrowerName)}`, '#7b82a8') +
      td(fmt(l.expectedReturnDate), purpleColor));

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0c1029;color:#c9d1e0;font-family:'Segoe UI',system-ui,sans-serif;padding:32px;max-width:600px;margin:0 auto">
  <div style="background:#141830;border-radius:16px;border:1px solid #1e2347;padding:28px">
    <h1 style="color:#c4b5fd;font-size:20px;margin:0 0 4px">Bonjour ${escapeHtml(name)} 👋</h1>
    <p style="color:#7b82a8;font-size:13px;margin:0 0 20px">Résumé du ${new Date().toLocaleDateString('fr-FR')} — points nécessitant ton attention.</p>
    ${buildSection('Alertes véhicules', warnColor, alertRows)}
    ${buildSection('Documents expirent bientôt', warnColor, docRows)}
    ${buildSection('Tâches en retard', urgentColor, taskRows)}
    ${buildSection('Prêts en retard', purpleColor, loanRows)}
    <hr style="border:none;border-top:1px solid #1e2347;margin:24px 0">
    <p style="color:#4a5280;font-size:11px;font-family:monospace">Ce message est envoyé automatiquement chaque matin à 08h00 depuis ta plateforme personnelle. Ne pas répondre.</p>
  </div>
</body>
</html>`;

    const text = [
      `Bonjour ${name},`,
      '',
      digest.vehicleAlerts.length > 0  ? `ALERTES VÉHICULES:\n${digest.vehicleAlerts.map(a => `  - ${a.vehicleName} / ${a.title} → ${fmt(a.dueDate)}`).join('\n')}` : '',
      digest.expiringDocs.length > 0   ? `DOCUMENTS EXPIRENT:\n${digest.expiringDocs.map(d => `  - ${d.name} → ${fmt(d.expiresAt)}`).join('\n')}` : '',
      digest.overdueTasks.length > 0   ? `TÂCHES EN RETARD:\n${digest.overdueTasks.map(t => `  - ${t.title} (dû le ${fmt(t.dueDate)})`).join('\n')}` : '',
      digest.overdueLoans.length > 0   ? `PRÊTS EN RETARD:\n${digest.overdueLoans.map(l => `  - ${l.itemName} prêté à ${l.borrowerName}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

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
        subject: `📋 Rappels du ${new Date().toLocaleDateString('fr-FR')}`,
        text,
        html,
      });
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      this.logger.warn(`Reminder email failed: ${message}`);
      return { sent: false, error: message };
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    if (!this.isEnabled) {
      this.logger.debug('SMTP disabled, password reset email not sent.');
      return { sent: false };
    }

    const frontendUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/app/reset-password?token=${encodeURIComponent(token)}`;
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
        subject: '🔑 Réinitialisation de ton mot de passe',
        text: `Clique sur ce lien pour réinitialiser ton mot de passe (valable 1h) :\n\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email.`,
        html: `
          <div style="background:#0c1029;color:#c9d1e0;font-family:system-ui,sans-serif;padding:32px;max-width:520px;margin:0 auto;border-radius:12px">
            <h2 style="color:#a78bfa;margin:0 0 16px">Réinitialisation du mot de passe</h2>
            <p>Clique sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Réinitialiser mon mot de passe</a>
            <p style="color:#475569;font-size:13px">Si tu n'as pas demandé cette réinitialisation, ignore cet email. Ton mot de passe ne sera pas modifié.</p>
          </div>`,
      });
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      this.logger.warn(`Password reset email failed: ${message}`);
      return { sent: false, error: message };
    }
  }

  /**
   * Envoie un message du formulaire de contact (landing publique) vers
   * CONTACT_EMAIL (ou MAIL_FROM en fallback). Le sender est l'adresse du
   * formulaire, ce qui permet de répondre directement depuis sa boîte mail.
   */
  async sendContactMessage(args: {
    fromName: string;
    fromEmail: string;
    subject: string;
    message: string;
  }) {
    if (!this.isEnabled) {
      this.logger.debug('SMTP disabled, contact message not sent.');
      return { sent: false };
    }

    const to =
      this.config.get<string>('CONTACT_EMAIL') ??
      this.config.get<string>('MAIL_FROM') ??
      'no-reply@example.local';

    const transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: this.smtpAuth(),
    });

    const safeName    = escapeHtml(args.fromName);
    const safeEmail   = escapeHtml(args.fromEmail);
    const safeSubject = escapeHtml(args.subject);
    const safeBody    = escapeHtml(args.message).replace(/\n/g, '<br>');

    try {
      await transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM', 'Personal Platform <no-reply@example.local>'),
        to,
        // replyTo permet de répondre directement au visiteur depuis ta boîte.
        replyTo: `${args.fromName} <${args.fromEmail}>`,
        subject: `[CleanVex] ${args.subject}`,
        text:
          `Message de ${args.fromName} <${args.fromEmail}>\n\n` +
          `Sujet : ${args.subject}\n\n${args.message}`,
        html: `
          <div style="font-family:'Segoe UI',system-ui,sans-serif;color:#c9d1e0;background:#0c1029;padding:24px;max-width:600px;margin:0 auto">
            <div style="background:#141830;border:1px solid #1e2347;border-radius:14px;padding:24px">
              <p style="color:#7b82a8;font-size:11px;font-family:monospace;letter-spacing:0.1em;margin:0 0 6px">NOUVEAU MESSAGE — CLEANVEX</p>
              <h2 style="color:#c4b5fd;margin:0 0 18px;font-size:18px">${safeSubject}</h2>
              <p style="margin:0 0 4px;font-size:13px"><strong>De :</strong> ${safeName} &lt;${safeEmail}&gt;</p>
              <hr style="border:none;border-top:1px solid #1e2347;margin:16px 0">
              <p style="font-size:13px;line-height:1.6;white-space:pre-wrap">${safeBody}</p>
            </div>
          </div>`,
      });
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      this.logger.warn(`Contact email failed: ${message}`);
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
