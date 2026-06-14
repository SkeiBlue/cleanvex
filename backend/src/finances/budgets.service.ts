import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleCacheService } from '../core/module-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

type Period = 'week' | 'month' | 'year' | 'custom';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleCache: ModuleCacheService,
  ) {}

  async list(ownerId: string) {
    await this.moduleCache.assertEnabled('finances');
    const budgets = await this.prisma.budget.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(budgets.map((b) => this.withSpent(b)));
  }

  async get(ownerId: string, id: string) {
    await this.moduleCache.assertEnabled('finances');
    const budget = await this.prisma.budget.findFirst({
      where: { id, ownerId },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return this.withSpent(budget);
  }

  async create(ownerId: string, dto: CreateBudgetDto) {
    await this.moduleCache.assertEnabled('finances');
    return this.prisma.budget.create({
      data: {
        ownerId,
        name: dto.name,
        amount: dto.amount,
        period: dto.period,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        categoryId: dto.categoryId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        alertThreshold: dto.alertThreshold ?? 100,
      },
    });
  }

  async update(ownerId: string, id: string, dto: UpdateBudgetDto) {
    await this.moduleCache.assertEnabled('finances');
    const existing = await this.prisma.budget.findFirst({
      where: { id, ownerId },
    });
    if (!existing) throw new NotFoundException('Budget not found');
    return this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.targetType !== undefined && { targetType: dto.targetType }),
        ...(dto.targetId !== undefined && { targetId: dto.targetId }),
        ...(dto.alertThreshold !== undefined && {
          alertThreshold: dto.alertThreshold,
        }),
      },
    });
  }

  async delete(ownerId: string, id: string) {
    await this.moduleCache.assertEnabled('finances');
    const existing = await this.prisma.budget.findFirst({
      where: { id, ownerId },
    });
    if (!existing) throw new NotFoundException('Budget not found');
    await this.prisma.budget.delete({ where: { id } });
    return { deleted: true };
  }

  // Rapport temporel agrégé (revenus/dépenses) sur une période.
  async report(
    ownerId: string,
    period: Period | undefined,
    from?: string,
    to?: string,
  ) {
    await this.moduleCache.assertEnabled('finances');
    const range = this.resolveRange(period ?? 'month', from, to);
    const agg = await this.prisma.financialTransaction.groupBy({
      by: ['type'],
      where: {
        ownerId,
        operationDate: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    });
    const income = Number(
      agg.find((r) => r.type === 'income')?._sum.amount ?? 0,
    );
    const expense = Number(
      agg.find((r) => r.type === 'expense')?._sum.amount ?? 0,
    );
    return {
      period: period ?? 'month',
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      income,
      expense,
      net: income - expense,
    };
  }

  private async withSpent(budget: {
    id: string;
    ownerId: string;
    amount: { toString(): string };
    period: string;
    startDate: Date;
    endDate: Date | null;
    categoryId: string | null;
    targetType: string | null;
    targetId: string | null;
    alertThreshold: number;
    name: string;
  }) {
    const range = this.resolveRange(
      budget.period as Period,
      budget.startDate.toISOString(),
      budget.endDate ? budget.endDate.toISOString() : undefined,
    );

    const where: Record<string, unknown> = {
      ownerId: budget.ownerId,
      type: 'expense',
      operationDate: { gte: range.start, lte: range.end },
    };
    if (budget.categoryId) where.categoryId = budget.categoryId;
    if (budget.targetType && budget.targetId) {
      where.sourceModule =
        budget.targetType === 'vehicle' ? 'vehicles' : 'real-estate';
      where.sourceId = budget.targetId;
    }

    const agg = await this.prisma.financialTransaction.aggregate({
      where,
      _sum: { amount: true },
    });
    const spent = Number(agg._sum.amount ?? 0);
    const amount = Number(budget.amount);
    const remaining = amount - spent;
    const ratio = amount > 0 ? Math.round((spent / amount) * 100) : 0;
    const alert = ratio >= budget.alertThreshold;

    return {
      ...budget,
      computed: {
        spent,
        remaining,
        ratio,
        alert,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      },
    };
  }

  private resolveRange(period: Period, from?: string, to?: string) {
    const now = new Date();
    if (period === 'custom') {
      return {
        start: from ? new Date(from) : new Date(now.getFullYear(), 0, 1),
        end: to ? new Date(to) : now,
      };
    }
    if (period === 'week') {
      const start = new Date(now);
      const day = (start.getDay() + 6) % 7; // Lundi = 0
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    if (period === 'year') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      };
    }
    // month
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
}
