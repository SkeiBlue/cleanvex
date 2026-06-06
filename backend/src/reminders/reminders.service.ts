import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Tous les jours à 03h00 — nettoyage tokens expirés */
  @Cron('0 3 * * *')
  async cleanupExpiredTokens() {
    const now = new Date();

    const [refreshTokens, verificationTokens] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    this.logger.log(
      `Nettoyage tokens — refresh: ${refreshTokens.count} · vérification: ${verificationTokens.count}`,
    );
  }

  /** Tous les jours à 08h00 */
  @Cron('0 8 * * *')
  async dailyReminders() {
    if (!this.mail.isEnabled) {
      this.logger.debug('SMTP non configuré — rappels désactivés.');
      return;
    }
    this.logger.log('Lancement des rappels quotidiens…');

    const users = await this.prisma.user.findMany({
      where: { emailVerified: true },
      select: { id: true, email: true, username: true },
    });

    let sent = 0;
    for (const user of users) {
      const digest = await this.buildDigest(user.id);
      if (digest.hasItems) {
        await this.mail.sendReminderDigest(user.email, user.username ?? user.email, digest);
        sent++;
      }
    }
    this.logger.log(`Rappels envoyés : ${sent}/${users.length} utilisateurs.`);
  }

  /** Forcer un envoi immédiat (pour test) */
  async triggerNow(userId: string): Promise<{ sent: boolean; digest: DigestData }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    });
    const digest = await this.buildDigest(userId);
    if (digest.hasItems && this.mail.isEnabled) {
      await this.mail.sendReminderDigest(user.email, user.username ?? user.email, digest);
      return { sent: true, digest };
    }
    return { sent: false, digest };
  }

  private async buildDigest(userId: string): Promise<DigestData> {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const in7  = new Date(now.getTime() + 7  * 86_400_000);

    /* ── Alertes véhicules imminentes ── */
    const vehicleAlerts = await this.prisma.vehicleAlert.findMany({
      where: {
        vehicle: { ownerId: userId },
        status: 'open',
        dueDate: { lte: in30 },
      },
      include: { vehicle: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });

    /* ── Documents qui expirent ── */
    const expiringDocs = await this.prisma.document.findMany({
      where: { ownerId: userId, expiresAt: { lte: in30, gte: now } },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, name: true, expiresAt: true },
    });

    /* ── Tâches en retard ── */
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        ownerId: userId,
        status: { notIn: ['done', 'cancelled'] },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, dueDate: true, priority: true },
    });

    /* ── Prêts en retard (ToolLoan) ── */
    const overdueLoans = await this.prisma.toolLoan.findMany({
      where: {
        ownerId: userId,
        returnedAt: null,
        expectedReturnDate: { lt: now },
      },
      include: { stockItem: { select: { name: true } } },
      orderBy: { expectedReturnDate: 'asc' },
    });

    return {
      vehicleAlerts: vehicleAlerts.map(a => ({
        vehicleName: a.vehicle.name,
        title:       a.title,
        type:        a.type,
        dueDate:     a.dueDate,
        isUrgent:    a.dueDate ? a.dueDate <= in7 : false,
      })),
      expiringDocs: expiringDocs.map(d => ({
        name:    d.name,
        expiresAt: d.expiresAt!,
        isUrgent: d.expiresAt! <= in7,
      })),
      overdueTasks: overdueTasks.map(t => ({
        title:    t.title,
        dueDate:  t.dueDate!,
        priority: t.priority,
      })),
      overdueLoans: overdueLoans.map(l => ({
        itemName:     l.stockItem.name,
        borrowerName: l.borrowerName,
        expectedReturnDate: l.expectedReturnDate!,
      })),
      get hasItems() {
        return (
          this.vehicleAlerts.length > 0 ||
          this.expiringDocs.length > 0 ||
          this.overdueTasks.length > 0 ||
          this.overdueLoans.length > 0
        );
      },
    };
  }
}

export interface DigestData {
  vehicleAlerts: { vehicleName: string; title: string; type: string; dueDate: Date | null; isUrgent: boolean }[];
  expiringDocs: { name: string; expiresAt: Date; isUrgent: boolean }[];
  overdueTasks: { title: string; dueDate: Date; priority: string }[];
  overdueLoans: { itemName: string; borrowerName: string; expectedReturnDate: Date }[];
  hasItems: boolean;
}
