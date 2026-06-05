import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ownerId: string) {
    const [
      vehicles,
      contacts,
      documents,
      stockItems,
      properties,
      openTasks,
      transactions,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { ownerId } }),
      this.prisma.contact.count({ where: { ownerId } }),
      this.prisma.document.count({ where: { ownerId } }),
      this.prisma.stockItem.count({ where: { ownerId } }),
      this.prisma.property.count({ where: { ownerId } }),
      this.prisma.task.count({ where: { ownerId, status: { not: 'done' } } }),
      this.prisma.financialTransaction.findMany({ where: { ownerId } }),
      this.prisma.notification.count({ where: { ownerId, isRead: false } }),
    ]);

    const finance = transactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount);
        if (transaction.type === 'income') acc.income += amount;
        if (transaction.type === 'expense') acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        vehicles,
        contacts,
        documents,
        stockItems,
        properties,
        openTasks,
        unreadNotifications,
        transactions: transactions.length,
      },
      finance: {
        income: finance.income,
        expense: finance.expense,
        net: finance.income - finance.expense,
      },
    };
  }
}
