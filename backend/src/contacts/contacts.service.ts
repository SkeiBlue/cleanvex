import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactInteractionDto } from './dto/create-contact-interaction.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    await this.ensureContactsEnabled();
    return this.prisma.contact.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { interactions: true } },
      },
    });
  }

  async create(ownerId: string, dto: CreateContactDto) {
    await this.ensureContactsEnabled();
    return this.prisma.contact.create({
      data: {
        ownerId,
        kind: dto.kind ?? 'person',
        displayName: dto.displayName,
        organization: dto.organization,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        country: dto.country ?? 'FR',
        tagsJson: this.parseTags(dto.tags),
        notes: dto.notes,
      },
    });
  }

  async get(ownerId: string, id: string) {
    await this.ensureContactsEnabled();
    const contact = await this.prisma.contact.findFirst({
      where: { id, ownerId },
      include: {
        interactions: { orderBy: { date: 'desc' } },
      },
    });

    if (!contact) throw new NotFoundException('Contact not found');

    const documents = await this.prisma.documentLink.findMany({
      where: { targetType: 'contact', targetId: id },
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

    return { ...contact, documents };
  }

  async update(ownerId: string, id: string, dto: UpdateContactDto) {
    await this.ensureContactsEnabled();
    await this.ensureOwnedContact(ownerId, id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        kind: dto.kind,
        displayName: dto.displayName,
        organization: dto.organization,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        country: dto.country,
        tagsJson: dto.tags === undefined ? undefined : this.parseTags(dto.tags),
        notes: dto.notes,
      },
    });
  }

  async addInteraction(ownerId: string, contactId: string, dto: CreateContactInteractionDto) {
    await this.ensureContactsEnabled();
    await this.ensureOwnedContact(ownerId, contactId);

    return this.prisma.contactInteraction.create({
      data: {
        contactId,
        type: dto.type,
        title: dto.title,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });
  }

  async linkDocument(
    ownerId: string,
    contactId: string,
    documentId: string,
    context = 'contact',
  ) {
    await this.ensureContactsEnabled();
    await this.ensureOwnedContact(ownerId, contactId);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, ownerId },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.prisma.documentLink.create({
      data: {
        documentId,
        targetType: 'contact',
        targetId: contactId,
        context,
      },
    });
  }

  async delete(ownerId: string, id: string) {
    await this.ensureContactsEnabled();
    await this.ensureOwnedContact(ownerId, id);
    await this.prisma.contact.delete({ where: { id } });
  }

  async deleteInteraction(ownerId: string, contactId: string, interactionId: string) {
    await this.ensureContactsEnabled();
    await this.ensureOwnedContact(ownerId, contactId);
    const interaction = await this.prisma.contactInteraction.findFirst({
      where: { id: interactionId, contactId },
    });
    if (!interaction) throw new NotFoundException('Interaction not found');
    await this.prisma.contactInteraction.delete({ where: { id: interactionId } });
  }

  private async ensureOwnedContact(ownerId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, ownerId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  private async ensureContactsEnabled() {
    const module = await this.prisma.module.findUnique({
      where: { key: 'contacts' },
    });

    if (module && !module.isEnabled) {
      throw new ForbiddenException('Contacts module is disabled');
    }
  }

  private parseTags(tags?: string) {
    if (!tags) return undefined;
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}
