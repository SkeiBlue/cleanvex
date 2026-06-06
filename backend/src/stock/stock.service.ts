import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate, PaginationDto } from '../core/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { ConsumeStockDto } from './dto/consume-stock.dto';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { CreateToolLoanDto } from './dto/create-tool-loan.dto';
import { PurchaseStockDto } from './dto/purchase-stock.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async items(ownerId: string) {
    await this.ensureStockEnabled();
    return this.prisma.stockItem.findMany({
      where: { ownerId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { movements: true } },
      },
    });
  }

  async movements(ownerId: string, { page = 1, limit = 20 }: PaginationDto = {}) {
    await this.ensureStockEnabled();
    const where = { ownerId };
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { stockItem: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async createItem(ownerId: string, dto: CreateStockItemDto) {
    await this.ensureStockEnabled();
    return this.prisma.stockItem.create({
      data: {
        ownerId,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        quantity: dto.quantity ?? 0,
        thresholdEnabled: dto.thresholdEnabled ?? false,
        threshold: dto.threshold,
        location: dto.location,
        valueAmount: dto.valueAmount,
        reference: dto.reference,
        supplier: dto.supplier,
        notes: dto.notes,
      },
    });
  }

  async purchase(ownerId: string, itemId: string, dto: PurchaseStockDto) {
    await this.ensureStockEnabled();
    const item = await this.ensureOwnedItem(ownerId, itemId);

    if (dto.accountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.accountId, ownerId },
      });
      if (!account) throw new NotFoundException('Financial account not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: { increment: dto.quantity } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          ownerId,
          stockItemId: item.id,
          type: 'purchase',
          quantity: dto.quantity,
          valueAmount: dto.valueAmount,
          sourceType: dto.accountId ? 'financial_account' : 'manual',
          sourceId: dto.accountId,
          note: dto.note,
        },
      });

      let transaction: unknown = null;
      if (dto.accountId && dto.valueAmount && dto.valueAmount > 0) {
        transaction = await tx.financialTransaction.create({
          data: {
            ownerId,
            type: 'expense',
            amount: dto.valueAmount,
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            operationDate: dto.operationDate
              ? new Date(dto.operationDate)
              : new Date(),
            label: `Achat stock - ${item.name}`,
            note: dto.note,
            sourceModule: 'stock',
            sourceType: 'purchase',
            sourceId: movement.id,
            status: 'linked',
          },
        });
      }

      return { item: updatedItem, movement, transaction };
    });
  }

  async consume(ownerId: string, itemId: string, dto: ConsumeStockDto) {
    await this.ensureStockEnabled();
    const item = await this.ensureOwnedItem(ownerId, itemId);
    const currentQuantity = Number(item.quantity);

    if (currentQuantity < dto.quantity) {
      throw new BadRequestException('Insufficient stock quantity');
    }

    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, ownerId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: { decrement: dto.quantity } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          ownerId,
          stockItemId: item.id,
          type: 'consume',
          quantity: dto.quantity,
          valueAmount: dto.valueAmount,
          targetType: dto.vehicleId ? 'vehicle' : undefined,
          targetId: dto.vehicleId,
          note: dto.note,
        },
      });

      let intervention: unknown = null;
      if (dto.vehicleId && dto.valueAmount && dto.valueAmount > 0) {
        intervention = await tx.vehicleIntervention.create({
          data: {
            vehicleId: dto.vehicleId,
            title: `Stock - ${item.name}`,
            date: new Date(),
            costAmount: dto.valueAmount,
            status: 'done',
            notes: dto.note,
          },
        });
      }

      return { item: updatedItem, movement, intervention };
    });
  }

  async updateItem(ownerId: string, itemId: string, dto: UpdateStockItemDto) {
    await this.ensureStockEnabled();
    await this.ensureOwnedItem(ownerId, itemId);
    return this.prisma.stockItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.thresholdEnabled !== undefined && { thresholdEnabled: dto.thresholdEnabled }),
        ...(dto.threshold !== undefined && { threshold: dto.threshold }),
        ...(dto.valueAmount !== undefined && { valueAmount: dto.valueAmount }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.supplier !== undefined && { supplier: dto.supplier }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteItem(ownerId: string, itemId: string) {
    await this.ensureStockEnabled();
    await this.ensureOwnedItem(ownerId, itemId);
    await this.prisma.stockItem.delete({ where: { id: itemId } });
  }

  // ── ToolLoan ──────────────────────────────────────────────────────────────

  async loans(ownerId: string) {
    await this.ensureStockEnabled();
    return this.prisma.toolLoan.findMany({
      where: { ownerId },
      include: { stockItem: { select: { id: true, name: true, unit: true } } },
      orderBy: { loanDate: 'desc' },
    });
  }

  async createLoan(ownerId: string, dto: CreateToolLoanDto) {
    await this.ensureStockEnabled();
    const item = await this.ensureOwnedItem(ownerId, dto.stockItemId);
    return this.prisma.toolLoan.create({
      data: {
        ownerId,
        stockItemId: item.id,
        borrowerName: dto.borrowerName,
        loanDate: dto.loanDate ? new Date(dto.loanDate) : new Date(),
        expectedReturnDate: dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : undefined,
        notes: dto.notes,
      },
      include: { stockItem: { select: { id: true, name: true, unit: true } } },
    });
  }

  async returnLoan(ownerId: string, loanId: string) {
    await this.ensureStockEnabled();
    const loan = await this.prisma.toolLoan.findFirst({ where: { id: loanId, ownerId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.returnedAt) throw new BadRequestException('Already returned');
    return this.prisma.toolLoan.update({
      where: { id: loanId },
      data: { returnedAt: new Date() },
      include: { stockItem: { select: { id: true, name: true, unit: true } } },
    });
  }

  async deleteLoan(ownerId: string, loanId: string) {
    await this.ensureStockEnabled();
    const loan = await this.prisma.toolLoan.findFirst({ where: { id: loanId, ownerId } });
    if (!loan) throw new NotFoundException('Loan not found');
    await this.prisma.toolLoan.delete({ where: { id: loanId } });
  }

  private async ensureOwnedItem(ownerId: string, itemId: string) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id: itemId, ownerId },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    return item;
  }

  private async ensureStockEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'stock' },
    });
    if (module && !module.isEnabled) {
      throw new ForbiddenException('Stock module is disabled');
    }
  }
}
