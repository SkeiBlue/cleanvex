import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyEventDto } from './dto/create-property-event.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
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

    return { ...property, documents };
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
