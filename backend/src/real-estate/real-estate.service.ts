import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyEventDto } from './dto/create-property-event.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreatePropertyZoneDto } from './dto/create-property-zone.dto';
import {
  CreatePropertyWorkDto,
  UpdatePropertyWorkDto,
} from './dto/create-property-work.dto';
import { CreateRentalIncomeDto } from './dto/create-rental-income.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class RealEstateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    await this.ensureRealEstateEnabled();
    return this.prisma.property.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { events: true } },
      },
    });
  }

  async create(ownerId: string, dto: CreatePropertyDto) {
    await this.ensureRealEstateEnabled();
    return this.prisma.property.create({
      data: {
        ownerId,
        name: dto.name,
        type: dto.type,
        status: dto.status,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        country: dto.country ?? 'FR',
        surface: dto.surface,
        rooms: dto.rooms,
        purchasePrice: dto.purchasePrice,
        estimatedValue: dto.estimatedValue,
        notes: dto.notes,
      },
    });
  }

  async get(ownerId: string, id: string) {
    await this.ensureRealEstateEnabled();
    const property = await this.prisma.property.findFirst({
      where: { id, ownerId },
      include: {
        events: { orderBy: { date: 'desc' } },
        zones: { orderBy: { name: 'asc' } },
        works: { orderBy: { createdAt: 'desc' } },
        rentalIncomes: { orderBy: { receivedAt: 'desc' } },
      },
    });

    if (!property) throw new NotFoundException('Property not found');

    const documents = await this.prisma.documentLink.findMany({
      where: { targetType: 'property', targetId: id },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            visibility: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const profitability = this.computeProfitability(property);

    return { ...property, documents, profitability };
  }

  // Sprint 5 — rentabilité brute :
  // (revenus locatifs annualisés - charges connues) / coût total d'acquisition.
  // Coût d'acquisition = prix d'achat + cumul des travaux réels.
  private computeProfitability(property: {
    purchasePrice: { toString(): string } | null;
    rentalIncomes: { amount: { toString(): string }; receivedAt: Date }[];
    works: { actualAmount: { toString(): string } | null }[];
  }) {
    const purchase = Number(property.purchasePrice ?? 0);
    const worksTotal = property.works.reduce(
      (sum, w) => sum + Number(w.actualAmount ?? 0),
      0,
    );
    const totalCost = purchase + worksTotal;

    // Annualisation : on prend les 12 derniers mois de revenus.
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const annualRent = property.rentalIncomes
      .filter((r) => r.receivedAt >= oneYearAgo)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const grossYield = totalCost > 0 ? (annualRent / totalCost) * 100 : 0;

    return {
      purchasePrice: purchase,
      worksTotal,
      totalCost,
      annualRent,
      grossYield: Math.round(grossYield * 100) / 100,
    };
  }

  /* ── Zones ── */

  async listZones(ownerId: string, propertyId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    return this.prisma.propertyZone.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(
    ownerId: string,
    propertyId: string,
    dto: CreatePropertyZoneDto,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    return this.prisma.propertyZone.create({
      data: {
        propertyId,
        name: dto.name,
        notes: dto.notes,
      },
    });
  }

  async deleteZone(ownerId: string, propertyId: string, zoneId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    const zone = await this.prisma.propertyZone.findFirst({
      where: { id: zoneId, propertyId },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.prisma.propertyZone.delete({ where: { id: zoneId } });
  }

  /* ── Works ── */

  async listWorks(ownerId: string, propertyId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    return this.prisma.propertyWork.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: { zone: true },
    });
  }

  async createWork(
    ownerId: string,
    propertyId: string,
    dto: CreatePropertyWorkDto,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    if (dto.zoneId) {
      const zone = await this.prisma.propertyZone.findFirst({
        where: { id: dto.zoneId, propertyId },
      });
      if (!zone) throw new NotFoundException('Zone not found');
    }
    return this.prisma.propertyWork.create({
      data: {
        propertyId,
        zoneId: dto.zoneId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'planned',
        priority: dto.priority ?? 'normal',
        budgetAmount: dto.budgetAmount,
        actualAmount: dto.actualAmount,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        supplierContactId: dto.supplierContactId,
        notes: dto.notes,
      },
    });
  }

  async updateWork(
    ownerId: string,
    propertyId: string,
    workId: string,
    dto: UpdatePropertyWorkDto,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    const work = await this.prisma.propertyWork.findFirst({
      where: { id: workId, propertyId },
    });
    if (!work) throw new NotFoundException('Work not found');
    return this.prisma.propertyWork.update({
      where: { id: workId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.budgetAmount !== undefined && {
          budgetAmount: dto.budgetAmount,
        }),
        ...(dto.actualAmount !== undefined && {
          actualAmount: dto.actualAmount,
        }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.supplierContactId !== undefined && {
          supplierContactId: dto.supplierContactId,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteWork(ownerId: string, propertyId: string, workId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    const work = await this.prisma.propertyWork.findFirst({
      where: { id: workId, propertyId },
    });
    if (!work) throw new NotFoundException('Work not found');
    await this.prisma.propertyWork.delete({ where: { id: workId } });
  }

  /* ── Rental incomes ── */

  async listRentalIncomes(ownerId: string, propertyId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    return this.prisma.propertyRentalIncome.findMany({
      where: { propertyId, ownerId },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async createRentalIncome(
    ownerId: string,
    propertyId: string,
    dto: CreateRentalIncomeDto,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    return this.prisma.propertyRentalIncome.create({
      data: {
        ownerId,
        propertyId,
        amount: dto.amount,
        receivedAt: new Date(dto.receivedAt),
        tenantName: dto.tenantName,
        notes: dto.notes,
      },
    });
  }

  async deleteRentalIncome(
    ownerId: string,
    propertyId: string,
    incomeId: string,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    const income = await this.prisma.propertyRentalIncome.findFirst({
      where: { id: incomeId, propertyId, ownerId },
    });
    if (!income) throw new NotFoundException('Rental income not found');
    await this.prisma.propertyRentalIncome.delete({ where: { id: incomeId } });
  }

  async update(ownerId: string, id: string, dto: UpdatePropertyDto) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, id);
    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  async addEvent(
    ownerId: string,
    propertyId: string,
    dto: CreatePropertyEventDto,
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);

    const event = await this.prisma.propertyEvent.create({
      data: {
        propertyId,
        type: dto.type,
        title: dto.title,
        date: new Date(dto.date),
        amount: dto.amount,
        status: dto.status ?? 'planned',
        notes: dto.notes,
      },
    });

    if (event.status !== 'done') {
      await this.prisma.notification.create({
        data: {
          ownerId,
          type: 'property_event',
          title: `Immobilier - ${event.title}`,
          message: 'Une echeance immobiliere est planifiee.',
          importance: 'normal',
          dueDate: event.date,
          targetType: 'property',
          targetId: propertyId,
        },
      });
    }

    return event;
  }

  async linkDocument(
    ownerId: string,
    propertyId: string,
    documentId: string,
    context = 'property',
  ) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.prisma.documentLink.create({
      data: {
        documentId,
        targetType: 'property',
        targetId: propertyId,
        context,
      },
    });
  }

  async delete(ownerId: string, id: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, id);
    await this.prisma.property.delete({ where: { id } });
  }

  async deleteEvent(ownerId: string, propertyId: string, eventId: string) {
    await this.ensureRealEstateEnabled();
    await this.ensureOwnedProperty(ownerId, propertyId);
    const event = await this.prisma.propertyEvent.findFirst({
      where: { id: eventId, propertyId },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.propertyEvent.delete({ where: { id: eventId } });
  }

  private async ensureOwnedProperty(ownerId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, ownerId },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  private async ensureRealEstateEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'real-estate' },
    });

    if (module && !module.isEnabled) {
      throw new ForbiddenException('Real estate module is disabled');
    }
  }
}
