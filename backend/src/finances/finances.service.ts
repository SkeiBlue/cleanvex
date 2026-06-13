import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleCacheService } from '../core/module-cache.service';
import { paginate, PaginationDto } from '../core/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';

@Injectable()
export class FinancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleCache: ModuleCacheService,
  ) {}

  async summary(ownerId: string) {
    await this.ensureFinancesEnabled();
    // Agrégation directe en DB — pas de chargement en mémoire
    const [accounts, aggregate, transactionCount] = await Promise.all([
      this.accounts(ownerId),
      this.prisma.financialTransaction.groupBy({
        by: ['type'],
        where: { ownerId },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.count({ where: { ownerId } }),
    ]);

    const income = Number(
      aggregate.find((r) => r.type === 'income')?._sum.amount ?? 0,
    );
    const expense = Number(
      aggregate.find((r) => r.type === 'expense')?._sum.amount ?? 0,
    );
    const initialBalance = accounts.reduce(
      (sum, a) => sum + Number(a.initialBalance),
      0,
    );

    return {
      accountCount: accounts.length,
      transactionCount,
      income,
      expense,
      balance: initialBalance + income - expense,
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

  async categories(ownerId: string) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialCategory.findMany({
      where: { ownerId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(ownerId: string, dto: CreateFinancialCategoryDto) {
    await this.ensureFinancesEnabled();
    return this.prisma.financialCategory.create({
      data: {
        ownerId,
        name: dto.name,
        type: dto.type,
        color: dto.color,
      },
    });
  }

  async transactions(
    ownerId: string,
    { page = 1, limit = 20 }: PaginationDto = {},
  ) {
    await this.ensureFinancesEnabled();
    const where = { ownerId };
    const [data, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: { operationDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async createTransaction(ownerId: string, dto: CreateFinancialTransactionDto) {
    await this.ensureFinancesEnabled();
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, ownerId },
    });

    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findFirst({
        where: { id: dto.categoryId, ownerId },
        select: { id: true },
      });
      if (!category)
        throw new NotFoundException('Financial category not found');
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

  async updateTransaction(
    ownerId: string,
    id: string,
    dto: UpdateFinancialTransactionDto,
  ) {
    await this.ensureFinancesEnabled();
    const tx = await this.prisma.financialTransaction.findFirst({
      where: { id, ownerId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    // Empêche de rattacher la transaction à un compte/catégorie d'un autre
    // utilisateur (isolation + évite la fuite via include account/category).
    if (dto.accountId !== undefined) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.accountId, ownerId },
        select: { id: true },
      });
      if (!account) throw new NotFoundException('Financial account not found');
    }
    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findFirst({
        where: { id: dto.categoryId, ownerId },
        select: { id: true },
      });
      if (!category)
        throw new NotFoundException('Financial category not found');
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.categoryId !== undefined && {
          categoryId: dto.categoryId || null,
        }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.operationDate !== undefined && {
          operationDate: new Date(dto.operationDate),
        }),
      },
      include: { account: true, category: true },
    });
  }

  async deleteAccount(ownerId: string, id: string) {
    await this.ensureFinancesEnabled();
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, ownerId },
    });
    if (!account) throw new NotFoundException('Account not found');
    await this.prisma.financialAccount.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteCategory(ownerId: string, id: string) {
    await this.ensureFinancesEnabled();
    const cat = await this.prisma.financialCategory.findFirst({
      where: { id, ownerId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.financialCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteTransaction(ownerId: string, id: string) {
    await this.ensureFinancesEnabled();
    const tx = await this.prisma.financialTransaction.findFirst({
      where: { id, ownerId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    await this.prisma.financialTransaction.delete({ where: { id } });
    return { deleted: true };
  }

  private ensureFinancesEnabled(): Promise<void> {
    return this.moduleCache.assertEnabled('finances');
  }
}
