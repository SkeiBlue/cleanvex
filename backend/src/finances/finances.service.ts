import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ownerId: string) {
    await this.ensureFinancesEnabled();
    const [accounts, transactions] = await Promise.all([
      this.accounts(ownerId),
      this.transactions(ownerId),
    ]);

    const totals = transactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount);
        if (transaction.type === 'income') acc.income += amount;
        if (transaction.type === 'expense') acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const initialBalance = accounts.reduce(
      (sum, account) => sum + Number(account.initialBalance),
      0,
    );

    return {
      accountCount: accounts.length,
      transactionCount: transactions.length,
      income: totals.income,
      expense: totals.expense,
      balance: initialBalance + totals.income - totals.expense,
    };
  }

  async accounts(ownerId: string) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialAccount.findMany({
      where: { ownerId },
      orderBy: { name: 'asc' },
    });
  }

  async createAccount(ownerId: string, dto: CreateFinancialAccountDto) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialAccount.create({
      data: {
        ownerId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency ?? 'EUR',
        initialBalance: dto.initialBalance ?? 0,
      },
    });
  }

  async categories() {
    await this.ensureFinancesEnabled();
    return this.prisma.financialCategory.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateFinancialCategoryDto) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialCategory.create({
      data: {
        name: dto.name,
        type: dto.type,
        color: dto.color,
      },
    });
  }

  async transactions(ownerId: string) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialTransaction.findMany({
      where: { ownerId },
      include: {
        account: true,
        category: true,
      },
      orderBy: { operationDate: 'desc' },
    });
  }

  async createTransaction(ownerId: string, dto: CreateFinancialTransactionDto) {
    await this.ensureFinancesEnabled();
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, ownerId },
    });

    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    if (dto.sourceModule === 'vehicles' && dto.sourceType && dto.sourceId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.sourceId, ownerId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle source not found');
      }
    }

    if (dto.sourceModule === 'real-estate' && dto.sourceType && dto.sourceId) {
      const property = await this.prisma.property.findFirst({
        where: { id: dto.sourceId, ownerId },
      });
      if (!property) {
        throw new NotFoundException('Property source not found');
      }
    }

    return this.prisma.financialTransaction.create({
      data: {
        ownerId,
        type: dto.type,
        amount: dto.amount,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        operationDate: new Date(dto.operationDate),
        label: dto.label,
        note: dto.note,
        sourceModule: dto.sourceModule,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        status: dto.status ?? (dto.sourceModule ? 'linked' : 'manual'),
      },
      include: {
        account: true,
        category: true,
      },
    });
  }

  async updateTransaction(ownerId: string, id: string, dto: UpdateFinancialTransactionDto) {
    await this.ensureFinancesEnabled();
    const tx = await this.prisma.financialTransaction.findFirst({
      where: { id, ownerId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.operationDate !== undefined && { operationDate: new Date(dto.operationDate) }),
      },
      include: { account: true, category: true },
    });
  }

  private async ensureFinancesEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'finances' },
    });

    if (module && !module.isEnabled) {
      throw new ForbiddenException('Finances module is disabled');
    }
  }
}
