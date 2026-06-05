import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ownerId: string, query: string) {
    const q = query.trim();
    if (!q) return { query: q, results: [] };

    const contains = { contains: q, mode: 'insensitive' as const };
    const [documents, contacts, vehicles, properties, tasks, stockItems, transactions] =
      await Promise.all([
        this.prisma.document.findMany({
          where: { ownerId, name: contains },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.contact.findMany({
          where: {
            ownerId,
            OR: [
              { displayName: contains },
              { organization: contains },
              { email: contains },
              { phone: contains },
              { city: contains },
            ],
          },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.vehicle.findMany({
          where: {
            ownerId,
            OR: [
              { name: contains },
              { brand: contains },
              { model: contains },
              { registration: contains },
            ],
          },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.property.findMany({
          where: {
            ownerId,
            OR: [
              { name: contains },
              { address: contains },
              { city: contains },
            ],
          },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.task.findMany({
          where: { ownerId, title: contains },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.stockItem.findMany({
          where: { ownerId, name: contains },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.financialTransaction.findMany({
          where: { ownerId, label: contains },
          take: 10,
          orderBy: { operationDate: 'desc' },
        }),
      ]);

    return {
      query: q,
      results: [
        ...documents.map((item) => ({
          type: 'document',
          id: item.id,
          title: item.name,
          subtitle: item.mimeType,
        })),
        ...contacts.map((item) => ({
          type: 'contact',
          id: item.id,
          title: item.displayName,
          subtitle: item.organization ?? item.email ?? item.phone ?? item.kind,
        })),
        ...vehicles.map((item) => ({
          type: 'vehicle',
          id: item.id,
          title: item.name,
          subtitle: [item.brand, item.model].filter(Boolean).join(' '),
        })),
        ...properties.map((item) => ({
          type: 'property',
          id: item.id,
          title: item.name,
          subtitle: [item.city, item.status].filter(Boolean).join(' - '),
        })),
        ...tasks.map((item) => ({
          type: 'task',
          id: item.id,
          title: item.title,
          subtitle: item.status,
        })),
        ...stockItems.map((item) => ({
          type: 'stock',
          id: item.id,
          title: item.name,
          subtitle: `${item.quantity} ${item.unit}`,
        })),
        ...transactions.map((item) => ({
          type: 'finance',
          id: item.id,
          title: item.label,
          subtitle: `${item.type} ${item.amount}`,
        })),
      ],
    };
  }
}
